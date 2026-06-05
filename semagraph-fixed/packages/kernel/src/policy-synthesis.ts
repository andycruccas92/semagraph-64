export type PolicySynthesisOrigin = "llm" | "human" | "system";

export type PolicySynthesisInput = {
  id: string;
  origin: PolicySynthesisOrigin;
  signature: string;
  requestedAt: string;
  constraints?: readonly string[];
  contextRefs?: readonly string[];
};

export type PolicySynthesisValidationIssue = {
  path: string;
  message: string;
};

export type PolicySynthesisValidationResult = {
  accepted: boolean;
  issues: readonly PolicySynthesisValidationIssue[];
};

export function validatePolicySynthesisInput(input: PolicySynthesisInput): PolicySynthesisValidationResult {
  const issues: PolicySynthesisValidationIssue[] = [];
  if (!input.id.trim()) issues.push({ path: "id", message: "Policy synthesis id is required." });
  if (!input.signature.trim()) issues.push({ path: "signature", message: "Computed transition signature is required." });
  if (!input.requestedAt.trim()) issues.push({ path: "requestedAt", message: "Request timestamp is required." });
  if (input.constraints?.some((constraint) => !constraint.trim())) {
    issues.push({ path: "constraints", message: "Constraints must not be empty strings." });
  }
  if (input.contextRefs?.some((reference) => !reference.trim())) {
    issues.push({ path: "contextRefs", message: "Context references must not be empty strings." });
  }
  return { accepted: issues.length === 0, issues };
}
