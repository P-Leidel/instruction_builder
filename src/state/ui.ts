import { signal } from "@preact/signals";
import type { TokenCategory } from "../model/instruction";

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

/** Same idea as `activeTokenCategory`, but for TokenAttachmentPicker's own,
 * separate set of tabs (quantity/warning/time) - kept as a second signal
 * rather than reusing the one above so switching tabs in one picker never
 * affects the other. */
export const activeAttachmentCategory = signal<TokenCategory | null>(null);
