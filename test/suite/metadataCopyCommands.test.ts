import * as assert from 'assert';
import { installVscodeModuleStubForCoreTests, resetVscodeTestState, vscodeTestState } from '../helpers/vscodeModuleStub';
import { MetadataType } from '../../src/models/treeNode';
installVscodeModuleStubForCoreTests();
const vscode = require('vscode') as typeof import('vscode');
const { registerUtilityCommandsTrailing } = require('../../src/commands/utilityCommands') as typeof import('../../src/commands/utilityCommands');

suite('metadata copy commands', () => {
  test('copies the requested field and does not substitute a name for a missing path', async () => {
    resetVscodeTestState();
    const clipboard: string[] = [];
    const env = vscode.env as unknown as { clipboard?: unknown };
    const original = env.clipboard;
    env.clipboard = { writeText: async (value: string) => { clipboard.push(value); } };
    const disposables = registerUtilityCommandsTrailing({ state: { treeView: { selection: [] } }, extensionContext: {} } as never);
    try {
      const node = { id: 'Catalogs.Goods', name: 'Goods', type: MetadataType.Catalog, filePath: '/project/Catalogs/Goods.xml', properties: {} };
      await vscodeTestState.registeredCommandHandlers.get('1c-metadata-tree.copyName')!(node);
      await vscodeTestState.registeredCommandHandlers.get('1c-metadata-tree.copyPath')!(node);
      await vscodeTestState.registeredCommandHandlers.get('1c-metadata-tree.copyPath')!({ ...node, filePath: undefined });
      assert.deepStrictEqual(clipboard, ['Goods', '/project/Catalogs/Goods.xml']);
      assert.match(vscodeTestState.informationLog.at(-1) ?? '', /путь к файлу не задан/);
    } finally {
      disposables.forEach(d => d.dispose());
      env.clipboard = original;
    }
  });
});
