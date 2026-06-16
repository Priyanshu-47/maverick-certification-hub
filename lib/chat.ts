import { chatCompletion, isAIConfigured } from "./ai";
import { prisma } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export type ChatResponse = {
  message: string;
  data?: Record<string, unknown>;
  queryType: string;
};

// ─── Chat System Prompt ───────────────────────────────────────────────────────

const CHAT_SYSTEM_PROMPT = `You are the Maverick Certification Hub AI Assistant.
You answer questions about certification drives, candidates, vouchers, and organizational metrics.

You have access to the following data tools (simulated via context):
- Drive information (status, registrations, budget)
- Candidate information (eligibility, assessment scores, voucher status)
- Voucher inventory and utilization
- Communication SLA compliance
- ROI metrics

When answering:
1. Be concise and direct (2-3 sentences max unless asked for detail)
2. Use specific numbers from the data provided
3. If you don't have enough data, say so clearly
4. Format responses for readability
5. Always return valid JSON with: { "message": "your answer", "queryType": "type of query" }

Query types: drive_status | candidate_lookup | voucher_info | metrics_summary | general
Always return valid JSON.`;

// ─── Chat Engine ──────────────────────────────────────────────────────────────

export async function processChatQuery(
  userMessage: string,
  context?: { driveId?: string; registrationId?: string }
): Promise<ChatResponse> {
  // Gather relevant context from the database
  const dbContext = await gatherContext(userMessage, context);

  if (isAIConfigured()) {
    return chatWithAI(userMessage, dbContext);
  }
  return chatWithFallback(userMessage, dbContext);
}

async function gatherContext(
  query: string,
  context?: { driveId?: string; registrationId?: string }
): Promise<string> {
  const lower = query.toLowerCase();
  const parts: string[] = [];

  // Always include summary metrics
  const [totalDrives, totalRegs, totalVouchers] = await Promise.all([
    prisma.drive.count(),
    prisma.registration.count(),
    prisma.voucher.count(),
  ]);

  parts.push(`System overview: ${totalDrives} drives, ${totalRegs} registrations, ${totalVouchers} vouchers.`);

  // Drive-specific context
  if (lower.includes("drive") || lower.includes("active") || context?.driveId) {
    const drives = await prisma.drive.findMany({
      select: { name: true, status: true, budget: true, budgetConsumed: true, startDate: true, endDate: true },
      take: 5,
    });
    parts.push(`Drives: ${drives.map((d) => `${d.name} (${d.status}, budget: $${d.budgetConsumed}/$${d.budget})`).join("; ")}`);
  }

  // Registration/candidate context
  if (lower.includes("candidate") || lower.includes("registration") || lower.includes("eligible") || context?.registrationId) {
    const statusCounts = await prisma.registration.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    parts.push(`Registration statuses: ${statusCounts.map((s) => `${s.status}: ${s._count.id}`).join(", ")}`);
  }

  // Voucher context
  if (lower.includes("voucher") || lower.includes("leakage") || lower.includes("redeem")) {
    const voucherStatuses = await prisma.voucher.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    parts.push(`Voucher statuses: ${voucherStatuses.map((v) => `${v.status}: ${v._count.id}`).join(", ")}`);
  }

  // Approval context
  if (lower.includes("approval") || lower.includes("pending")) {
    const pendingApprovals = await prisma.approval.count({ where: { status: "Pending" } });
    parts.push(`Pending approvals: ${pendingApprovals}`);
  }

  // Communication/SLA context
  if (lower.includes("comm") || lower.includes("sla") || lower.includes("email")) {
    const commStats = await prisma.communication.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    parts.push(`Communications: ${commStats.map((c) => `${c.status}: ${c._count.id}`).join(", ")}`);
  }

  // Pass rate context
  if (lower.includes("pass") || lower.includes("fail") || lower.includes("rate") || lower.includes("score")) {
    const passed = await prisma.registration.count({ where: { status: "Passed" } });
    const failed = await prisma.registration.count({ where: { status: "Failed" } });
    const total = passed + failed;
    parts.push(`Pass rate: ${total > 0 ? Math.round((passed / total) * 100) : 0}% (${passed} passed, ${failed} failed)`);
  }

  // Budget context
  if (lower.includes("budget") || lower.includes("cost") || lower.includes("spend")) {
    const budget = await prisma.drive.aggregate({ _sum: { budget: true, budgetConsumed: true } });
    parts.push(`Total budget: $${budget._sum.budget?.toLocaleString() ?? 0}, consumed: $${budget._sum.budgetConsumed?.toLocaleString() ?? 0}`);
  }

  return parts.join("\n");
}

