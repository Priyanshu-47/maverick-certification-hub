import { chatCompletionJSON, isAIConfigured } from "./ai";
import { prisma, findRegistration } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReadinessResult = {
  readinessScore: number; // 0-100
  weakTopics: string[];
  preparationPlan: { step: string; resource: string; estimatedHours: number }[];
  mockQuestions: { question: string; expectedAnswer: string; difficulty: string }[];
  recommendation: "Issue" | "Hold" | "Reattempt";
  aiSummary: string;
};

// ─── AI Pre-Voucher Readiness Coach ───────────────────────────────────────────

const READINESS_PROMPT = `You are the Maverick Certification Hub AI Pre-Voucher Readiness Coach.
Before releasing a costly certification voucher, you evaluate whether the candidate is truly ready.

Given candidate data, produce a JSON response:
{
  "readinessScore": <0-100>,
  "weakTopics": ["topic1", "topic2", ...],
  "preparationPlan": [
    { "step": "description", "resource": "resource name/link", "estimatedHours": <number> }
  ],
  "mockQuestions": [
    { "question": "exam-style question", "expectedAnswer": "correct answer", "difficulty": "easy|medium|hard" }
  ],
  "recommendation": "Issue|Hold|Reattempt",
  "aiSummary": "2-3 sentence summary of readiness"
}

Score guidelines:
- 80-100: Issue voucher (ready)
- 50-79: Hold (needs more preparation)
- 0-49: Reattempt (not ready, needs retraining)

Focus on: training completion, assessment score vs threshold, prior attempts, tenure relevance.
Generate 3-5 mock questions relevant to the certification track.
Always return valid JSON.`;

export async function assessReadiness(registrationId: string): Promise<ReadinessResult> {
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
    driveName: reg.drive.name,
    tracks: reg.drive.tracks,
  };

  let result: ReadinessResult;

  if (isAIConfigured()) {
    result = await assessWithAI(context, registrationId);
  } else {
    result = assessWithFallback(context);
  }

  // Persist the assessment
  await prisma.readinessAssessment.upsert({
    where: { registrationId: reg.id },
    create: {
      registrationId: reg.id,
      readinessScore: result.readinessScore,
      weakTopics: result.weakTopics,
      preparationPlan: result.preparationPlan,
      mockQuestions: result.mockQuestions,
      recommendation: result.recommendation,
      aiSummary: result.aiSummary,
    },
    update: {
      readinessScore: result.readinessScore,
      weakTopics: result.weakTopics,
      preparationPlan: result.preparationPlan,
      mockQuestions: result.mockQuestions,
      recommendation: result.recommendation,
      aiSummary: result.aiSummary,
    },
  });

  return result;
}

async function assessWithAI(context: Record<string, unknown>, registrationId: string): Promise<ReadinessResult> {
  return chatCompletionJSON<ReadinessResult>({
    system: READINESS_PROMPT,
    user: `Assess candidate readiness for certification:\n\n${JSON.stringify(context, null, 2)}`,
    temperature: 0.3,
    maxTokens: 2048,
  });
}

function assessWithFallback(context: Record<string, unknown>): ReadinessResult {
  let score = 50;
  const weakTopics: string[] = [];

  const assessmentScore = context.assessmentScore as number | null;
  const passThreshold = context.passThreshold as number;

  // Score factor
  if (assessmentScore !== null) {
    if (assessmentScore >= passThreshold + 20) score += 30;
    else if (assessmentScore >= passThreshold) score += 20;
    else if (assessmentScore >= passThreshold - 10) { score += 5; weakTopics.push("Score below threshold"); }
    else { score -= 15; weakTopics.push("Significantly below pass threshold"); }
  }

  // Training
  if (context.trainingCompleted) score += 15;
  else { score -= 15; weakTopics.push("Training not completed"); }

  // Prior attempts
  const attempts = context.priorAttempts as number;
  if (attempts === 0) score += 10;
  else if (attempts >= 2) { score -= attempts * 8; weakTopics.push("Multiple prior failures"); }

  // Tenure
  if ((context.tenureDays as number) >= 180) score += 5;

  score = Math.max(0, Math.min(100, score));

  const track = context.examTrack as string;

  let recommendation: "Issue" | "Hold" | "Reattempt";
  if (score >= 80) recommendation = "Issue";
  else if (score >= 50) recommendation = "Hold";
  else recommendation = "Reattempt";

  if (weakTopics.length === 0) {
    weakTopics.push("No specific weaknesses identified — general review recommended");
  }

  return {
    readinessScore: score,
    weakTopics,
    preparationPlan: [
      { step: `Review ${track} core concepts`, resource: "Microsoft Learn / Official docs", estimatedHours: 8 },
      { step: "Complete practice assessments", resource: "Certification practice tests", estimatedHours: 4 },
      { step: "Review weak areas identified above", resource: "Targeted study materials", estimatedHours: 6 },
    ],
    mockQuestions: [
      { question: `What are the key components of ${track}?`, expectedAnswer: `Core ${track} fundamentals...`, difficulty: "easy" },
      { question: `How would you troubleshoot a common ${track} issue?`, expectedAnswer: "Systematic debugging approach...", difficulty: "medium" },
      { question: `Design a solution using ${track} for an enterprise scenario.`, expectedAnswer: "Architecture with best practices...", difficulty: "hard" },
    ],
    recommendation,
    aiSummary: `Candidate ${context.candidateName} has a readiness score of ${score}/100. ${
      recommendation === "Issue" ? "Ready to receive voucher." :
      recommendation === "Hold" ? "Needs additional preparation before voucher issuance." :
      "Should reattempt training before certification."
    }${isAIConfigured() ? "" : " (Rule-based assessment — configure Azure OpenAI for full AI coaching)"}`,
  };
}

// ─── Batch readiness check ────────────────────────────────────────────────────

export async function batchReadinessCheck(driveId: string): Promise<ReadinessResult[]> {
  const registrations = await prisma.registration.findMany({
    where: { driveId, status: { in: ["Eligible", "Approved", "Passed"] } },
  });

  const results: ReadinessResult[] = [];
  for (const reg of registrations) {
    const result = await assessReadiness(reg.id);
    results.push(result);
  }
  return results;
}
