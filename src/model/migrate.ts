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
 * Repairs a same-version data drift, not a schema migration: between
 * `580d5e6` (2026-09-14, the production deploy) and `9ab8e64` (2026-09-17,
 * "make Quantity structured") the live app saved a token's `quantity` as a
 * label-only `{ iconId, label: "3 kg" }` shape - identical to
 * `TokenAttachment`, missing the `amount`/`unit` fields `QuantityAttachment`
 * now requires - while `CURRENT_SCHEMA_VERSION` stayed `1` throughout, so
 * there's no version bump to hang a migration step off (see
 * docs/known-issues.md's "Quantity amount/unit representation" entry).
 * `isValidToken` above doesn't deep-validate `quantity`'s shape at all, so a
 * document carrying one of these loads and imports without error, but
 * `QuantityForm`'s `value?.amount ?? 1` fallback then silently shows "1 g"
 * for whatever amount/unit the user actually entered.
 *
 * Every such label was always built as exactly `${amount} ${unit}` from a
 * validated integer `amount` and one of `EU_FOOD_UNITS`' space-free values
 * (confirmed against `TokenDetails.tsx` as it existed in that window, commit
 * `9121c37`) - so splitting on the first space losslessly recovers the
 * original amount/unit; this isn't a best-effort re-parse of arbitrary text,
 * it's inverting a value this app itself always produced in that one exact
 * shape. Only a shape that window could never have actually produced (no
 * space, or a non-integer leading token) falls back to dropping the
 * quantity entirely, rather than guessing at a default.
 */
function repairLegacyQuantity(token: InstructionToken): InstructionToken {
  const q = token.quantity as unknown;
  if (!isPlainObject(q) || typeof q.iconId !== "string" || typeof q.label !== "string") {
    return token;
  }
  if (typeof q.amount === "number" && typeof q.unit === "string") {
    return token; // already structured
  }

  const spaceIndex = q.label.indexOf(" ");
  const amount = spaceIndex === -1 ? NaN : Number(q.label.slice(0, spaceIndex));
  const unit = spaceIndex === -1 ? "" : q.label.slice(spaceIndex + 1);
  if (!Number.isInteger(amount) || unit === "") {
    // `undefined`, not key deletion - matches how `setTokenAttachment`
    // (state/document.ts) already represents "no attachment of this kind".
    return { ...token, quantity: undefined };
  }
  return { ...token, quantity: { iconId: q.iconId, label: q.label, amount, unit } };
}

/**
 * Upgrades a parsed JSON document to `CURRENT_SCHEMA_VERSION`, validating its
 * shape first. Unlike the trusted, own-written documents `state/persistence.ts`
 * loads back from IndexedDB, a file handed to the Phase 2 task 19 import flow
 * can be hand-edited, corrupted, or unrelated JSON entirely - this can't just
 * cast `unknown` to `InstructionDocument` and hope, so it checks the fields
 * the app actually relies on and throws a descriptive, user-safe-to-display
 * error instead of letting a malformed document silently corrupt app state.
 * Deliberately not exhaustive (optional per-token fields like `time` aren't
 * deep-validated at all; `quantity` gets a narrow same-version repair via
 * `repairLegacyQuantity` below, not full validation) - the goal is catching
 * realistic corruption (missing/renamed required fields, wrong types), not
 * enforcing a full schema.
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
  // there's no *version* migration chain to run yet - once a v2 ships, an
  // older document gets walked through migrateV1toV2 (etc.) here, before the
  // shape checks below validate the *upgraded* shape. `repairLegacyQuantity`
  // below is a different thing: a same-version data-shape repair, applied
  // after the structural checks so it only ever runs on already-valid steps.

  if (
    !isPlainObject(doc.meta) ||
    typeof doc.meta.title !== "string" ||
    typeof doc.meta.domain !== "string" ||
    typeof doc.meta.createdAt !== "string"
  ) {
    fail("missing or invalid meta (title/domain/createdAt)");
  }

  if (!Array.isArray(doc.steps) || !doc.steps.every(isValidStep)) {
    fail("missing or invalid steps");
  }

  const steps = (doc.steps as InstructionStep[]).map((step) => ({
    ...step,
    tokens: step.tokens.map(repairLegacyQuantity),
  }));

  return { ...doc, steps } as unknown as InstructionDocument;
}