async function chatWithAI(userMessage: string, dbContext: string): Promise<ChatResponse> {
  const raw = await chatCompletion({
    system: CHAT_SYSTEM_PROMPT,
    user: `Database context:\n${dbContext}\n\nUser question: ${userMessage}`,
    temperature: 0.3,
    maxTokens: 1024,
  });

  let jsonStr = raw.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();
  if (!jsonStr.startsWith("{")) {
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    if (start !== -1 && end !== -1) jsonStr = jsonStr.substring(start, end + 1);
  }

  try {
    return JSON.parse(jsonStr) as ChatResponse;
  } catch {
    return { message: raw, queryType: "general" };
  }
}

function chatWithFallback(userMessage: string, dbContext: string): ChatResponse {
  const lower = userMessage.toLowerCase();

  // Parse the context for numbers
  const driveMatch = dbContext.match(/(\d+) drives/);
  const regMatch = dbContext.match(/(\d+) registrations/);
  const voucherMatch = dbContext.match(/(\d+) vouchers/);
  const passRateMatch = dbContext.match(/Pass rate: (\d+)%/);
  const pendingMatch = dbContext.match(/Pending approvals: (\d+)/);
  const budgetMatch = dbContext.match(/consumed: \$([\d,]+)/);

  const totalDrives = driveMatch ? parseInt(driveMatch[1]) : 0;
  const totalRegs = regMatch ? parseInt(regMatch[1]) : 0;
  const totalVouchers = voucherMatch ? parseInt(voucherMatch[1]) : 0;
  const passRate = passRateMatch ? parseInt(passRateMatch[1]) : 0;
  const pending = pendingMatch ? parseInt(pendingMatch[1]) : 0;
  const budgetSpent = budgetMatch ? budgetMatch[1] : "0";

  if (lower.includes("how many") && lower.includes("drive")) {
    return { message: `There are ${totalDrives} certification drives in the system.`, queryType: "drive_status", data: { totalDrives } };
  }
  if (lower.includes("pass rate") || lower.includes("pass percentage")) {
    return { message: `Current pass rate is ${passRate}%.`, queryType: "metrics_summary", data: { passRate } };
  }
  if (lower.includes("pending") && lower.includes("approval")) {
    return { message: `There are ${pending} pending approvals awaiting review.`, queryType: "metrics_summary", data: { pending } };
  }
  if (lower.includes("voucher")) {
    return { message: `There are ${totalVouchers} vouchers in the system. Check the Vouchers page for detailed status.`, queryType: "voucher_info", data: { totalVouchers } };
  }
  if (lower.includes("budget") || lower.includes("spent")) {
    return { message: `Total budget consumed: $${budgetSpent}.`, queryType: "metrics_summary", data: { budgetSpent } };
  }
  if (lower.includes("registration") || lower.includes("candidate")) {
    return { message: `There are ${totalRegs} total registrations across all drives.`, queryType: "candidate_lookup", data: { totalRegs } };
  }

  return {
    message: `Here's what I know: ${totalDrives} drives, ${totalRegs} registrations, ${totalVouchers} vouchers, ${passRate}% pass rate, ${pending} pending approvals. Ask me about any of these!`,
    queryType: "general",
  };
}

// ─── Conversation History ─────────────────────────────────────────────────────

const conversations = new Map<string, ChatMessage[]>();

export function getConversationHistory(sessionId: string): ChatMessage[] {
  return conversations.get(sessionId) ?? [];
}

export function addToConversation(sessionId: string, message: ChatMessage) {
  const history = conversations.get(sessionId) ?? [];
  history.push(message);
  // Keep last 20 messages
  if (history.length > 20) history.splice(0, history.length - 20);
  conversations.set(sessionId, history);
}

export function clearConversation(sessionId: string) {
  conversations.delete(sessionId);
}
