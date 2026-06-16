// ─── PII Redaction ────────────────────────────────────────────────────────────

const PII_PATTERNS = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "***-**-****", type: "SSN" },
  { pattern: /\b\d{16}\b/g, replacement: "****-****-****-****", type: "CreditCard" },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "[EMAIL]", type: "Email" },
  { pattern: /\b\d{10}\b/g, replacement: "[PHONE]", type: "Phone" },
  { pattern: /\b\d{1,5}\s+\w+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln)\b/gi, replacement: "[ADDRESS]", type: "Address" },
];

export function redactPII(text: string): string {
  let redacted = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

export function detectPII(text: string): string[] {
  const types: string[] = [];
  for (const { pattern, type } of PII_PATTERNS) {
    if (pattern.test(text)) {
      types.push(type);
    }
    pattern.lastIndex = 0; // reset regex state
  }
  return types;
}

// ─── Content Safety ───────────────────────────────────────────────────────────

const UNSAFE_CONTENT_PATTERNS = [
  { pattern: /\b(hack|exploit|bypass|override)\b/gi, severity: "medium" as const },
  { pattern: /\b(password|secret|private.?key|api.?key)\s*[=:]\s*\S+/gi, severity: "high" as const },
  { pattern: /\b(drop\s+table|delete\s+from|truncate)\b/gi, severity: "high" as const },
];

export type SafetyCheck = {
  safe: boolean;
  issues: { type: string; severity: "low" | "medium" | "high"; detail: string }[];
};

export function checkContentSafety(text: string): SafetyCheck {
  const issues: SafetyCheck["issues"] = [];

  for (const { pattern, severity } of UNSAFE_CONTENT_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      issues.push({
        type: "UnsafeContent",
        severity,
        detail: `Potentially unsafe pattern detected: ${matches[0]}`,
      });
    }
    pattern.lastIndex = 0;
  }

  const piiTypes = detectPII(text);
  if (piiTypes.length > 0) {
    issues.push({
      type: "PIIDetected",
      severity: "medium",
      detail: `PII detected: ${piiTypes.join(", ")}`,
    });
  }

  return {
    safe: issues.filter((i) => i.severity === "high").length === 0,
    issues,
  };
}

// ─── Kill Switch ──────────────────────────────────────────────────────────────

const killSwitches = new Map<string, boolean>();

export function setKillSwitch(agentType: string, enabled: boolean) {
  killSwitches.set(agentType, enabled);
}

export function isKillSwitchActive(agentType: string): boolean {
  return killSwitches.get(agentType) ?? false;
}

export function getAllKillSwitches() {
  const result: Record<string, boolean> = {};
  for (const [key, value] of killSwitches) {
    result[key] = value;
  }
  return result;
}

// ─── Risk-Tiered Autonomy ────────────────────────────────────────────────────

export type RiskTier = "auto" | "notify" | "approve";

const RISK_MATRIX: Record<string, RiskTier> = {
  // Drive agent
  "Drive:health-check": "auto",
  "Drive:publish": "approve",
  "Drive:activate": "notify",
  "Drive:close": "approve",
  
  // Compliance agent
  "Compliance:eligibility-audit": "auto",
  "Compliance:policy-override": "approve",
  
  // Voucher agent
  "Voucher:inventory-check": "auto",
  "Voucher:allocate": "notify",
  "Voucher:revoke": "approve",
  "Voucher:reclaim": "notify",
  
  // Comms agent
  "Comms:send": "auto",
  "Comms:sla-breach": "notify",
  
  // ROI agent
  "ROI:report": "auto",
  "ROI:forecast": "auto",
};

export function getRiskTier(agentType: string, action: string): RiskTier {
  return RISK_MATRIX[`${agentType}:${action}`] ?? "approve";
}

export function shouldAutoExecute(agentType: string, action: string): boolean {
  if (isKillSwitchActive(agentType)) return false;
  return getRiskTier(agentType, action) === "auto";
}

export function requiresApproval(agentType: string, action: string): boolean {
  return getRiskTier(agentType, action) === "approve";
}
