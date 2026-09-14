import type { InstructionDocument, InstructionStep } from "./instruction";

export interface StepValidationResult {
  stepId: string;
  isComplete: boolean;
  issues: string[];
}

/**
 * Phase 1 stub implementing only the single domain-agnostic rule from
 * docs/phase-1/architecture.md section 2.4 (a step needs at least one action
 * token) so StepList can show basic progress in the prototype. The full
 * rule set (quantity metadata checks, etc.) lands in Phase 2 task 14
 * (Implement Visual Validation).
 */
export function validateStep(step: InstructionStep): StepValidationResult {
  const issues: string[] = [];

  if (step.tokens.length === 0) {
    issues.push("Step is empty");
  } else if (!step.tokens.some((t) => t.category === "action")) {
    issues.push("Missing an action token");
  }

  return { stepId: step.id, isComplete: issues.length === 0, issues };
}

export function validateDocument(doc: InstructionDocument): StepValidationResult[] {
  return doc.steps.map(validateStep);
}
