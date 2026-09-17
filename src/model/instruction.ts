/**
 * The instruction data model — see docs/phase-1/architecture.md section 2
 * for the full design rationale. Every type here is plain, JSON-serializable
 * data with no behavior, so a document round-trips through JSON.stringify/
 * parse cleanly for the Phase 2 export/import tasks.
 */

/** Bumped whenever a breaking change is made to any type in this file. */
export const CURRENT_SCHEMA_VERSION = 1;

export type TokenCategory =
  | "action"
  | "object"
  | "tool"
  | "quantity"
  | "warning"
  | "time";

/**
 * A small icon+label attached *to* another token, rather than standing on
 * its own in a step's token list - e.g. a "2 cups" quantity or a "Sharp!"
 * warning attached to a "Chop" action. Deliberately lighter than
 * `InstructionToken`: it has no `id` (it isn't independently ordered,
 * dragged, or connector-line-endpointed - see docs/planned-additions.md #1,
 * which this implements) and no `note`/`metadata` (nothing today needs a
 * user note on an attachment itself; add if that changes).
 */
export interface TokenAttachment {
  iconId: string;
  label?: string;
}

/**
 * A duration attached to either a token or a step (see InstructionStep.time
 * and InstructionToken.time) - a specialized attachment, not a
 * `TokenAttachment`, because a step's displayed duration needs to *sum*
 * several of these (its own tokens' times) when it has no explicit time of
 * its own, which needs the raw second count, not just the already-formatted
 * display string.
 */
export interface DurationAttachment {
  iconId: string;
  /** Pre-formatted "XXd-XXh-XXm-XXs" for display - see lib/duration.ts. */
  label: string;
  /** Total whole seconds this duration represents - 1 to 99*86400 (99 days). */
  seconds: number;
}

/**
 * A quantity attached to a token (see InstructionToken.quantity) - a
 * specialized attachment, not a `TokenAttachment`, for the same reason
 * `DurationAttachment` isn't: the edit form (TokenDetails' QuantityForm)
 * needs the raw `amount`/`unit` back to pre-fill itself, not just the
 * already-formatted "3 kg" display string. Storing them structurally
 * replaces an earlier version that stored only `label` and reverse-parsed
 * it (`splitQuantity`, split on the first space) to re-open the edit form -
 * a best-effort parse that silently fell back to a default whenever a unit
 * contained a space or didn't match `EU_FOOD_UNITS`.
 */
export interface QuantityAttachment {
  iconId: string;
  /** Pre-formatted "<amount> <unit>" for display - see lib/quantity.ts. */
  label: string;
  amount: number;
  unit: string;
}

/** A single placed icon+label unit — the atomic building block of a step. */
export interface InstructionToken {
  /** Stable unique id within the document. */
  id: string;
  category: TokenCategory;
  /** References an icon in the icon library by id — never inlined SVG. */
  iconId: string;
  /** Optional human-readable text shown alongside/under the icon. */
  label?: string;
  /** Optional user-authored note, separate from the app-given description in sample-tokens.ts. */
  note?: string;
  /**
   * At most one of each kind, attached to this token (not standalone in the
   * step's token list) and rendered as a small badge on its chip rather than
   * its own chip - see TokenDetails' Quantity/Warning fields and
   * InstructionCanvas's chip-badge rendering. Adding a new one of the same
   * kind replaces the old one, rather than allowing several of the same
   * kind at once.
   */
  quantity?: QuantityAttachment;
  warning?: TokenAttachment;
  /**
   * A token's own estimated duration - set independently of the step's own
   * `time` below (a user who doesn't know each token's individual timing can
   * still estimate the step as a whole). Not shown as a chip badge - see
   * InstructionCanvas's step-level duration header, which uses this only to
   * compute a step's total when the step has no explicit time of its own.
   */
  time?: DurationAttachment;
  /**
   * Free-form, category-specific data. Kept generic so Phase 4 content
   * packs can extend it without changing this interface.
   */
  metadata?: Record<string, string | number | boolean>;
}

/** One step in the instruction sequence. */
export interface InstructionStep {
  id: string;
  tokens: InstructionToken[];
  /** Short user-authored name shown in the step list (e.g. "Chop the onion"). */
  title?: string;
  /** Optional free text shown in "detailed instructions with text" export mode. */
  description?: string;
  /**
   * The step's own estimated duration, set directly rather than derived from
   * its tokens - takes precedence over the tokens' summed time when both
   * exist (see InstructionCanvas's step-level duration header).
   */
  time?: DurationAttachment;
}

/** Top-level metadata about the instruction set, independent of domain. */
export interface InstructionMeta {
  title: string;
  /** e.g. "recipe", "assembly", "safety" — a free string until Phase 4 turns it into a content-pack id. */
  domain: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * The root document — this is exactly what gets saved (Phase 2 task 12)
 * and exported/imported as JSON (Phase 2 tasks 18, 19).
 */
export interface InstructionDocument {
  schemaVersion: number;
  meta: InstructionMeta;
  steps: InstructionStep[];
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Creates a blank document for a fresh session. Used by state/document.ts. */
export function createEmptyDocument(): InstructionDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: {
      title: "Untitled instructions",
      domain: "recipe",
      createdAt: now,
      updatedAt: now,
    },
    steps: [createEmptyStep()],
  };
}

export function createEmptyStep(): InstructionStep {
  return { id: newId(), tokens: [] };
}

export function createToken(
  category: TokenCategory,
  iconId: string,
  label?: string,
): InstructionToken {
  return { id: newId(), category, iconId, label };
}
