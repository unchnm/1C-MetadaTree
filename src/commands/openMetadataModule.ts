// 1C-MetadataTree: begin fork-owned module path resolution and opening behavior.
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MetadataType, type TreeNode } from '../models/treeNode';
import { getStandardModuleFileName, type StandardModuleKind } from '../constants/metadataModuleDescriptors';
import { getFormPaths } from '../formEditor/formPaths';

/** Opens an existing module without creating files as a side effect. */
export async function openMetadataModule(node: TreeNode | undefined, kind: StandardModuleKind | 'FormModule' | 'ApplicationModule' | 'SessionModule' | 'ExternalConnectionModule'): Promise<void> {
  if (!node?.filePath) { return; }
  let candidates: string[];
  if (kind === 'ApplicationModule' || kind === 'SessionModule' || kind === 'ExternalConnectionModule') {
    if (node.type !== MetadataType.Configuration) { return; }
    const ext = path.extname(node.filePath).toLowerCase();
    const dir = ext === '.xml' || ext === '.mdo' ? path.dirname(node.filePath) : node.filePath;
    const names = kind === 'ApplicationModule' ? ['ManagedApplicationModule.bsl', 'OrdinaryApplicationModule.bsl'] : [`${kind}.bsl`];
    candidates = names.flatMap(name => [path.join(dir, 'Ext', name), path.join(dir, name), path.join(dir, 'src', 'Configuration', name)]);
  } else if (kind === 'FormModule') {
    if (node.type !== MetadataType.Form && node.type !== MetadataType.CommonForm) { return; }
    candidates = [getFormPaths(node.filePath).modulePath, path.join(node.filePath, 'Module.bsl')];
  } else {
    const name = getStandardModuleFileName(node.type, kind);
    if (!name) { return; }
    const ext = path.extname(node.filePath).toLowerCase();
    const dir = ext === '.xml' ? node.filePath.slice(0, -ext.length) : node.filePath;
    candidates = [path.join(dir, 'Ext', name), path.join(dir, name)];
  }
  for (const file of candidates) {
    const exists = await fs.stat(file).then(s => s.isFile(), () => false);
    if (exists) {
      await vscode.window.showTextDocument(vscode.Uri.file(file), { preview: false });
      return;
    }
  }
  void vscode.window.showInformationMessage('Файл модуля не найден.');
}
// 1C-MetadataTree: end fork-owned module path resolution.
