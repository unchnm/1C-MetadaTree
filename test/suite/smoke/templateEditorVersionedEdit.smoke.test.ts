import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { TemplateEditorProvider, TEMPLATE_EDITOR_VIEW_TYPE } from '../../../src/templateEditor/templateEditorProvider';

suite('Smoke: template editor versioned edits', () => {
  test('applies through TextEditor.edit with only the custom editor open', async function () {
    this.timeout(30000);

    const extension = vscode.extensions.getExtension('unchnm.1c-metadata-tree');
    assert.ok(extension, 'extension must be available in the smoke host');
    if (!extension.isActive) {
      await extension.activate();
    }

    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), '1c-template-editor-versioned-'));
    const uri = vscode.Uri.file(path.join(tempDir, 'Template.xml'));
    let document: vscode.TextDocument | undefined;
    let customTab: vscode.Tab | undefined;
    try {
      await vscode.workspace.fs.writeFile(uri, Buffer.from('<root>old</root>', 'utf8'));
      document = await vscode.workspace.openTextDocument(uri);
      await vscode.commands.executeCommand('vscode.openWith', uri, TEMPLATE_EDITOR_VIEW_TYPE, { preview: false });

      const findCustomTab = (): vscode.Tab | undefined =>
        vscode.window.tabGroups.all.flatMap((group) => group.tabs).find(
          (tab) => tab.input instanceof vscode.TabInputCustom
            && tab.input.viewType === TEMPLATE_EDITOR_VIEW_TYPE
            && tab.input.uri.toString() === uri.toString()
        );
      const deadline = Date.now() + 10000;
      while (!customTab && Date.now() < deadline) {
        customTab = findCustomTab();
        if (!customTab) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      assert.ok(customTab, 'custom editor tab must be open');
      assert.ok(
        !vscode.window.visibleTextEditors.some((editor) => editor.document.uri.toString() === uri.toString()),
        'precondition: the custom editor is the only editor open for this document'
      );

      const provider = new TemplateEditorProvider(extension.extensionUri) as unknown as {
        applyEdit(document: vscode.TextDocument, message: unknown): Promise<boolean>;
      };
      const initialVersion = document.version;
      const applied = await provider.applyEdit(document, {
        type: 'edit',
        baseVersion: initialVersion,
        edits: [{ start: 6, end: 9, text: 'new' }],
      });

      assert.strictEqual(applied, true);
      const changeDeadline = Date.now() + 5000;
      while (document.version === initialVersion && Date.now() < changeDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.ok(document.version > initialVersion, 'TextEditor.edit must update the backing TextDocument');
      assert.strictEqual(document.getText(), '<root>new</root>');
      assert.ok(findCustomTab(), 'the custom editor remains open after the edit');
      const textTabRemains = vscode.window.tabGroups.all.flatMap((group) => group.tabs).some(
        (tab) => tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === uri.toString()
      );
      assert.ok(textTabRemains, 'the versioned editor remains available for further safe edits');
      const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
      assert.ok(
        activeTab?.input instanceof vscode.TabInputCustom && activeTab.input.uri.toString() === uri.toString(),
        'preserveFocus keeps the custom editor active'
      );
      await document.save();
    } finally {
      const saved = !document?.isDirty || await document.save();
      const openTab = vscode.window.tabGroups.all.flatMap((group) => group.tabs).find(
        (tab) => tab.input instanceof vscode.TabInputCustom
          && tab.input.viewType === TEMPLATE_EDITOR_VIEW_TYPE
          && tab.input.uri.toString() === uri.toString()
      );
      if (openTab && saved) {
        await vscode.window.tabGroups.close(openTab, true);
      }
      const textTab = vscode.window.tabGroups.all.flatMap((group) => group.tabs).find(
        (tab) => tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === uri.toString()
      );
      if (textTab && saved) {
        await vscode.window.tabGroups.close(textTab, true);
      }
      if (saved) {
        await removeTempDirectory(tempDir);
      }
    }
  });
});

async function removeTempDirectory(directory: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await fs.promises.rm(directory, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(code ?? '') || attempt === 4) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}
