import { chatCompletionJSON, isAIConfigured } from "./ai";
import { prisma } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ROIReport = {
  totalInvestment: number;
  totalRevenue: number;
  roiPercent: number;
  certificationsByTrack: { track: string; count: number; avgCost: number }[];
  deploymentRate: number;
  topPerformingTracks: string[];
  skillGapForecast: { skill: string; currentSupply: number; projectedDemand: number; gap: number }[];
  profitabilityByBU: { bu: string; investment: number; revenue: number; roi: number }[];
  aiInsights: string;
};

// ─── ROI Command Center ───────────────────────────────────────────────────────

const ROI_PROMPT = `You are the Maverick Certification Hub ROI Command Center.
Analyze certification investment data and produce actionable ROI insights.

Given metrics, produce a JSON response:
{
  "totalInvestment": <number>,
  "totalRevenue": <number>,
  "roiPercent": <number>,
  "certificationsByTrack": [{ "track": "name", "count": <n>, "avgCost": <n> }],
  "deploymentRate": <0-100>,
  "topPerformingTracks": ["track1", ...],
  "skillGapForecast": [{ "skill": "name", "currentSupply": <n>, "projectedDemand": <n>, "gap": <n> }],
  "profitabilityByBU": [{ "bu": "name", "investment": <n>, "revenue": <n>, "roi": <n> }],
  "aiInsights": "2-3 paragraph analysis with strategic recommendations"
}

Focus on:
- Linking L&D spend to project deployment and revenue
- Identifying most cost-effective certification tracks
- Forecasting future skill gaps based on project pipeline
- Recommending resource reallocation

Always return valid JSON.`;

export async function generateROIReport(driveId?: string): Promise<ROIReport> {
  // Gather base data
  const whereClause = driveId ? { driveId } : {};

  const [vouchers, registrations, drives] = await Promise.all([
    prisma.voucher.findMany({
      where: whereClause,
      select: { value: true, status: true, vendor: true, certificationTrack: true, driveId: true },
    }),
    prisma.registration.findMany({
      where: whereClause,
      select: {
        status: true, businessUnit: true, examTrack: true,
        vouchers: { select: { value: true, status: true } },
      },
    }),
    prisma.drive.findMany({
      where: driveId ? { id: driveId } : {},
      select: { budget: true, budgetConsumed: true, name: true },
    }),
  ]);

  const totalInvestment = drives.reduce((s, d) => s + d.budget, 0);
  const totalVoucherValue = vouchers
    .filter((v) => v.status === "Redeemed")
    .reduce((s, v) => s + v.value, 0);
  const estimatedRevenue = totalVoucherValue * 3; // rough 3x multiplier

  const trackMap = new Map<string, { count: number; totalCost: number }>();
  vouchers.forEach((v) => {
    const existing = trackMap.get(v.certificationTrack) ?? { count: 0, totalCost: 0 };
    existing.count++;
    existing.totalCost += v.value;
    trackMap.set(v.certificationTrack, existing);
  });

  const certificationsByTrack = Array.from(trackMap.entries()).map(([track, data]) => ({
    track,
    count: data.count,
    avgCost: Math.round(data.totalCost / data.count),
  }));

  const buMap = new Map<string, { investment: number; revenue: number }>();
  registrations.forEach((r) => {
    const existing = buMap.get(r.businessUnit) ?? { investment: 0, revenue: 0 };
    const voucherValue = r.vouchers.reduce((s, v) => s + (v.status === "Redeemed" ? v.value : 0), 0);
    existing.investment += voucherValue;
    existing.revenue += voucherValue * 3;
    buMap.set(r.businessUnit, existing);
  });

  const profitabilityByBU = Array.from(buMap.entries()).map(([bu, data]) => ({
    bu,
    investment: data.investment,
    revenue: data.revenue,
    roi: data.investment > 0 ? Math.round(((data.revenue - data.investment) / data.investment) * 100) : 0,
  }));

  const deployedCount = registrations.filter((r) =>
    ["VoucherIssued", "VoucherRedeemed"].includes(r.status)
  ).length;
  const deploymentRate = registrations.length > 0
    ? Math.round((deployedCount / registrations.length) * 100)
    : 0;

  const roiPercent = totalInvestment > 0
    ? Math.round(((estimatedRevenue - totalInvestment) / totalInvestment) * 100)
    : 0;

  let aiInsights: string;
  if (isAIConfigured()) {
    const aiResult = await chatCompletionJSON<{ aiInsights: string }>({
      system: ROI_PROMPT,
      user: `Generate ROI analysis:\n\n${JSON.stringify({
        totalInvestment,
        totalVoucherValue,
        estimatedRevenue,
        certificationsByTrack,
        deploymentRate,
        profitabilityByBU,
        totalRegistrations: registrations.length,
      }, null, 2)}`,
      temperature: 0.3,
      maxTokens: 1024,
    });
    aiInsights = aiResult.aiInsights;
  } else {
    const topTrack = certificationsByTrack.sort((a, b) => b.count - a.count)[0];
    aiInsights = `Total L&D investment: $${totalInvestment.toLocaleString()}. Estimated revenue impact: $${estimatedRevenue.toLocaleString()}. Overall ROI: ${roiPercent}%. ` +
      `Deployment rate: ${deploymentRate}% of registered candidates reached voucher stage. ` +
      `Top certification track: ${topTrack?.track ?? "N/A"} with ${topTrack?.count ?? 0} certifications. ` +
      `Recommendation: Focus on ${profitabilityByBU.sort((a, b) => b.roi - a.roi)[0]?.bu ?? "highest ROI"} business unit for maximum return.${
        isAIConfigured() ? "" : " (Rule-based analysis — configure AWS Bedrock for AI-driven ROI insights)"
      }`;
  }

  return {
    totalInvestment,
    totalRevenue: estimatedRevenue,
    roiPercent,
    certificationsByTrack,
    deploymentRate,
    topPerformingTracks: certificationsByTrack.sort((a, b) => b.count - a.count).slice(0, 3).map((t) => t.track),
    skillGapForecast: [], // populated by demand intelligence
    profitabilityByBU,
    aiInsights,
  };
}

// ─── Track individual certification ROI ───────────────────────────────────────

export async function trackCertificationROI(
  registrationId: string,
  voucherCost: number,
  projectRevenue?: number,
  deploymentStatus?: string
) {
  const roiPercent = projectRevenue
    ? Math.round(((projectRevenue - voucherCost) / voucherCost) * 100)
    : null;

  return prisma.roiMetric.upsert({
    where: { registrationId },
    create: {
      registrationId,
      voucherCost,
      projectRevenue: projectRevenue ?? null,
      roiPercent,
      deploymentStatus: deploymentStatus ?? "Pending",
    },
    update: {
      voucherCost,
      projectRevenue: projectRevenue ?? null,
      roiPercent,
      deploymentStatus: deploymentStatus ?? "Pending",
    },
  });
}
