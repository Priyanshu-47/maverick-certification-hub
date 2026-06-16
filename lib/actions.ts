"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./auth";
import * as S from "./services";
import { driveSchema, registrationSchema, approvalActionSchema, voucherBulkSchema, resultImportSchema } from "./validators";

async function actor() {
  const session = await getSession();
  return { id: session?.id, name: session?.name ?? "System" };
}

async function actorOrPublic() {
  const session = await getSession();
  return { id: session?.id, name: session?.name ?? "Candidate (token)" };
}

export async function loginAction(email: string, password?: string) {
  const { identityProvider, setSession } = await import("./auth");
  try {
    const user = await identityProvider.authenticate({ email, password });
    if (!user) return { error: "Invalid email or password" };
    await setSession(user);
    return { success: true, user };
  } catch (err: any) {
    return { error: err.message || "Login failed" };
  }
}

export async function logoutAction() {
  const { clearSession } = await import("./auth");
  await clearSession();
  return { success: true };
}

export async function createDriveAction(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = driveSchema.safeParse({
    ...raw,
    tracks: JSON.parse(String(raw.tracks || "[]")),
    locations: JSON.parse(String(raw.locations || "[]")),
    trainingRequired: raw.trainingRequired === "true",
  });
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const a = await actor();
  const drive = await S.createDrive({
    name: parsed.data.name,
    sponsor: parsed.data.sponsor,
    owner: { connect: { id: parsed.data.ownerId } },
    budget: parsed.data.budget,
    startDate: new Date(parsed.data.startDate),
    endDate: new Date(parsed.data.endDate),
    registrationDeadline: new Date(parsed.data.registrationDeadline),
    targetCount: parsed.data.targetCount,
    policyUrl: parsed.data.policyUrl || null,
    tracks: parsed.data.tracks,
    locations: parsed.data.locations,
    tenureThreshold: parsed.data.tenureThreshold,
    trainingRequired: parsed.data.trainingRequired,
    maxPriorAttempts: parsed.data.maxPriorAttempts,
    managerApproval: parsed.data.managerApproval,
    passThreshold: parsed.data.passThreshold,
    createdBy: { connect: { id: a.id! } },
  }, a);

  revalidatePath("/drives");
  return { success: true, driveId: drive.id };
}

export async function updateDriveAction(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData);
  const a = await actor();
  await S.updateDrive(id, {
    name: String(raw.name),
    sponsor: String(raw.sponsor),
    budget: Number(raw.budget),
    startDate: new Date(String(raw.startDate)),
    endDate: new Date(String(raw.endDate)),
    registrationDeadline: new Date(String(raw.registrationDeadline)),
    targetCount: Number(raw.targetCount),
    policyUrl: String(raw.policyUrl) || null,
    status: raw.status as never,
  }, a);
  revalidatePath(`/drives/${id}`);
  revalidatePath("/drives");
  return { success: true };
}

export async function publishDriveAction(id: string) {
  const a = await actor();
  await S.publishDrive(id, a);
  revalidatePath(`/drives/${id}`);
  return { success: true };
}

export async function activateDriveAction(id: string) {
  const a = await actor();
  await S.activateDrive(id, a);
  revalidatePath(`/drives/${id}`);
  return { success: true };
}

export async function closeDriveAction(id: string) {
  const a = await actor();
  await S.closeDrive(id, a);
  revalidatePath(`/drives/${id}`);
  return { success: true };
}

