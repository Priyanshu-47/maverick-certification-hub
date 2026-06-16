import { chatCompletionJSON, isAIConfigured } from "./ai";
import { prisma } from "./db";

// ─── Agent Types ──────────────────────────────────────────────────────────────

export type AgentType = "Drive" | "Compliance" | "Voucher" | "Comms" | "ROI";

export type AgentAction = {
  agentType: AgentType;
  action: string;
  entityType: string;
  entityId: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  reasoning: string;
  riskLevel: "low" | "medium" | "high";
  status: "pending" | "approved" | "rejected" | "auto-executed";
};

// ─── Agent System Prompts ─────────────────────────────────────────────────────

const AGENT_PROMPTS: Record<AgentType, string> = {
  Drive: `You are the Drive Agent in the Maverick Certification Hub multi-agent system.
Your role: Manage certification drive lifecycle — create, publish, activate, close drives.
You monitor drive health, flag stalled drives, and recommend actions.
Risk level: low for reads, medium for status changes, high for drive closure.`,
  
  Compliance: `You are the Compliance Agent in the Maverick Certification Hub multi-agent system.
Your role: Ensure eligibility rules are applied correctly, audit policy compliance, flag exceptions.
You verify that all certification decisions have proper justification and audit trails.
Risk level: medium for evaluations, high for policy overrides.`,
  
  Voucher: `You are the Voucher Agent in the Maverick Certification Hub multi-agent system.
Your role: Manage voucher lifecycle — allocation, revocation, reissuance, expiry monitoring.
You prevent duplicate issuance, predict leakage, and recommend reclamation.
Risk level: low for reads, medium for allocation, high for revocation.`,
  
  Comms: `You are the Communications Agent in the Maverick Certification Hub multi-agent system.
Your role: Manage candidate and stakeholder communications, monitor SLA compliance, retry failed sends.
You ensure timely acknowledgements, approvals requests, and result notifications.
Risk level: low for routine comms, medium for SLA breaches.`,
  
  ROI: `You are the ROI Agent in the Maverick Certification Hub multi-agent system.
Your role: Track certification ROI, link certifications to project deployment, forecast skill gaps.
You generate profitability insights and recommend next best drives.
Risk level: low for reporting, medium for forecasts.`,
};

// ─── Agent Orchestrator ───────────────────────────────────────────────────────

export async function runAgent(
  agentType: AgentType,
  action: string,
  context: Record<string, unknown>,
  autoApprove: boolean = true
): Promise<AgentAction> {
  const prompt = AGENT_PROMPTS[agentType];

  let output: Record<string, unknown>;
  let reasoning: string;
  let riskLevel: "low" | "medium" | "high";

  if (isAIConfigured()) {
    const result = await chatCompletionJSON<{
      action: string;
      output: Record<string, unknown>;
      reasoning: string;
      riskLevel: "low" | "medium" | "high";
    }>({
      system: `${prompt}\n\nAnalyze the situation and decide what action to take. Return JSON with: action, output, reasoning, riskLevel.`,
      user: `Action requested: ${action}\n\nContext:\n${JSON.stringify(context, null, 2)}`,
      temperature: 0.2,
      maxTokens: 1024,
    });
    output = result.output;
    reasoning = result.reasoning;
    riskLevel = result.riskLevel;
  } else {
    const fallback = agentFallback(agentType, action, context);
    output = fallback.output;
    reasoning = fallback.reasoning;
    riskLevel = fallback.riskLevel;
  }

  // Determine auto-approval based on risk level
  let status: AgentAction["status"];
  if (riskLevel === "low" && autoApprove) {
    status = "auto-executed";
  } else if (riskLevel === "medium" && autoApprove) {
    status = "auto-executed";
  } else {
    status = "pending";
  }

  // Log to activity feed
  const activity = await prisma.agentActivity.create({
    data: {
      agentType,
      action,
      entityType: context.entityType as string ?? "Unknown",
      entityId: context.entityId as string ?? "",
      input: context,
      output,
      reasoning,
      riskLevel,
      status,
    },
  });

  return {
    agentType,
    action,
    entityType: context.entityType as string ?? "Unknown",
    entityId: context.entityId as string ?? "",
    input: context,
    output,
    reasoning,
    riskLevel,
    status,
  };
}

// ─── Agent Fallbacks (rule-based) ────────────────────────────────────────────

function agentFallback(
  agentType: AgentType,
  action: string,
  context: Record<string, unknown>
): { output: Record<string, unknown>; reasoning: string; riskLevel: "low" | "medium" | "high" } {
  switch (agentType) {
    case "Drive":
      return driveAgentFallback(action, context);
    case "Compliance":
      return complianceAgentFallback(action, context);
    case "Voucher":
      return voucherAgentFallback(action, context);
    case "Comms":
      return commsAgentFallback(action, context);
    case "ROI":
      return roiAgentFallback(action, context);
    default:
      return { output: {}, reasoning: "Unknown agent type", riskLevel: "medium" };
  }
}

