// server/src/decorationService.ts
import path from 'path';
import { URI } from 'vscode-uri';
import {
	Connection,
	SemanticTokens,
	SemanticTokensParams,
	SemanticTokensRangeParams,
	TextDocuments,
	Position,
	Range
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

import readComponentMappingsForPath from '../middleware/find-components/readComponentMappingsForPath';
import readComponentConfiguration from '../middleware/read-component-configuratiron/readComponentConfiguration';
import getParentTag from '../middleware/find-components/helpers/getParentTag';

// helper to delta-encode the (line,char,len,type,mod) tuples
function encodeTokens(
	ranges: { line: number; startChar: number; length: number; typeIdx: number }[]
): number[] {
	const data: number[] = [];
	let prevLine = 0, prevChar = 0;
	for (const { line, startChar, length, typeIdx } of ranges) {
		const deltaLine = line - prevLine;
		const deltaStart = deltaLine === 0 ? startChar - prevChar : startChar;
		data.push(deltaLine, deltaStart, length, typeIdx, 0);
		prevLine = line;
		prevChar = startChar;
	}
	return data;
}

/**
 * Scans the entire document (or an LSP-specified sub-range) for:
 *  - component tags   (typeIdx=0)
 *  - slot markers     (typeIdx=1)
 * and returns a SemanticTokens blob.
 */
async function buildTokensForDocument(
	document: TextDocument,
	range?: Range
): Promise<SemanticTokens> {
	const text = document.getText(range);
	const uri = document.uri;
	const fsPath = URI.parse(uri).fsPath;
	const fileDir = path.dirname(fsPath);

	// 1) load your component→path map
	const components = await readComponentMappingsForPath(fileDir);
	if (!components) {
		return { data: [] };
	}

	const allTokens: Array<{
		line: number;
		startChar: number;
		length: number;
		typeIdx: number;
	}> = [];
	const usedComponents = new Set<string>();

	// 2) find component tags (<MyComp> or </MyComp>)
	for (const componentName of Object.keys(components)) {
		const regex = new RegExp(`\\b${componentName}\\b`, 'g');
		let match: RegExpExecArray | null;
		while ((match = regex.exec(text)) !== null) {
			const idx = match.index;
			const pos = document.positionAt(idx);
			const lineStartOffset = document.offsetAt({ line: pos.line, character: 0 });
			const prefix = text.slice(lineStartOffset, idx);

			let startOffset: number;
			if (prefix.endsWith('</')) {
				startOffset = idx - 2;
			} else if (prefix.endsWith('<')) {
				startOffset = idx - 1;
			} else {
				continue;
			}

			const startPos = document.positionAt(startOffset);
			const endOffset = idx + componentName.length + 1;  // include the trailing '>'
			const length = endOffset - startOffset;

			allTokens.push({
				line: startPos.line,
				startChar: startPos.character,
				length,
				typeIdx: 0
			});
			usedComponents.add(componentName);
		}
	}

	// 3) for each used component, load its config and find slot names
	for (const comp of usedComponents) {
		const config = await readComponentConfiguration(components[comp]);
		if (!config) continue;

		for (const slotName of config.slots) {
			const regex = new RegExp(`\\b${slotName}\\b`, 'g');
			let match: RegExpExecArray | null;
			while ((match = regex.exec(text)) !== null) {
				const idx = match.index;
				const pos = document.positionAt(idx);
				const lineStartOffset = document.offsetAt({ line: pos.line, character: 0 });
				const prefix = text.slice(lineStartOffset, idx);

				let startOffset: number;
				let useEnd = false;
				if (prefix.endsWith('</')) {
					startOffset = idx - 2;
					useEnd = true;
				} else if (prefix.endsWith('<')) {
					startOffset = idx - 1;
				} else {
					continue;
				}

				// only highlight this slot if it's inside the right parent
				const testPos = useEnd
					? document.positionAt(idx + slotName.length + 1)
					: pos;
				if (getParentTag(document, testPos) !== comp) {
					continue;
				}

				const startPos = document.positionAt(startOffset);
				const endOffset = idx + slotName.length + 1;
				const length = endOffset - startOffset;

				allTokens.push({
					line: startPos.line,
					startChar: startPos.character,
					length,
					typeIdx: 1
				});
			}
		}
	}

	// 4) sort & encode
	allTokens.sort((a, b) =>
		a.line - b.line ||
		a.startChar - b.startChar
	);
	return { data: encodeTokens(allTokens) };
}

/**
 * Call this from your `connection` setup.
 */
export default function registerDecorationService(
	connection: Connection,
	documents: TextDocuments<TextDocument>
) {
	connection.languages.semanticTokens.on(
		async (params: SemanticTokensParams) => {
			const doc = documents.get(params.textDocument.uri)!;
			return await buildTokensForDocument(doc);
		}
	);

	connection.languages.semanticTokens.onRange(
		async (params: SemanticTokensRangeParams) => {
			const doc = documents.get(params.textDocument.uri)!;
			return await buildTokensForDocument(doc, params.range);
		}
	);
}