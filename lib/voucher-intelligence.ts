import { chatCompletionJSON, isAIConfigured } from "./ai";
import { prisma, findRegistration } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoucherScoreResult = {
  likelihoodScore: number; // 0-100
  riskFactors: string[];
  explanation: string;
  recommendation: "Issue" | "Hold" | "Revoke";
  confidence: number;
};

// ─── Voucher Intelligence Engine ──────────────────────────────────────────────

const VOUCHER_SCORING_PROMPT = `You are the Maverick Certification Hub Voucher Intelligence Engine.
Your job is to score the likelihood that a voucher will be productively used (0-100).

Consider these risk factors:
- Candidate's assessment score (higher = better)
- Training completion status
- Prior failed attempts
- Tenure at company
- Historical voucher redemption rates for similar profiles
- Time since assessment
- Business unit certification culture

Produce a JSON response:
{
  "likelihoodScore": <0-100>,
  "riskFactors": ["factor1", "factor2", ...],
  "explanation": "Plain English explanation of the score and factors",
  "recommendation": "Issue|Hold|Revoke",
  "confidence": <0-100>
}

Score guidelines:
- 80-100: Issue (high confidence of productive use)
- 50-79: Hold (needs review or preparation)
- 0-49: Revoke/Block (high leakage risk)

Always return valid JSON.`;

export async function scoreVoucherAllocation(registrationId: string): Promise<VoucherScoreResult> {
  const reg = await findRegistration(registrationId, {
    drive: true,
    assessmentResults: true,
    eligibilityDecision: true,
  });

  if (!reg) throw new Error("Registration not found");

  const assessment = reg.assessmentResults[0];
  const context = {
    candidateName: reg.candidateName,
    employeeId: reg.employeeId,
    businessUnit: reg.businessUnit,
    tenureDays: reg.tenureDays,
    trainingCompleted: reg.trainingCompleted,
    priorAttempts: reg.priorAttempts,
    examTrack: reg.examTrack,
    assessmentScore: assessment?.score ?? null,
    assessmentOutcome: assessment?.outcome ?? "Pending",
    passThreshold: reg.drive.passThreshold,
    driveBudget: reg.drive.budget,
    driveBudgetConsumed: reg.drive.budgetConsumed,
  };

  if (isAIConfigured()) {
    return await scoreWithAI(context, reg.id);
  }
  return scoreWithFallback(context);
}

async function scoreWithAI(context: Record<string, unknown>, regId: string): Promise<VoucherScoreResult> {
  const result = await chatCompletionJSON<VoucherScoreResult>({
    system: VOUCHER_SCORING_PROMPT,
    user: `Score this voucher allocation request:\n\n${JSON.stringify(context, null, 2)}`,
    temperature: 0.2,
    maxTokens: 1024,
  });

  // Persist the score
  await prisma.voucherScore.create({
    data: {
      registrationId: regId,
      likelihoodScore: result.likelihoodScore,
      riskFactors: result.riskFactors,
      explanation: result.explanation,
      recommendation: result.recommendation,
    },
  });

  return result;
}

function scoreWithFallback(context: Record<string, unknown>): VoucherScoreResult {
  let score = 50; // baseline
  const riskFactors: string[] = [];

  // Assessment score factor (0-30 points)
  const assessmentScore = context.assessmentScore as number | null;
  if (assessmentScore !== null) {
    if (assessmentScore >= 90) score += 25;
    else if (assessmentScore >= 70) score += 15;
    else if (assessmentScore >= 50) score += 5;
    else { score -= 10; riskFactors.push("Low assessment score"); }
  }

  // Training completion (0-15 points)
  if (context.trainingCompleted) {
    score += 15;
  } else {
    score -= 15;
    riskFactors.push("Training not completed");
  }

  // Prior attempts (-20 to +10)
  const priorAttempts = context.priorAttempts as number;
  if (priorAttempts === 0) score += 10;
  else if (priorAttempts === 1) score += 0;
  else { score -= priorAttempts * 10; riskFactors.push(`${priorAttempts} prior failed attempts`); }

  // Tenure (0-10 points)
  const tenureDays = context.tenureDays as number;
  if (tenureDays >= 365) score += 10;
  else if (tenureDays >= 180) score += 5;
  else { score -= 5; riskFactors.push("Short tenure"); }

  // Budget pressure
  const budget = context.driveBudget as number;
  const consumed = context.driveBudgetConsumed as number;
  if (budget > 0 && consumed / budget > 0.8) {
    score -= 10;
    riskFactors.push("Budget nearly exhausted");
  }

  score = Math.max(0, Math.min(100, score));

  let recommendation: "Issue" | "Hold" | "Revoke";
  if (score >= 80) recommendation = "Issue";
  else if (score >= 50) recommendation = "Hold";
  else recommendation = "Revoke";

  const explanation = riskFactors.length > 0
    ? `Score: ${score}/100. Key risks: ${riskFactors.join("; ")}. Recommendation: ${recommendation}.`
    : `Score: ${score}/100. Candidate profile looks strong. Recommendation: ${recommendation}.`;

  return {
    likelihoodScore: score,
    riskFactors,
    explanation,
    recommendation,
    confidence: isAIConfigured() ? 85 : 60,
  };
}

// ─── Batch scoring ────────────────────────────────────────────────────────────

export async function batchScoreVouchers(driveId: string): Promise<VoucherScoreResult[]> {
  const registrations = await prisma.registration.findMany({
    where: { driveId, status: "Passed" },
  });

  const results: VoucherScoreResult[] = [];
  for (const reg of registrations) {
    const score = await scoreVoucherAllocation(reg.id);
    results.push(score);
  }
  return results;
}

// ─── Auto-reclaim unused vouchers ─────────────────────────────────────────────

export async function autoReclaimUnusedVouchers(driveId: string): Promise<number> {
  const thresholdDays = 30;
  const cutoff = new Date(Date.now() - thresholdDays * 86400000);

  const staleVouchers = await prisma.voucher.findMany({
    where: {
      driveId,
      status: "Issued",
      deliveryDate: { lt: cutoff },
      readDate: null,
    },
  });

  let reclaimed = 0;
  for (const v of staleVouchers) {
    await prisma.voucher.update({
      where: { id: v.id },
      data: { status: "Available", assignedRegistrationId: null, assignedEmployeeId: null, deliveryDate: null },
    });
    reclaimed++;
  }

  return reclaimed;
}
