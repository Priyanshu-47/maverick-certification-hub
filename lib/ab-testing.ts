import { prisma } from "./db";
import type { CompiledRule, EvaluationResult, ReasoningNode } from "./policy-compiler";
import { evaluateAgainstRules } from "./policy-compiler";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PolicyVersion = {
  id: string;
  version: number;
  name: string;
  naturalLanguage: string;
  compiledRules: CompiledRule[];
  isActive: boolean;
  createdAt: Date;
};

export type ABTestResult = {
  policyA: PolicyVersion;
  policyB: PolicyVersion;
  totalCandidates: number;
  resultsA: { passed: number; failed: number; passRate: number };
  resultsB: { passed: number; failed: number; passRate: number };
  winner: "A" | "B" | "Tie";
  confidence: string;
  candidateDetails: Array<{
    candidateName: string;
    employeeId: string;
    resultA: boolean;
    resultB: boolean;
    difference: boolean;
  }>;
};

// ─── Policy Versioning ────────────────────────────────────────────────────────

export async function getPolicyVersions(driveId?: string): Promise<PolicyVersion[]> {
  const where = driveId ? { driveId } : {};
  const rules = await prisma.policyRule.findMany({
    where,
    orderBy: [{ version: "desc" }],
  });

  return rules.map((r) => ({
    id: r.id,
    version: r.version,
    name: r.name,
    naturalLanguage: r.naturalLanguage,
    compiledRules: r.compiledJson as unknown as CompiledRule[],
    isActive: r.isActive,
    createdAt: r.createdAt,
  }));
}

export async function activatePolicy(policyId: string): Promise<void> {
  const policy = await prisma.policyRule.findUnique({ where: { id: policyId } });
  if (!policy) throw new Error("Policy not found");

  // Deactivate all other policies for this drive
  if (policy.driveId) {
    await prisma.policyRule.updateMany({
      where: { driveId: policy.driveId, isActive: true },
      data: { isActive: false },
    });
  }

  // Activate this one
  await prisma.policyRule.update({
    where: { id: policyId },
    data: { isActive: true },
  });
}

export async function createPolicyVersion(
  driveId: string,
  naturalLanguage: string,
  compiledRules: CompiledRule[],
  name?: string
): Promise<PolicyVersion> {
  const latest = await prisma.policyRule.findFirst({
    where: { driveId },
    orderBy: { version: "desc" },
  });

  const version = (latest?.version ?? 0) + 1;

  const rule = await prisma.policyRule.create({
    data: {
      driveId,
      name: name ?? `Policy v${version}`,
      naturalLanguage,
      compiledJson: compiledRules,
      version,
      isActive: false,
    },
  });

  return {
    id: rule.id,
    version: rule.version,
    name: rule.name,
    naturalLanguage: rule.naturalLanguage,
    compiledRules,
    isActive: rule.isActive,
    createdAt: rule.createdAt,
  };
}

// ─── A/B Testing ──────────────────────────────────────────────────────────────

