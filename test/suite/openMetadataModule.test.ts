import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { installVscodeModuleStubForCoreTests, resetVscodeTestState, vscodeTestState } from '../helpers/vscodeModuleStub';
import { MetadataType, type TreeNode } from '../../src/models/treeNode';

installVscodeModuleStubForCoreTests();
const vscode = require('vscode') as typeof import('vscode');
const { openMetadataModule } = require('../../src/commands/openMetadataModule') as typeof import('../../src/commands/openMetadataModule');
const { openDefaultObjectFormModule } = require('../../src/commands/openDefaultObjectFormModule') as typeof import('../../src/commands/openDefaultObjectFormModule');

suite('openMetadataModule', () => {
  let root: string;
  let opened: string[];
  let original: typeof vscode.window.showTextDocument;
  setup(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'metadata-module-'));
    opened = [];
    resetVscodeTestState();
    original = vscode.window.showTextDocument;
    (vscode.window as unknown as { showTextDocument: unknown }).showTextDocument = async (uri: { fsPath: string }) => { opened.push(uri.fsPath); };
  });
  teardown(async () => {
    (vscode.window as unknown as { showTextDocument: unknown }).showTextDocument = original;
    await fs.rm(root, { recursive: true, force: true });
  });
  const node = (type: MetadataType, filePath: string): TreeNode => ({ id: 'test', name: 'test', type, filePath, properties: {} });
  async function makeFile(file: string): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '');
  }
  test('opens designer object and manager modules', async () => {
    const file = path.join(root, 'Catalogs', 'Goods', 'Ext', 'ManagerModule.bsl');
    await makeFile(file);
    await openMetadataModule(node(MetadataType.Catalog, path.join(root, 'Catalogs', 'Goods.xml')), 'ManagerModule');
    assert.deepStrictEqual(opened, [file]);
  });
  test('opens EDT object module', async () => {
    const dir = path.join(root, 'src', 'Catalogs', 'Goods');
    const file = path.join(dir, 'ObjectModule.bsl');
    await makeFile(file);
    await openMetadataModule(node(MetadataType.Catalog, dir), 'ObjectModule');
    assert.deepStrictEqual(opened, [file]);
  });
  test('opens designer form module', async () => {
    const file = path.join(root, 'Forms', 'Main', 'Ext', 'Form', 'Module.bsl');
    await makeFile(file);
    await openMetadataModule(node(MetadataType.Form, path.join(root, 'Forms', 'Main.xml')), 'FormModule');
    assert.deepStrictEqual(opened, [file]);
  });
  test('opens the assigned Designer object form module, regardless of its name', async () => {
    const xml = path.join(root, 'Documents', 'Act.xml');
    await makeFile(xml);
    await fs.writeFile(xml, '<MetaDataObject><Document><Properties><DefaultListForm>Document.Act.Form.List</DefaultListForm><DefaultObjectForm>Document.Act.Form.MyCustomForm</DefaultObjectForm></Properties></Document></MetaDataObject>');
    const file = path.join(root, 'Documents', 'Act', 'Forms', 'MyCustomForm', 'Ext', 'Form', 'Module.bsl');
    await makeFile(file);
    await openDefaultObjectFormModule({ ...node(MetadataType.Document, xml), name: 'Act' });
    assert.deepStrictEqual(opened, [file]);
  });
  test('opens the assigned EDT object form module', async () => {
    const dir = path.join(root, 'Catalogs', 'Goods');
    const mdo = path.join(dir, 'Catalog.mdo');
    await makeFile(mdo);
    await fs.writeFile(mdo, '<mdclass:Catalog><defaultObjectForm>Catalog.Goods.Form.Card</defaultObjectForm></mdclass:Catalog>');
    const file = path.join(dir, 'Forms', 'Card', 'Module.bsl');
    await makeFile(file);
    await openDefaultObjectFormModule({ ...node(MetadataType.Catalog, dir), name: 'Goods' });
    assert.deepStrictEqual(opened, [file]);
  });
  test('explains when a object form is not assigned', async () => {
    const xml = path.join(root, 'Catalogs', 'Goods.xml');
    await makeFile(xml);
    await fs.writeFile(xml, '<MetaDataObject><Catalog><Properties><DefaultObjectForm/></Properties></Catalog></MetaDataObject>');
    await openDefaultObjectFormModule(node(MetadataType.Catalog, xml));
    assert.deepStrictEqual(opened, []);
    assert.match(vscodeTestState.informationLog.at(-1) ?? '', /не назначена/);
  });
  test('explains when an assigned object form module is missing', async () => {
    const xml = path.join(root, 'Documents', 'Act.xml');
    await makeFile(xml);
    await fs.writeFile(xml, '<MetaDataObject><Document><Properties><DefaultObjectForm>Document.Act.Form.Missing</DefaultObjectForm></Properties></Document></MetaDataObject>');
    await openDefaultObjectFormModule({ ...node(MetadataType.Document, xml), name: 'Act' });
    assert.deepStrictEqual(opened, []);
    assert.match(vscodeTestState.informationLog.at(-1) ?? '', /Модуль.*не найден/);
  });
  test('does not open a similarly named form belonging to a different object', async () => {
    const xml = path.join(root, 'Documents', 'Act.xml');
    await makeFile(xml);
    await fs.writeFile(xml, '<MetaDataObject><Document><Properties><DefaultObjectForm>Document.Other.Form.List</DefaultObjectForm></Properties></Document></MetaDataObject>');
    await makeFile(path.join(root, 'Documents', 'Act', 'Forms', 'List', 'Ext', 'Form', 'Module.bsl'));
    await openDefaultObjectFormModule({ ...node(MetadataType.Document, xml), name: 'Act' });
    assert.deepStrictEqual(opened, []);
    assert.match(vscodeTestState.informationLog.at(-1) ?? '', /не распознана/);
  });
  test('opens the configuration session module', async () => {
    const file = path.join(root, 'Ext', 'SessionModule.bsl');
    await makeFile(file);
    await openMetadataModule(node(MetadataType.Configuration, path.join(root, 'Configuration.xml')), 'SessionModule');
    assert.deepStrictEqual(opened, [file]);
  });
  test('opens the EDT configuration application module', async () => {
    const dir = path.join(root, 'src', 'Configuration');
    const file = path.join(dir, 'ManagedApplicationModule.bsl');
    await makeFile(file);
    await openMetadataModule(node(MetadataType.Configuration, path.join(dir, 'Configuration.mdo')), 'ApplicationModule');
    assert.deepStrictEqual(opened, [file]);
  });
  test('does not create a missing module', async () => {
    const target = path.join(root, 'Catalogs', 'Goods.xml');
    await openMetadataModule(node(MetadataType.Catalog, target), 'ManagerModule');
    assert.deepStrictEqual(opened, []);
    assert.strictEqual(vscodeTestState.informationLog.at(-1), 'Файл модуля не найден.');
    assert.deepStrictEqual(await fs.readdir(root), []);
  });
});
