import { chatCompletionJSON, isAIConfigured } from "./ai";
import { prisma } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CompiledRule = {
  field: string;
  operator: "gt" | "lt" | "gte" | "lte" | "eq" | "neq" | "contains" | "in";
  value: string | number | boolean;
  label: string;
};

export type ReasoningNode = {
  rule: string;
  passed: boolean;
  detail: string;
  children?: ReasoningNode[];
};

export type CompilationResult = {
  rules: CompiledRule[];
  reasoningTree: ReasoningNode;
  explanation: string;
  version: number;
};

// ─── NL Policy Compiler ───────────────────────────────────────────────────────

const COMPILER_SYSTEM_PROMPT = `You are the Maverick Certification Hub Policy Compiler.
Your job is to convert natural-language eligibility rules into executable JSON rules.

Given free-form eligibility text from an L&D manager, produce a JSON object with:
{
  "rules": [
    { "field": "tenureDays|trainingCompleted|priorAttempts|budget|businessUnit|examTrack|location", 
      "operator": "gt|lt|gte|lte|eq|neq|in",
      "value": <number|string|boolean>,
      "label": "Human-readable label" }
  ],
  "explanation": "Plain English summary of the compiled rules",
  "reasoningTemplate": {
    "rule": "Overall eligibility check",
    "passed": false,
    "detail": "Evaluated against all criteria",
    "children": [
      { "rule": "<rule label>", "passed": false, "detail": "<evaluation detail>" }
    ]
  }
}

Supported fields: tenureDays, trainingCompleted, priorAttempts, budget, businessUnit, examTrack, location
Supported operators: gt (>), lt (<), gte (>=), lte (<=), eq (==), neq (!=), in (contained in list)

Always return valid JSON. No markdown. No explanation outside JSON.`;

export async function compileNLRules(
  naturalLanguage: string,
  driveId?: string
): Promise<CompilationResult> {
  if (isAIConfigured()) {
    return await compileWithAI(naturalLanguage, driveId);
  }
  return compileWithFallback(naturalLanguage, driveId);
}

async function compileWithAI(
  naturalLanguage: string,
  driveId?: string
): Promise<CompilationResult> {
  const result = await chatCompletionJSON<{
    rules: CompiledRule[];
    explanation: string;
    reasoningTemplate: ReasoningNode;
  }>({
    system: COMPILER_SYSTEM_PROMPT,
    user: `Compile these eligibility rules:\n\n${naturalLanguage}`,
    temperature: 0.1,
    maxTokens: 2048,
  });

  // Get latest version
  const latest = await prisma.policyRule.findFirst({
    where: { driveId: driveId ?? null },
    orderBy: { version: "desc" },
  });
  const version = (latest?.version ?? 0) + 1;

  // Persist compiled rule
  const rule = await prisma.policyRule.create({
    data: {
      driveId: driveId ?? null,
      name: `Policy v${version}`,
      naturalLanguage,
      compiledJson: result.rules,
      version,
      isActive: true,
    },
  });

  return {
    rules: result.rules,
    reasoningTree: result.reasoningTemplate,
    explanation: result.explanation,
    version,
  };
}

// ─── Rule-based fallback (no AI) ─────────────────────────────────────────────

