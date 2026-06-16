import { chatCompletionJSON, isAIConfigured } from "./ai";
import { prisma } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SkillGap = {
  skill: string;
  required: number;
  available: number;
  gap: number;
  priority: "Critical" | "High" | "Medium" | "Low";
};

export type DemandForecast = {
  projectName: string;
  skillGaps: SkillGap[];
  recommendedTracks: { track: string; candidatesNeeded: number; expectedPassRate: number }[];
  candidateCount: number;
  timeline: string;
  confidenceScore: number;
  aiAnalysis: string;
};

// ─── Certification Demand Intelligence ────────────────────────────────────────

const DEMAND_PROMPT = `You are the Maverick Certification Hub Certification Demand Intelligence engine.
You analyze project requirements and workforce data to recommend certification drives.

Given project/skill data, produce a JSON response:
{
  "projectName": "project name",
  "skillGaps": [
    { "skill": "skill name", "required": <number>, "available": <number>, "gap": <number>, "priority": "Critical|High|Medium|Low" }
  ],
  "recommendedTracks": [
    { "track": "certification track name", "candidatesNeeded": <number>, "expectedPassRate": <0-100> }
  ],
  "candidateCount": <total candidates needed>,
  "timeline": "recommended timeline description",
  "confidenceScore": <0-100>,
  "aiAnalysis": "2-3 paragraph analysis with recommendation"
}

Focus on:
- Gap between required and available certified professionals
- Certification tracks that address the biggest gaps
- Realistic timelines and pass rates
- Budget-efficient recommendations

Always return valid JSON.`;

export async function analyzeDemand(input: {
  projectName: string;
  requiredSkills: { skill: string; required: number; available: number }[];
  timeline?: string;
  budget?: number;
}): Promise<DemandForecast> {
  if (isAIConfigured()) {
    return await analyzeWithAI(input);
  }
  return analyzeWithFallback(input);
}

async function analyzeWithAI(input: {
  projectName: string;
  requiredSkills: { skill: string; required: number; available: number }[];
  timeline?: string;
  budget?: number;
}): Promise<DemandForecast> {
  const result = await chatCompletionJSON<DemandForecast>({
    system: DEMAND_PROMPT,
    user: `Analyze certification demand for:\n\n${JSON.stringify(input, null, 2)}`,
    temperature: 0.3,
    maxTokens: 2048,
  });

  // Persist forecast
  await prisma.demandForecast.create({
    data: {
      projectName: result.projectName,
      skillGaps: result.skillGaps,
      recommendedTracks: result.recommendedTracks,
      candidateCount: result.candidateCount,
      timeline: result.timeline,
      confidenceScore: result.confidenceScore,
      aiAnalysis: result.aiAnalysis,
    },
  });

  return result;
}

function analyzeWithFallback(input: {
  projectName: string;
  requiredSkills: { skill: string; required: number; available: number }[];
  timeline?: string;
  budget?: number;
}): DemandForecast {
  const skillGaps: SkillGap[] = input.requiredSkills.map((s) => ({
    skill: s.skill,
    required: s.required,
    available: s.available,
    gap: Math.max(0, s.required - s.available),
    priority: s.required - s.available > 10 ? "Critical" :
              s.required - s.available > 5 ? "High" :
              s.required - s.available > 2 ? "Medium" : "Low",
  }));

  const totalGap = skillGaps.reduce((sum, g) => sum + g.gap, 0);

  const recommendedTracks = skillGaps
    .filter((g) => g.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3)
    .map((g) => ({
      track: g.skill,
      candidatesNeeded: g.gap + Math.ceil(g.gap * 0.3), // 30% buffer for failures
      expectedPassRate: 65,
    }));

  return {
    projectName: input.projectName,
    skillGaps,
    recommendedTracks,
    candidateCount: totalGap,
    timeline: input.timeline || `${Math.ceil(totalGap / 20)} weeks (batch processing ~20 candidates/week)`,
    confidenceScore: isAIConfigured() ? 80 : 55,
    aiAnalysis: `Project "${input.projectName}" has a total skill gap of ${totalGap} certified professionals across ${skillGaps.filter((g) => g.gap > 0).length} skill areas. ${
      skillGaps.filter((g) => g.priority === "Critical").length > 0
        ? `CRITICAL: ${skillGaps.filter((g) => g.priority === "Critical").map((g) => g.skill).join(", ")} have severe gaps requiring immediate action.`
        : "No critical gaps detected."
    } Recommend launching certification drives for the top skill gaps with an estimated ${Math.ceil(totalGap * 1.3)} candidate pipeline to account for attrition.${
      isAIConfigured() ? "" : " (Rule-based analysis — configure Azure OpenAI for full AI-driven demand intelligence)"
    }`,
  };
}

// ─── What-if scenario analysis ────────────────────────────────────────────────

export async function whatIfScenario(params: {
  projectName: string;
  scenario: string;
  currentCertified: number;
  targetCertified: number;
}): Promise<{
  feasibility: string;
  timeline: string;
  risks: string[];
  recommendations: string[];
}> {
  if (isAIConfigured()) {
    return chatCompletionJSON({
      system: `You are a certification planning advisor. Analyze the what-if scenario and return JSON with: feasibility, timeline, risks (array), recommendations (array).`,
      user: JSON.stringify(params),
      temperature: 0.3,
    });
  }

  const gap = params.targetCertified - params.currentCertified;
  return {
    feasibility: gap <= 20 ? "Achievable" : gap <= 50 ? "Challenging" : "Requires significant investment",
    timeline: `${Math.ceil(gap / 10)} weeks`,
    risks: [
      "Candidate attrition during preparation",
      "Assessment availability constraints",
      "Budget overrun if pass rates are lower than expected",
    ],
    recommendations: [
      "Start with highest-priority skill gaps",
      "Run parallel certification tracks",
      "Implement readiness coaching before assessment",
    ],
  };
}
