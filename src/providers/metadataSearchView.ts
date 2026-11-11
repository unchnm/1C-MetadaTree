// 1C-MetadataTree: begin fork-owned temporary search input for the native tree.
import * as vscode from 'vscode';
import type { MetadataTreeDataProvider } from './treeDataProvider';

/** Temporary VS Code input for filtering the native metadata tree. */
export class MetadataSearchView implements vscode.Disposable {
  private input?: vscode.InputBox;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(private readonly tree: MetadataTreeDataProvider) {}

  open(): void {
    if (this.input) { this.input.show(); return; }
    const input = vscode.window.createInputBox();
    this.input = input;
    input.title = 'Поиск по метаданным';
    input.placeholder = 'Имя, синоним или комментарий';
    input.value = this.tree.getSearchQuery();
    input.valueSelection = [input.value.length, input.value.length];
    const apply = () => {
      clearTimeout(this.timer);
      this.timer = undefined;
      if (this.tree.getSearchQuery() !== input.value.trim()) this.tree.setSearchQuery(input.value);
    };
    input.onDidChangeValue(() => {
      clearTimeout(this.timer);
      this.timer = setTimeout(apply, 250);
    });
    input.onDidAccept(() => input.hide());
    input.onDidHide(() => {
      if (this.timer) apply();
      if (this.input === input) this.input = undefined;
      input.dispose();
    });
    input.show();
  }

  clear(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.input) this.input.value = '';
    this.tree.setSearchQuery('');
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.input?.dispose();
    this.input = undefined;
  }
}
// 1C-MetadataTree: end fork-owned temporary search input.
