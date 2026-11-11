import * as assert from 'assert';
import { installVscodeModuleStubForCoreTests } from '../helpers/vscodeModuleStub';
installVscodeModuleStubForCoreTests();
const vscode = require('vscode') as typeof import('vscode');
const { MetadataSearchView } = require('../../src/providers/metadataSearchView') as typeof import('../../src/providers/metadataSearchView');

suite('metadata search input', () => {
  test('keeps the query when closed and reopened, and clears it on request', () => {
    let query = 'Документ';
    const tree = {
      getSearchQuery: () => query,
      setSearchQuery: (q: string) => { query = q; },
      setSearchOptions: () => undefined,
    };
    let input: any;
    const original = vscode.window.createInputBox;
    (vscode.window as any).createInputBox = () => {
      let change: () => void = () => undefined;
      let hide: () => void = () => undefined;
      input = {
        value: '', show() {}, dispose() {},
        onDidChangeValue(cb: () => void) { change = cb; },
        onDidAccept() {}, onDidHide(cb: () => void) { hide = cb; },
        type(value: string) { this.value = value; change(); },
        hide() { hide(); },
      };
      return input;
    };
    try {
      const search = new MetadataSearchView(tree as never);
      search.open();
      assert.strictEqual(input.value, 'Документ');
      input.type('Товар');
      input.hide(); // closing immediately must also apply the pending input
      assert.strictEqual(query, 'Товар');
      search.open();
      assert.strictEqual(input.value, 'Товар');
      input.type('Новый запрос');
      search.clear();
      input.hide();
      assert.strictEqual(query, '');
      search.open();
      assert.strictEqual(input.value, '');
      search.dispose();
    } finally { (vscode.window as any).createInputBox = original; }
  });
});
