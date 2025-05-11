import * as fs from 'fs/promises';
import * as path from 'path';
import fg from 'fast-glob';
import WorkspaceFolders from '../WorkspaceFolders.js';
import { URI } from 'vscode-uri';


let cachedPackages: Promise<Record<string, string>> | undefined

export default async function findAllPackagesInWorkspace(): Promise<Record<string, string>> {
    if (cachedPackages) return cachedPackages;
    const newResponse = (async () => {
        const workspaceFolders = WorkspaceFolders.value;
        if (!workspaceFolders) {
            return {};
        }

        const packageMap: Record<string, string> = {};
        const roots = WorkspaceFolders.value.map(f => URI.parse(f.uri).fsPath) ?? [];
        const packageJsonFiles = roots.flatMap(x => {
            return fg.sync('**/package.json', {
                cwd: roots[0],
                ignore: ['**/node_modules/**'],
            })
        });

        await Promise.all(packageJsonFiles.map(async fileUri => {
            const packageJsonPath = fileUri;

            try {
                const content = await fs.readFile(packageJsonPath, 'utf-8');
                const parsed = JSON.parse(content);

                if (parsed.name) {
                    const packageName = parsed.name;
                    const packageDir = path.dirname(packageJsonPath);
                    packageMap[packageName] = packageDir;
                }
            } catch (error) {
                console.warn(`Failed to read or parse package.json at ${packageJsonPath}:`, error);
            }
        }))
   
        return packageMap;
    })()
    cachedPackages = newResponse
    await newResponse;
    setTimeout(() => {
        cachedPackages = undefined;
    }, 1000 * 8);
    return newResponse
}
