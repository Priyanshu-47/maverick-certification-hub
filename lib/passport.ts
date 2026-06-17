import { chatCompletionJSON, isAIConfigured } from "./ai";
import { prisma, findRegistration } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PassportData = {
  registrationCode: string;
  candidateName: string;
  employeeId: string;
  driveName: string;
  examTrack: string;
  eligibilityPath: string[];
  trainingStatus: string;
  assessmentResult: { score: number | null; outcome: string; date: string | null };
  voucherStatus: { issued: boolean; redeemed: boolean; code?: string };
  evidenceLinks: string[];
  aiSummary: string;
  nextActions: string[];
  generatedAt: string;
};

// ─── Certification Evidence Passport ──────────────────────────────────────────

const PASSPORT_PROMPT = `You are the Maverick Certification Hub Evidence Passport generator.
Generate an audit-ready certification profile for a candidate.

Given candidate data, produce a JSON response with:
{
  "aiSummary": "2-3 sentence professional summary of the candidate's certification journey",
  "nextActions": ["action1", "action2", ...],
  "riskFlags": ["flag1", ...],
  "overallRating": "Excellent|Good|Average|NeedsImprovement"
}

Focus on:
- Completeness of certification journey
- Any gaps or concerns
- Readiness for project deployment
- Recommended next steps

Always return valid JSON.`;

export async function generatePassport(registrationId: string): Promise<PassportData> {
  const reg = await findRegistration(registrationId, {
    drive: true,
    eligibilityDecision: true,
    assessmentResults: true,
    vouchers: true,
    communications: true,
    readinessAssessment: true,
    roiMetrics: true,
  });

  if (!reg) throw new Error("Registration not found");

  const assessment = reg.assessmentResults[0];
  const voucher = reg.vouchers[0];

  const context = {
    registrationCode: reg.registrationCode,
    candidateName: reg.candidateName,
    employeeId: reg.employeeId,
    businessUnit: reg.businessUnit,
    driveName: reg.drive.name,
    examTrack: reg.examTrack,
    tenureDays: reg.tenureDays,
    trainingCompleted: reg.trainingCompleted,
    priorAttempts: reg.priorAttempts,
    eligibilityOutcome: reg.eligibilityDecision?.outcome ?? "Not evaluated",
    criteriaJson: reg.eligibilityDecision?.criteriaJson,
    assessmentScore: assessment?.score ?? null,
    assessmentOutcome: assessment?.outcome ?? "Pending",
    voucherStatus: voucher?.status ?? "None",
    voucherRedeemed: voucher?.status === "Redeemed",
    communicationsCount: reg.communications.length,
    readinessScore: reg.readinessAssessment?.readinessScore,
  };

  let aiSummary: string;
  let nextActions: string[];

  if (isAIConfigured()) {
    const aiResult = await chatCompletionJSON<{
      aiSummary: string;
      nextActions: string[];
    }>({
      system: PASSPORT_PROMPT,
      user: `Generate evidence passport for:\n\n${JSON.stringify(context, null, 2)}`,
      temperature: 0.2,
      maxTokens: 1024,
    });
    aiSummary = aiResult.aiSummary;
    nextActions = aiResult.nextActions;
  } else {
    const fallback = passportFallback(context);
    aiSummary = fallback.aiSummary;
    nextActions = fallback.nextActions;
  }

  const passportData: PassportData = {
    registrationCode: reg.registrationCode,
    candidateName: reg.candidateName,
    employeeId: reg.employeeId,
    driveName: reg.drive.name,
    examTrack: reg.examTrack,
    eligibilityPath: extractEligibilityPath(reg.eligibilityDecision?.criteriaJson),
    trainingStatus: reg.trainingCompleted ? "Completed" : "Not Completed",
    assessmentResult: {
      score: assessment?.score ?? null,
      outcome: assessment?.outcome ?? "Pending",
      date: assessment?.assessmentDate?.toISOString() ?? null,
    },
    voucherStatus: {
      issued: !!voucher,
      redeemed: voucher?.status === "Redeemed",
    },
    evidenceLinks: [
      `/registrations/${reg.id}`,
      `/eligibility`,
      `/assessments`,
      `/vouchers`,
    ],
    aiSummary,
    nextActions,
    generatedAt: new Date().toISOString(),
  };

  // Persist passport
  await prisma.certificationPassport.upsert({
    where: { registrationId: reg.id },
    create: {
      registrationId: reg.id,
      passportJson: passportData,
      aiSummary,
      nextActions,
    },
    update: {
      passportJson: passportData,
      aiSummary,
      nextActions,
    },
  });

  return passportData;
}

function extractEligibilityPath(criteriaJson: unknown): string[] {
  if (!criteriaJson || typeof criteriaJson !== "object") return ["Not evaluated"];
  const obj = criteriaJson as Record<string, unknown>;
  const criteria = obj.criteria as Array<{ name: string; passed: boolean; detail: string }> | undefined;
  if (!criteria) return ["Not evaluated"];
  return criteria.map((c) => `${c.passed ? "PASS" : "FAIL"}: ${c.name} — ${c.detail}`);
}

function passportFallback(context: Record<string, unknown>): { aiSummary: string; nextActions: string[] } {
  const name = context.candidateName as string;
  const track = context.examTrack as string;
  const outcome = context.eligibilityOutcome as string;
  const assessment = context.assessmentOutcome as string;
  const voucher = context.voucherStatus as string;

  const summary = `${name} is pursuing ${track} certification. Eligibility: ${outcome}. Assessment: ${assessment}. Voucher: ${voucher}. ${
    context.trainingCompleted ? "Training completed." : "Training pending."
  }${context.readinessScore ? ` Readiness score: ${context.readinessScore}/100.` : ""}${
    isAIConfigured() ? "" : " (Rule-based summary — configure AWS Bedrock for AI-generated summaries)"
  }`;

  const actions: string[] = [];
  if (outcome !== "Eligible") actions.push("Complete eligibility evaluation");
  if (assessment === "Pending") actions.push("Schedule and complete assessment");
  if (voucher === "None" && assessment === "Passed") actions.push("Allocate certification voucher");
  if (voucher === "Issued") actions.push("Redeem voucher before expiry");
  if (!context.trainingCompleted) actions.push("Complete required training");

  return { aiSummary: summary, nextActions: actions };
}

// ─── Batch passport generation ────────────────────────────────────────────────

export async function batchGeneratePassports(driveId: string): Promise<PassportData[]> {
  const registrations = await prisma.registration.findMany({
    where: { driveId },
  });

  const passports: PassportData[] = [];
  for (const reg of registrations) {
    const passport = await generatePassport(reg.id);
    passports.push(passport);
  }
  return passports;
}
