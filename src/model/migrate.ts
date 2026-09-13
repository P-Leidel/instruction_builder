import {
  CURRENT_SCHEMA_VERSION,
  type InstructionDocument,
  type InstructionStep,
  type InstructionToken,
  type TokenCategory,
} from "./instruction";

const TOKEN_CATEGORIES: readonly TokenCategory[] = [
  "action",
  "object",
  "tool",
  "quantity",
  "warning",
  "time",
];

function fail(reason: string): never {
  throw new Error(`Not a valid instruction file: ${reason}.`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidToken(value: unknown): value is InstructionToken {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    typeof value.iconId === "string" &&
    TOKEN_CATEGORIES.includes(value.category as TokenCategory)
  );
}

function isValidStep(value: unknown): value is InstructionStep {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    Array.isArray(value.tokens) &&
    value.tokens.every(isValidToken)
  );
}

/**
 * Upgrades a parsed JSON document to `CURRENT_SCHEMA_VERSION`, validating its
 * shape first. Unlike the trusted, own-written documents `state/persistence.ts`
 * loads back from IndexedDB, a file handed to the Phase 2 task 19 import flow
 * can be hand-edited, corrupted, or unrelated JSON entirely - this can't just
 * cast `unknown` to `InstructionDocument` and hope, so it checks the fields
 * the app actually relies on and throws a descriptive, user-safe-to-display
 * error instead of letting a malformed document silently corrupt app state.
 * Deliberately not exhaustive (optional per-token fields like `quantity`/
 * `time` aren't deep-validated) - the goal is catching realistic corruption
 * (missing/renamed required fields, wrong types), not enforcing a full
 * schema.
 */
export function migrate(doc: unknown): InstructionDocument {
  if (!isPlainObject(doc)) fail("not a JSON object");
  if (typeof doc.schemaVersion !== "number") fail("missing a schemaVersion");
  if (doc.schemaVersion > CURRENT_SCHEMA_VERSION) {
    fail(
      `schemaVersion ${doc.schemaVersion} is newer than this app supports (${CURRENT_SCHEMA_VERSION}) - it was probably made with a newer version of this app`,
    );
  }
  // schemaVersion 1 is still the only version that has ever existed, so
  // there's no migration chain to run yet - once a v2 ships, an older
  // document gets walked through migrateV1toV2 (etc.) here, before the
  // shape checks below validate the *upgraded* shape.

  if (
    !isPlainObject(doc.meta) ||
    typeof doc.meta.title !== "string" ||
    typeof doc.meta.domain !== "string" ||
    typeof doc.meta.createdAt !== "string" ||
    typeof doc.meta.updatedAt !== "string"
  ) {
    fail("missing or invalid meta (title/domain/createdAt/updatedAt)");
  }

  if (!Array.isArray(doc.steps) || !doc.steps.every(isValidStep)) {
    fail("missing or invalid steps");
  }

  return doc as unknown as InstructionDocument;
}