export async function runABTest(
  policyAId: string,
  policyBId: string,
  driveId: string
): Promise<ABTestResult> {
  const [policyAData, policyBData] = await Promise.all([
    prisma.policyRule.findUnique({ where: { id: policyAId } }),
    prisma.policyRule.findUnique({ where: { id: policyBId } }),
  ]);

  if (!policyAData || !policyBData) throw new Error("Both policies must exist");

  const policyA: PolicyVersion = {
    id: policyAData.id,
    version: policyAData.version,
    name: policyAData.name,
    naturalLanguage: policyAData.naturalLanguage,
    compiledRules: policyAData.compiledJson as unknown as CompiledRule[],
    isActive: policyAData.isActive,
    createdAt: policyAData.createdAt,
  };

  const policyB: PolicyVersion = {
    id: policyBData.id,
    version: policyBData.version,
    name: policyBData.name,
    naturalLanguage: policyBData.naturalLanguage,
    compiledRules: policyBData.compiledJson as unknown as CompiledRule[],
    isActive: policyBData.isActive,
    createdAt: policyBData.createdAt,
  };

  // Get all registrations for this drive
  const registrations = await prisma.registration.findMany({
    where: { driveId },
    select: {
      candidateName: true,
      employeeId: true,
      tenureDays: true,
      trainingCompleted: true,
      priorAttempts: true,
      businessUnit: true,
      examTrack: true,
      location: true,
    },
  });

  const candidateDetails: ABTestResult["candidateDetails"] = [];
  let passedA = 0, passedB = 0;

  for (const reg of registrations) {
    const resultA = evaluateAgainstRules(policyA.compiledRules, reg);
    const resultB = evaluateAgainstRules(policyB.compiledRules, reg);

    if (resultA.passed) passedA++;
    if (resultB.passed) passedB++;

    candidateDetails.push({
      candidateName: reg.candidateName,
      employeeId: reg.employeeId,
      resultA: resultA.passed,
      resultB: resultB.passed,
      difference: resultA.passed !== resultB.passed,
    });
  }

  const total = registrations.length || 1;
  const passRateA = Math.round((passedA / total) * 100);
  const passRateB = Math.round((passedB / total) * 100);

  const diff = Math.abs(passRateA - passRateB);
  let winner: "A" | "B" | "Tie";
  if (diff < 3) winner = "Tie";
  else if (passRateA > passRateB) winner = "A";
  else winner = "B";

  const confidence = diff > 20 ? "High" : diff > 10 ? "Medium" : diff > 5 ? "Low" : "Insufficient";

  return {
    policyA,
    policyB,
    totalCandidates: registrations.length,
    resultsA: { passed: passedA, failed: registrations.length - passedA, passRate: passRateA },
    resultsB: { passed: passedB, failed: registrations.length - passedB, passRate: passRateB },
    winner,
    confidence,
    candidateDetails,
  };
}

// ─── Live Evaluation ──────────────────────────────────────────────────────────

export type LiveEvaluation = {
  candidateName: string;
  employeeId: string;
  policyName: string;
  result: EvaluationResult;
  timestamp: Date;
};

export async function liveEvaluateCandidate(
  registrationId: string,
  policyId?: string
): Promise<LiveEvaluation> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { drive: true },
  });
  if (!reg) throw new Error("Registration not found");

  // Get active policy or specified one
  let policy: CompiledRule[];
  let policyName: string;

  if (policyId) {
    const policyData = await prisma.policyRule.findUnique({ where: { id: policyId } });
    if (!policyData) throw new Error("Policy not found");
    policy = policyData.compiledJson as unknown as CompiledRule[];
    policyName = policyData.name;
  } else {
    const activePolicy = await prisma.policyRule.findFirst({
      where: { driveId: reg.driveId, isActive: true },
      orderBy: { version: "desc" },
    });
    if (!activePolicy) {
      // Use default rules
      policy = [
        { field: "tenureDays", operator: "gte", value: 90, label: "Minimum tenure: 90 days" },
        { field: "trainingCompleted", operator: "eq", value: true, label: "Training must be completed" },
        { field: "priorAttempts", operator: "lt", value: 3, label: "Max 2 failed attempts" },
      ];
      policyName = "Default Policy";
    } else {
      policy = activePolicy.compiledJson as unknown as CompiledRule[];
      policyName = activePolicy.name;
    }
  }

  const result = evaluateAgainstRules(policy, {
    tenureDays: reg.tenureDays,
    trainingCompleted: reg.trainingCompleted,
    priorAttempts: reg.priorAttempts,
    businessUnit: reg.businessUnit,
    examTrack: reg.examTrack,
    location: reg.location,
  });

  return {
    candidateName: reg.candidateName,
    employeeId: reg.employeeId,
    policyName,
    result,
    timestamp: new Date(),
  };
}
