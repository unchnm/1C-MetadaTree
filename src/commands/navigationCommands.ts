import * as vscode from 'vscode';
import type { TreeNavigationContext } from '../extension/extensionFeatureContexts';
import { MetadataType, TreeNode } from '../models/treeNode';
import { locateMetadataFile } from '../services/metadataFileLocator';
import { MESSAGES } from '../constants/messages';

type RegisterNavigationCommandsDeps = {
  state: TreeNavigationContext;
};

async function findFirstFormNode(
  state: TreeNavigationContext,
  element: TreeNode
): Promise<TreeNode | null> {
  if (element.type === MetadataType.Form) {
    return element;
  }
  const children = await state.treeDataProvider.getChildren(element);
  for (const child of children) {
    const found = await findFirstFormNode(state, child);
    if (found) {
      return found;
    }
  }
  return null;
}

export function registerNavigationCommands(
  deps: RegisterNavigationCommandsDeps
): vscode.Disposable[] {
  const { state } = deps;

  const focusTreeCommand = vscode.commands.registerCommand(
    '1c-metadata-tree.focus',
    async () => {
      let root = state.treeDataProvider.getRootNode();
      if (!root) {
        await new Promise((r) => setTimeout(r, 200));
        root = state.treeDataProvider.getRootNode();
      }
      if (!root) {
        await new Promise((r) => setTimeout(r, 400));
        root = state.treeDataProvider.getRootNode();
      }
      if (!root) {
        return;
      }
      const formNode = await findFirstFormNode(state, root);
      const nodeToReveal = formNode ?? root;
      await state.treeView.reveal(nodeToReveal, { focus: true });
    }
  );

  const clearSearchCommand = vscode.commands.registerCommand(
    '1c-metadata-tree.clearSearch',
    () => {
      state.treeDataProvider.clearSearch();
      vscode.commands.executeCommand('setContext', 'subsystemFilterActive', false);
    }
  );

  const nextMatchCommand = vscode.commands.registerCommand(
    '1c-metadata-tree.nextMatch',
    () => {
      const ids = state.treeDataProvider.getVisibleOrderedNodeIds();
      if (ids.length === 0) {
        return;
      }
      const sel = state.treeView.selection[0];
      const currentId = sel?.id;
      const idx = currentId ? ids.indexOf(currentId) : -1;
      const nextIdx = idx < ids.length - 1 ? idx + 1 : 0;
      const nextId = ids[nextIdx];
      const node = state.treeDataProvider.findNodeById(nextId);
      if (node) {
        state.treeView.reveal(node, { select: true, focus: true });
      }
    }
  );

  const previousMatchCommand = vscode.commands.registerCommand(
    '1c-metadata-tree.previousMatch',
    () => {
      const ids = state.treeDataProvider.getVisibleOrderedNodeIds();
      if (ids.length === 0) {
        return;
      }
      const sel = state.treeView.selection[0];
      const currentId = sel?.id;
      const idx = currentId ? ids.indexOf(currentId) : -1;
      const prevIdx = idx > 0 ? idx - 1 : ids.length - 1;
      const prevId = ids[prevIdx];
      const node = state.treeDataProvider.findNodeById(prevId);
      if (node) {
        state.treeView.reveal(node, { select: true, focus: true });
      }
    }
  );

  // 1C-MetadataTree: begin active-file reveal adjustment.
  // Reveal active files after considering the current tree filter.
  const revealActiveFileCommand = vscode.commands.registerCommand(
    '1c-metadata-tree.revealActiveFileInTree',
    async () => {
      const uri =
        vscode.window.activeTextEditor?.document.uri ??
        state.formEditorProvider.getActiveDocumentUri();
      if (!uri) {
        vscode.window.showInformationMessage(MESSAGES.REVEAL_NO_ACTIVE_EDITOR);
        return;
      }
      if (uri.scheme !== 'file') {
        vscode.window.showInformationMessage(MESSAGES.REVEAL_NOT_FILE_URI);
        return;
      }
      const configRoots = state.treeDataProvider.getConfigRootPaths();
      if (configRoots.length === 0) {
        vscode.window.showInformationMessage(MESSAGES.REVEAL_NO_CONFIG_LOADED);
        return;
      }
      const loc = locateMetadataFile(uri.fsPath, configRoots);
      if (loc === null) {
        vscode.window.showInformationMessage(MESSAGES.REVEAL_NOT_FOUND_IN_METADATA);
        return;
      }
      if (state.treeDataProvider.hasActiveFilter()) {
        const choice = await vscode.window.showInformationMessage(
          MESSAGES.REVEAL_FILTER_ACTIVE_PROMPT,
          MESSAGES.REVEAL_RESET_BUTTON,
          MESSAGES.REVEAL_CANCEL_BUTTON
        );
        if (choice === MESSAGES.REVEAL_RESET_BUTTON) {
          state.treeDataProvider.clearSearch();
          await vscode.commands.executeCommand('setContext', 'subsystemFilterActive', false);
        } else {
          // Cancel or Escape — skip reveal on potentially hidden node
          return;
        }
      }
      const node = await state.treeDataProvider.findNodeByLocation(loc);
      if (node === null) {
        vscode.window.showInformationMessage(MESSAGES.REVEAL_NODE_NOT_FOUND);
        return;
      }
      await state.treeView.reveal(node, { select: true, focus: true, expand: 1 });
    }
  );
  // 1C-MetadataTree: end active-file reveal adjustment.

  return [
    focusTreeCommand,
    clearSearchCommand,
    nextMatchCommand,
    previousMatchCommand,
    revealActiveFileCommand,
  ];
}