function compileWithFallback(
  naturalLanguage: string,
  driveId?: string
): CompilationResult {
  const text = naturalLanguage.toLowerCase();
  const rules: CompiledRule[] = [];

  // Extract tenure requirement
  const tenureMatch = text.match(/tenure\s*[>≥>=]+\s*(\d+)/);
  if (tenureMatch) {
    rules.push({
      field: "tenureDays",
      operator: "gte",
      value: parseInt(tenureMatch[1]),
      label: `Minimum tenure: ${tenureMatch[1]} days`,
    });
  }

  // Training requirement
  if (text.includes("training done") || text.includes("training completed") || text.includes("training required")) {
    rules.push({
      field: "trainingCompleted",
      operator: "eq",
      value: true,
      label: "Training must be completed",
    });
  }

  // Prior attempts
  const attemptsMatch = text.match(/(\d+)\s*failed?\s*attempt/i) ||
    text.match(/no more than\s*(\d+)/i) ||
    text.match(/max(?:imum)?\s*(\d+)\s*(?:failed)?\s*attempt/i);
  if (attemptsMatch) {
    rules.push({
      field: "priorAttempts",
      operator: "lt",
      value: parseInt(attemptsMatch[1]) + 1,
      label: `Max ${attemptsMatch[1]} failed attempt(s)`,
    });
  }

  // Business unit
  const buMatch = text.match(/bu\s*=\s*(\w+)/i) || text.match(/business\s*unit\s*=\s*(\w+)/i);
  if (buMatch) {
    rules.push({
      field: "businessUnit",
      operator: "eq",
      value: buMatch[1],
      label: `Business Unit: ${buMatch[1]}`,
    });
  }

  // Budget
  const budgetMatch = text.match(/budget\s*[>≥>=]+\s*(\d+)/);
  if (budgetMatch) {
    rules.push({
      field: "budget",
      operator: "gte",
      value: parseInt(budgetMatch[1]),
      label: `Minimum budget: $${budgetMatch[1]}`,
    });
  }

  // Default rules if nothing parsed
  if (rules.length === 0) {
    rules.push(
      { field: "tenureDays", operator: "gte", value: 90, label: "Minimum tenure: 90 days" },
      { field: "trainingCompleted", operator: "eq", value: true, label: "Training must be completed" },
      { field: "priorAttempts", operator: "lt", value: 3, label: "Max 2 failed attempts" }
    );
  }

  const reasoningTree: ReasoningNode = {
    rule: "Overall eligibility check",
    passed: false,
    detail: `Evaluating ${rules.length} criteria`,
    children: rules.map((r) => ({
      rule: r.label,
      passed: false,
      detail: `Check: ${r.field} ${r.operator} ${r.value}`,
    })),
  };

  return {
    rules,
    reasoningTree,
    explanation: `Compiled ${rules.length} rule(s) from natural language. ${
      isAIConfigured() ? "" : "(Rule-based fallback — configure Azure OpenAI for full AI compilation)"
    }`,
    version: 1,
  };
}

// ─── Evaluate a candidate against compiled rules ──────────────────────────────

export type EvaluationResult = {
  passed: boolean;
  reasoningTree: ReasoningNode;
  explanation: string;
};

export function evaluateAgainstRules(
  rules: CompiledRule[],
  candidate: {
    tenureDays: number;
    trainingCompleted: boolean;
    priorAttempts: number;
    businessUnit: string;
    examTrack?: string;
    location?: string;
    budget?: number;
  }
): EvaluationResult {
  const children: ReasoningNode[] = [];
  let allPassed = true;

  for (const rule of rules) {
    const candidateValue = (candidate as Record<string, unknown>)[rule.field];
    let passed = false;

    switch (rule.operator) {
      case "gt": passed = Number(candidateValue) > Number(rule.value); break;
      case "lt": passed = Number(candidateValue) < Number(rule.value); break;
      case "gte": passed = Number(candidateValue) >= Number(rule.value); break;
      case "lte": passed = Number(candidateValue) <= Number(rule.value); break;
      case "eq": passed = candidateValue === rule.value; break;
      case "neq": passed = candidateValue !== rule.value; break;
      case "in": passed = String(rule.value).split(",").map(s => s.trim()).includes(String(candidateValue)); break;
      default: passed = false;
    }

    if (!passed) allPassed = false;

    children.push({
      rule: rule.label,
      passed,
      detail: passed
        ? `${rule.field}=${candidateValue} meets ${rule.operator} ${rule.value}`
        : `${rule.field}=${candidateValue} does NOT meet ${rule.operator} ${rule.value}`,
    });
  }

  return {
    passed: allPassed,
    reasoningTree: {
      rule: "Overall eligibility check",
      passed: allPassed,
      detail: allPassed ? "All criteria met" : "One or more criteria not met",
      children,
    },
    explanation: allPassed
      ? "Candidate meets all eligibility criteria."
      : `Candidate failed ${children.filter((c) => !c.passed).length} of ${children.length} criteria.`,
  };
}

// ─── Get active policy for a drive ────────────────────────────────────────────

export async function getActivePolicy(driveId: string): Promise<CompiledRule[] | null> {
  const rule = await prisma.policyRule.findFirst({
    where: { driveId, isActive: true },
    orderBy: { version: "desc" },
  });
  if (!rule) return null;
  return rule.compiledJson as unknown as CompiledRule[];
}