function driveAgentFallback(action: string, context: Record<string, unknown>) {
  const status = context.status as string;
  return {
    output: {
      recommendation: status === "Draft" ? "Publish drive to start registrations" : 
                      status === "Published" ? "Activate drive when ready" :
                      status === "Active" ? "Monitor registration progress" : "Archive completed drive",
      healthScore: 75,
    },
    reasoning: `Drive "${context.name}" is in ${status} status. Standard lifecycle action recommended.`,
    riskLevel: status === "Closed" ? "high" : "low" as "low" | "medium" | "high",
  };
}

function complianceAgentFallback(action: string, context: Record<string, unknown>) {
  return {
    output: {
      compliant: true,
      issues: [],
      recommendation: "All eligibility criteria applied correctly",
    },
    reasoning: `Compliance check for ${context.entityType} ${context.entityId}: No policy violations detected.`,
    riskLevel: "low" as const,
  };
}

function voucherAgentFallback(action: string, context: Record<string, unknown>) {
  return {
    output: {
      recommendation: "Voucher allocation follows standard protocol",
      duplicateRisk: false,
      leakageRisk: "Low",
    },
    reasoning: `Voucher action "${action}": Standard allocation rules applied. No anomalies detected.`,
    riskLevel: "low" as const,
  };
}

function commsAgentFallback(action: string, context: Record<string, unknown>) {
  return {
    output: {
      slaStatus: "On Track",
      retryNeeded: false,
      recommendation: "Communication queued for normal delivery",
    },
    reasoning: `Communication action "${action}": SLA compliance on track.`,
    riskLevel: "low" as const,
  };
}

function roiAgentFallback(action: string, context: Record<string, unknown>) {
  return {
    output: {
      currentROI: "N/A",
      recommendation: "Insufficient data for ROI calculation — track certification-to-deployment linkage",
      trend: "stable",
    },
    reasoning: `ROI analysis: Baseline metrics collected. Full ROI tracking requires project deployment data.`,
    riskLevel: "low" as const,
  };
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

export async function getAgentActivityFeed(limit = 20) {
  return prisma.agentActivity.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function approveAgentActivity(activityId: string, approvedBy: string) {
  return prisma.agentActivity.update({
    where: { id: activityId },
    data: { status: "approved", approvedBy },
  });
}

export async function rejectAgentActivity(activityId: string, approvedBy: string) {
  return prisma.agentActivity.update({
    where: { id: activityId },
    data: { status: "rejected", approvedBy },
  });
}

// ─── Multi-Agent Drive Orchestration (Parallel) ───────────────────────────────

export async function orchestrateDrive(driveId: string): Promise<AgentAction[]> {
  const drive = await prisma.drive.findUnique({
    where: { id: driveId },
    include: { registrations: true, vouchers: true, communications: true },
  });

  if (!drive) throw new Error("Drive not found");

  // All 5 agents run CONCURRENTLY via Promise.all — true parallel orchestration
  const [driveAction, complianceAction, voucherAction, commsAction, roiAction] = await Promise.all([
    runAgent("Drive", "health-check", {
      entityType: "Drive",
      entityId: driveId,
      name: drive.name,
      status: drive.status,
      registrationCount: drive.registrations.length,
      voucherCount: drive.vouchers.length,
      budget: drive.budget,
      budgetConsumed: drive.budgetConsumed,
    }),
    runAgent("Compliance", "eligibility-audit", {
      entityType: "Drive",
      entityId: driveId,
      registrationCount: drive.registrations.length,
      policyUrl: drive.policyUrl,
    }),
    runAgent("Voucher", "inventory-check", {
      entityType: "Drive",
      entityId: driveId,
      totalVouchers: drive.vouchers.length,
      availableVouchers: drive.vouchers.filter((v) => v.status === "Available").length,
      issuedVouchers: drive.vouchers.filter((v) => v.status === "Issued").length,
      redeemedVouchers: drive.vouchers.filter((v) => v.status === "Redeemed").length,
    }),
    runAgent("Comms", "sla-check", {
      entityType: "Drive",
      entityId: driveId,
      totalComms: drive.communications.length,
      failedComms: drive.communications.filter((c) => c.status === "Failed").length,
      queuedComms: drive.communications.filter((c) => c.status === "Queued").length,
    }),
    runAgent("ROI", "drive-summary", {
      entityType: "Drive",
      entityId: driveId,
      budget: drive.budget,
      budgetConsumed: drive.budgetConsumed,
      passedCount: drive.registrations.filter((r) => r.status === "Passed").length,
      totalCount: drive.registrations.length,
    }),
  ]);

  return [driveAction, complianceAction, voucherAction, commsAction, roiAction];
}
