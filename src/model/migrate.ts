import { CURRENT_SCHEMA_VERSION, type InstructionDocument } from "./instruction";

/**
 * Upgrades a parsed JSON document to CURRENT_SCHEMA_VERSION.
 *
 * Phase 1 stub: schema version 1 is the only version that has ever existed,
 * so there is nothing to migrate yet. Phase 2 task 19 (Create Import System)
 * will add one small migration function per version bump here (e.g.
 * migrateV1toV2), applied in a chain keyed off `schemaVersion`, and will
 * reject documents newer than CURRENT_SCHEMA_VERSION instead of guessing.
 */
export function migrate(doc: unknown): InstructionDocument {
  const candidate = doc as InstructionDocument;

  if (candidate.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema version: ${candidate.schemaVersion}. ` +
        `Migration chain not implemented until Phase 2.`,
    );
  }

  return candidate;
}
