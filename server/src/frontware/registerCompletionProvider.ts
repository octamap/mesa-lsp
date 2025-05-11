import path from 'path';
import { CompletionItem, CompletionItemKind, CompletionParams, Connection, TextDocuments } from 'vscode-languageserver';
import getParentTag from '../middleware/find-components/helpers/getParentTag.js';
import readComponentMappingsForPath from '../middleware/find-components/readComponentMappingsForPath.js';
import readComponentConfiguration from '../middleware/read-component-configuratiron/readComponentConfiguration.js';
import { URI } from 'vscode-uri';
import { TextDocument } from 'vscode-languageserver-textdocument';

export default function registerCompletionProvider(connection: Connection, documents: TextDocuments<TextDocument>) {
	connection.onCompletion(
		async (params: CompletionParams): Promise<CompletionItem[]> => {
			// 1) Grab the doc & position
			const doc = documents.get(params.textDocument.uri);
			if (!doc) return [];
			const position = params.position;
	
			// 2) Compute the file‐system directory for this document
			//    (vscode-uri gives you a proper fsPath on all platforms)
			const fsPath = URI.parse(doc.uri).fsPath;
			const fileDir = path.dirname(fsPath);
	
			// 3) Load your component mappings
			const components = await readComponentMappingsForPath(fileDir);
			if (!components) {
				// use LSP window API instead of vscode.window
				connection.window.showWarningMessage(
					'No vite.config.ts found in the current directory tree.'
				);
				return [];
			}
	
			// 4) Build the flat list of <Component /> items
			const items: CompletionItem[] = Object.keys(components).map(name => {
				const ci = CompletionItem.create(name);
				ci.kind = CompletionItemKind.Class;
				ci.sortText = `1_${name}`;
				return ci;
			});
	
			// 5) If we’re inside a parent tag, offer its slots first
			const parentTag = getParentTag(doc, position);
			if (parentTag && components[parentTag]) {
				const config = await readComponentConfiguration(components[parentTag]);
				if (config) {
					for (const slotName of config.slots) {
						const si = CompletionItem.create(slotName);
						si.kind = CompletionItemKind.Field;
						si.sortText = `0_${slotName}`;  // lower = higher priority
						items.push(si);
					}
				}
			}
	
			return items;
		}
	  );
}