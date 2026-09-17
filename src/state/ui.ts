import { signal } from "@preact/signals";
import type { InstructionDocument, InstructionStep, InstructionToken, TokenCategory } from "../model/instruction";
import { copyToken } from "./document";

/**
 * Phase 2 task 8 (Live Preview): a document-wide view mode, separate from
 * `state/document.ts` since it's a UI concern, not part of the saved/exported
 * document. When true, `App` renders only a read-only `InstructionCanvas` -
 * the same SVG the editor uses, with every editing affordance (badges,
 * remove controls, selection) turned off, standing in for "what this would
 * look like exported" ahead of the real export pipeline (tasks 15-17).
 */
export const previewMode = signal(false);

/**
 * Which token-category tab TokenPicker currently shows. `null` means "no
 * explicit choice yet" - TokenPicker falls back to its first category with
 * samples, so this doesn't need to know the category list itself.
 */
export const activeTokenCategory = signal<TokenCategory | null>(null);

/**
 * A single dismissible status message shown below the toolbar (task 14's
 * link into tasks 18/19: a non-blocking warning when exporting/importing a
 * document with incomplete steps, plus JSON parse/shape errors on import
 * and an import success confirmation). Replacing it with a new value (or
 * `null`) is how a caller clears whatever was showing before - there's only
 * ever one on screen at a time, so nothing needs to be queued.
 */
export type ToastTone = "info" | "warning" | "error";
export interface Toast {
  text: string;
  tone: ToastTone;
}
export const toast = signal<Toast | null>(null);

/**
 * Copies `token` and shows the confirmation toast - the shared shape behind
 * both TokenDetails' Copy button and the global Ctrl/Cmd+C shortcut
 * (app.tsx), which used to each independently write out this same
 * `copyToken` + toast sequence (2026-09-17 audit remediation, finding
 * 4/item 11).
 */
export function copyTokenWithToast(step: InstructionStep, token: InstructionToken): void {
  copyToken(step.id, token.id);
  toast.value = { text: `Copied ${token.label || token.iconId}`, tone: "info" };
}

/**
 * A parsed, shape-validated file waiting on the user's explicit confirmation
 * before it replaces the current document (task 19) - set once
 * `parseImportedDocument` succeeds, cleared on either Replace or Cancel.
 * `incompleteCount` is precomputed (via `validateDocument`) so the confirm
 * dialog can mention it without re-running validation itself.
 */
export interface PendingImport {
  document: InstructionDocument;
  incompleteCount: number;
}
export const pendingImport = signal<PendingImport | null>(null);

/**
 * Task 28: true while `NewDocumentConfirmDialog` is open, waiting on the
 * user's explicit confirmation before the current document is replaced
 * with a blank one - set by the toolbar's "New" button, cleared on either
 * Start New or Cancel. Unlike `pendingImport`, there's no data to carry
 * alongside it (a new document is always the same blank
 * `createEmptyDocument()`), so a plain boolean is enough.
 */
export const confirmingNewDocument = signal(false);
