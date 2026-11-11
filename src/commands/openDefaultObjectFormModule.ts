// 1C-MetadataTree: begin fork-owned default object form module command.
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { getMetadataTypeDescriptorByType } from '../constants/metadataTypeDescriptors';
import type { TreeNode } from '../models/treeNode';
import { XmlParser } from '../parsers/xmlParser';

/** Open the assigned object form module from the selected object's own metadata file. */
export async function openDefaultObjectFormModule(node?: TreeNode): Promise<void> {
  if (!node?.filePath) { void vscode.window.showInformationMessage('Для объекта не найден файл метаданных.'); return; }
  const descriptor = getMetadataTypeDescriptorByType(node.type);
  if (!descriptor) { return; }
  const ext = path.extname(node.filePath).toLowerCase();
  const isDesigner = ext === '.xml';
  const objectDir = isDesigner ? node.filePath.slice(0, -ext.length)
    : ext === '.mdo' ? path.dirname(node.filePath) : node.filePath;
  const metadataFile = isDesigner || ext === '.mdo' ? node.filePath : path.join(objectDir, descriptor.edtFileName);
  let reference: unknown;
  try {
    const parsed = await XmlParser.parseFileAsync(metadataFile);
    const root = parsed.MetaDataObject && typeof parsed.MetaDataObject === 'object'
      ? parsed.MetaDataObject as Record<string, unknown> : parsed;
    const holder = Object.values(root).find(value => value && typeof value === 'object' && !Array.isArray(value)) as Record<string, unknown> | undefined;
    const properties = holder?.Properties && typeof holder.Properties === 'object'
      ? holder.Properties as Record<string, unknown> : holder;
    reference = properties?.DefaultObjectForm ?? properties?.defaultObjectForm;
    if (reference && typeof reference === 'object') reference = (reference as Record<string, unknown>)['#text'];
  } catch {
    void vscode.window.showWarningMessage(`Не удалось прочитать метаданные объекта: ${metadataFile}`);
    return;
  }
  const prefix = `${descriptor.designerRootTag}.${node.name}.Form.`;
  const text = typeof reference === 'string' ? reference.trim() : '';
  const name = text.startsWith(prefix) ? text.slice(prefix.length) : '';
  const match = name && !/[./\\]/.test(name) && name !== '..' ? name : null;
  if (!match) {
    void vscode.window.showInformationMessage('Основная форма объекта не назначена или её ссылка не распознана.');
    return;
  }
  const formDir = path.join(objectDir, 'Forms', match);
  const moduleFile = isDesigner ? path.join(formDir, 'Ext', 'Form', 'Module.bsl') : path.join(formDir, 'Module.bsl');
  if (!(await fs.stat(moduleFile).then(s => s.isFile(), () => false))) {
    void vscode.window.showInformationMessage(`Модуль основной формы объекта не найден: ${moduleFile}`);
    return;
  }
  await vscode.window.showTextDocument(vscode.Uri.file(moduleFile), { preview: false });
}
// 1C-MetadataTree: end fork-owned default object form module command.