export async function createRegistrationAction(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = registrationSchema.safeParse({
    ...raw,
    trainingCompleted: raw.trainingCompleted === "true",
  });
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const a = await actor();
  try {
    const reg = await S.createRegistration({
      ...parsed.data,
      userId: a.id,
    }, a);
    revalidatePath("/registrations");
    return { success: true, registrationId: reg.id };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function evaluateEligibilityAction(registrationId: string) {
  const a = await actor();
  const result = await S.evaluateEligibility(registrationId, a);
  revalidatePath("/eligibility");
  revalidatePath(`/registrations/${registrationId}`);
  return { success: true, result };
}

export async function bulkEligibilityAction(driveId: string) {
  const a = await actor();
  await S.bulkEvaluateEligibility(driveId, a);
  revalidatePath("/eligibility");
  return { success: true };
}

export async function approvalAction(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = approvalActionSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid input" };
  const a = await actor();
  await S.processApproval(parsed.data.approvalId, parsed.data.action, a, parsed.data.comments);
  revalidatePath("/approvals");
  return { success: true };
}

export async function importResultsAction(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = resultImportSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid input" };
  const a = await actor();
  const results = await S.importResults(parsed.data.driveId, parsed.data.csvText, a);
  revalidatePath("/assessments");
  return { success: true, count: results.length };
}

export async function importVouchersAction(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const codes = String(raw.codes).split("\n").filter(Boolean);
  const parsed = voucherBulkSchema.safeParse({ ...raw, codes: String(raw.codes) });
  if (!parsed.success) return { error: "Invalid input" };
  const a = await actor();
  const created = await S.importVouchers({
    driveId: parsed.data.driveId,
    vendor: parsed.data.vendor,
    certificationTrack: parsed.data.certificationTrack,
    codes,
    value: parsed.data.value,
    currency: parsed.data.currency,
    expiryDate: new Date(parsed.data.expiryDate),
  }, a);
  revalidatePath("/vouchers");
  return { success: true, count: created.length };
}

export async function allocateVoucherAction(registrationId: string) {
  const a = await actor();
  try {
    await S.allocateVoucher(registrationId, a);
    revalidatePath("/vouchers");
    revalidatePath(`/registrations/${registrationId}`);
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function reissueVoucherAction(registrationId: string, reason: string) {
  const a = await actor();
  await S.reissueVoucher(registrationId, reason, a);
  revalidatePath("/vouchers");
  return { success: true };
}

export async function revealVoucherAction(voucherId: string) {
  const a = await actor();
  const code = await S.revealVoucherCode(voucherId, a);
  return { success: true, code };
}

export async function redeemVoucherAction(voucherId: string) {
  const a = await actor();
  await S.redeemVoucher(voucherId, a);
  revalidatePath("/vouchers");
  return { success: true };
}

export async function runAutomationAction() {
  const a = await actor();
  const result = await S.runDailyAutomation(a);
  revalidatePath("/automation");
  revalidatePath("/exceptions");
  return { success: true, ...result };
}

export async function resolveExceptionAction(id: string, notes: string) {
  const a = await actor();
  await S.resolveException(id, notes, a);
  revalidatePath("/exceptions");
  return { success: true };
}

export async function scheduleAssessmentAction(registrationId: string, date: string, slot: string) {
  const a = await actor();
  await S.scheduleAssessment(registrationId, new Date(date), slot, a);
  revalidatePath("/assessments");
  return { success: true };
}

export async function accessVoucherTokenAction(token: string) {
  const a = await actorOrPublic();
  const voucher = await S.accessVoucherToken(token, a);
  return { success: true, voucher };
}

export async function revealVoucherPublicAction(voucherId: string) {
  const a = await actorOrPublic();
  const code = await S.revealVoucherCode(voucherId, a);
  return { success: true, code };
}

// ─── AI Feature Actions ───────────────────────────────────────────────────────

export async function compilePolicyAction(naturalLanguage: string, driveId?: string) {
  const { compileNLRules } = await import("./policy-compiler");
  try {
    const result = await compileNLRules(naturalLanguage, driveId);
    return { success: true, ...result };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function scoreVoucherAction(registrationId: string) {
  const { scoreVoucherAllocation } = await import("./voucher-intelligence");
  try {
    const result = await scoreVoucherAllocation(registrationId);
    return { success: true, ...result };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function assessReadinessAction(registrationId: string) {
  const { assessReadiness } = await import("./readiness-coach");
  try {
    const result = await assessReadiness(registrationId);
    return { success: true, ...result };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function analyzeDemandAction(input: {
  projectName: string;
  requiredSkills: { skill: string; required: number; available: number }[];
  timeline?: string;
}) {
  const { analyzeDemand } = await import("./demand-intelligence");
  try {
    const result = await analyzeDemand(input);
    return { success: true, ...result };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function generatePassportAction(registrationId: string) {
  const { generatePassport } = await import("./passport");
  try {
    const result = await generatePassport(registrationId);
    return { success: true, ...result };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function generateROIReportAction(driveId?: string) {
  const { generateROIReport } = await import("./roi");
  try {
    const result = await generateROIReport(driveId);
    return { success: true, ...result };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function orchestrateDriveAction(driveId?: string) {
  const { orchestrateDrive } = await import("./agents");
  try {
    // If no driveId provided, find the active drive
    let id = driveId;
    if (!id) {
      const activeDrive = await prisma.drive.findFirst({
        where: { status: "Active" },
        orderBy: { updatedAt: "desc" },
      });
      if (!activeDrive) return { error: "No active drive found. Create and activate a drive first." };
      id = activeDrive.id;
    }
    const actions = await orchestrateDrive(id);
    return { success: true, actions };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function getAgentFeedAction(limit?: number) {
  const { getAgentActivityFeed } = await import("./agents");
  const feed = await getAgentActivityFeed(limit);
  return { success: true, feed };
}

export async function approveAgentAction(activityId: string) {
  const { approveAgentActivity } = await import("./agents");
  const a = await actor();
  await approveAgentActivity(activityId, a.name);
  revalidatePath("/copilot");
  return { success: true };
}

export async function rejectAgentAction(activityId: string) {
  const { rejectAgentActivity } = await import("./agents");
  const a = await actor();
  await rejectAgentActivity(activityId, a.name);
  revalidatePath("/copilot");
  return { success: true };
}

// ─── RAG Document Actions ─────────────────────────────────────────────────────

export async function analyzeDocumentAction(fileName: string, fileContent: string) {
  const { analyzeDocument } = await import("./rag");
  try {
    const result = await analyzeDocument(fileName, fileContent);
    return { success: true, ...result };
  } catch (e) {
    return { error: String(e) };
  }
}

// ─── A/B Testing Actions ──────────────────────────────────────────────────────

export async function getPolicyVersionsAction(driveId?: string) {
  const { getPolicyVersions } = await import("./ab-testing");
  const versions = await getPolicyVersions(driveId);
  return { success: true, versions };
}

export async function runABTestAction(policyAId: string, policyBId: string, driveId: string) {
  const { runABTest } = await import("./ab-testing");
  try {
    const result = await runABTest(policyAId, policyBId, driveId);
    return { success: true, ...result };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function liveEvaluateAction(registrationId: string, policyId?: string) {
  const { liveEvaluateCandidate } = await import("./ab-testing");
  try {
    const result = await liveEvaluateCandidate(registrationId, policyId);
    return { success: true, ...result };
  } catch (e) {
    return { error: String(e) };
  }
}

// ─── Chat Actions ─────────────────────────────────────────────────────────────

export async function chatAction(message: string, sessionId?: string) {
  const { processChatQuery, addToConversation, getConversationHistory } = await import("./chat");
  const sid = sessionId ?? "default";

  addToConversation(sid, { role: "user", content: message, timestamp: new Date() });

  try {
    const result = await processChatQuery(message);
    addToConversation(sid, { role: "assistant", content: result.message, timestamp: new Date() });
    return { success: true, ...result, history: getConversationHistory(sid) };
  } catch (e) {
    return { error: String(e) };
  }
}
