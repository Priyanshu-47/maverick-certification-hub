import { prisma } from "./db";
import { writeAudit } from "./audit";
import { encryptCode, decryptCode, hashValue, generateToken, hashToken } from "./security";
import { emailProvider } from "./adapters";
import { REPO_FOLDERS, ACK_SLA_MINUTES, APPROVAL_SLA_HOURS } from "./constants";
import { maskVoucherCode, generateCode, parseCsvResults } from "./utils";
import type { SessionUser, CriteriaResult, EligibilityCriteriaJson, DashboardMetrics, FunnelStage } from "@/types";
import type { Prisma, RegistrationStatus, DriveStatus } from "@prisma/client";

type Actor = { id?: string; name: string };

// ─── Drive Service ───────────────────────────────────────────────────────────

export async function createDrive(data: Omit<Prisma.DriveCreateInput, "driveCode">, actor: Actor) {
  const count = await prisma.drive.count();
  const driveCode = generateCode("DRV", count + 1);
  const drive = await prisma.drive.create({ data: { ...data, driveCode } });

  await prisma.repositoryFolder.createMany({
    data: REPO_FOLDERS.map((f) => ({ driveId: drive.id, name: f.name, path: f.path, sortOrder: f.sortOrder })),
  });

  await writeAudit({
    entityType: "Drive", entityId: drive.id, action: "drive.created", actorId: actor.id, actorName: actor.name,
    after: { id: drive.id, name: drive.name, status: drive.status },
  });
  return drive;
}

export async function updateDrive(id: string, data: Prisma.DriveUpdateInput, actor: Actor) {
  const before = await prisma.drive.findUnique({ where: { id } });
  const drive = await prisma.drive.update({ where: { id }, data });
  await writeAudit({
    entityType: "Drive", entityId: id, action: "drive.updated", actorId: actor.id, actorName: actor.name,
    before, after: drive,
  });
  return drive;
}

export async function publishDrive(id: string, actor: Actor) {
  return updateDrive(id, { status: "Published" }, actor);
}

export async function closeDrive(id: string, actor: Actor) {
  const drive = await updateDrive(id, { status: "Closed" }, actor);
  await writeAudit({
    entityType: "Drive", entityId: id, action: "drive.closed", actorId: actor.id, actorName: actor.name,
    after: { status: "Closed" },
  });
  return drive;
}

export async function activateDrive(id: string, actor: Actor) {
  return updateDrive(id, { status: "Active" }, actor);
}

// ─── Registration Service ───────────────────────────────────────────────────

export async function createRegistration(
  input: {
    driveId: string; employeeId: string; candidateName: string; email: string;
    businessUnit: string; location: string; managerEmail: string; examTrack: string;
    preferredSlot?: string; priorAttempts: number; trainingCompleted: boolean; tenureDays: number;
    userId?: string;
  },
  actor: Actor,
) {
  const existing = await prisma.registration.findUnique({
    where: { driveId_employeeId: { driveId: input.driveId, employeeId: input.employeeId } },
  });
  if (existing) {
    await createException({
      type: "DuplicateRegistration", severity: "Medium",
      title: `Duplicate registration attempt for ${input.employeeId}`,
      driveId: input.driveId, registrationId: existing.id,
      description: "Candidate attempted to register again for the same drive.",
    });
    throw new Error("Duplicate registration: employee already registered for this drive");
  }

  const count = await prisma.registration.count();
  const registration = await prisma.registration.create({
    data: {
      registrationCode: generateCode("REG", count + 1),
      driveId: input.driveId,
      userId: input.userId,
      employeeId: input.employeeId,
      candidateName: input.candidateName,
      email: input.email,
      businessUnit: input.businessUnit,
      location: input.location,
      managerEmail: input.managerEmail,
      examTrack: input.examTrack,
      preferredSlot: input.preferredSlot,
      priorAttempts: input.priorAttempts,
      trainingCompleted: input.trainingCompleted,
      tenureDays: input.tenureDays,
      status: "Submitted",
    },
  });

  await writeAudit({
    entityType: "Registration", entityId: registration.id, action: "registration.submitted",
    actorId: actor.id, actorName: actor.name, after: { status: registration.status },
  });

  // Auto-acknowledge and send communication
  await acknowledgeRegistration(registration.id, actor);
  return registration;
}

export async function acknowledgeRegistration(registrationId: string, actor: Actor) {
  const reg = await prisma.registration.update({
    where: { id: registrationId },
    data: { status: "Acknowledged" },
  });

  const slaDue = new Date(Date.now() + ACK_SLA_MINUTES * 60 * 1000);
  const subject = "Registration Acknowledged — Maverick Certification Hub";
  const body = `Dear ${reg.candidateName},\n\nYour registration for the certification drive has been acknowledged. We will review your eligibility shortly.\n\nRegistration ID: ${reg.registrationCode}\n\nThank you,\nL&D Team`;

  await createCommunication({
    driveId: reg.driveId, registrationId: reg.id, recipientEmail: reg.email,
    templateType: "RegistrationAcknowledgement", subject, body, slaDueAt: slaDue,
  }, actor);

  return reg;
}

// ─── Communication Service ──────────────────────────────────────────────────

export async function createCommunication(
  input: {
    driveId: string; registrationId?: string; recipientEmail: string;
    templateType: string; subject: string; body: string; slaDueAt?: Date;
  },
  actor: Actor,
) {
  const comm = await prisma.communication.create({
    data: {
      driveId: input.driveId,
      registrationId: input.registrationId,
      recipientEmail: input.recipientEmail,
      templateType: input.templateType as never,
      subject: input.subject,
      body: input.body,
      status: "Queued",
      slaDueAt: input.slaDueAt,
    },
  });

  const result = await emailProvider.send({ to: input.recipientEmail, subject: input.subject, body: input.body });
  const updated = await prisma.communication.update({
    where: { id: comm.id },
    data: result.success
      ? { status: "Sent", sentAt: new Date() }
      : { status: "Failed", failureReason: result.error ?? "Send failed" },
  });

  if (!result.success) {
    await createException({
      type: "CommunicationFailed", severity: "High",
      title: `Communication failed: ${input.templateType}`,
      driveId: input.driveId, registrationId: input.registrationId,
      description: result.error,
    });
  }

  await writeAudit({
    entityType: "Communication", entityId: comm.id,
    action: result.success ? "communication.sent" : "communication.failed",
    actorId: actor.id, actorName: actor.name, after: { status: updated.status },
  });

  return updated;
}

// ─── Eligibility Engine ─────────────────────────────────────────────────────

export async function evaluateEligibility(registrationId: string, actor: Actor) {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { drive: true, approvals: true },
  });
  if (!reg) throw new Error("Registration not found");

  const drive = reg.drive;
  const criteria: CriteriaResult[] = [];

  const tenureOk = reg.tenureDays >= drive.tenureThreshold;
  criteria.push({ name: "Tenure", passed: tenureOk, detail: `${reg.tenureDays} days (min ${drive.tenureThreshold})` });

  const trainingOk = !drive.trainingRequired || reg.trainingCompleted;
  criteria.push({ name: "Training", passed: trainingOk, detail: reg.trainingCompleted ? "Completed" : "Not completed" });

  const attemptsOk = reg.priorAttempts < drive.maxPriorAttempts;
  criteria.push({ name: "Prior Attempts", passed: attemptsOk, detail: `${reg.priorAttempts} (max ${drive.maxPriorAttempts})` });

  const budgetOk = drive.budgetConsumed < drive.budget;
  criteria.push({ name: "Budget", passed: budgetOk, detail: `$${drive.budgetConsumed} of $${drive.budget} consumed` });

  let outcome: "Eligible" | "NotEligible" | "ApprovalRequired" | "ExceptionReview";
  if (!tenureOk || !trainingOk || !attemptsOk) {
    outcome = reg.priorAttempts >= drive.maxPriorAttempts ? "NotEligible" : "NotEligible";
  } else if (!budgetOk) {
    outcome = "ExceptionReview";
  } else if (drive.managerApproval !== "None") {
    const approved = reg.approvals.some((a) => a.status === "Approved");
    if (!approved) {
      outcome = "ApprovalRequired";
      criteria.push({ name: "Manager Approval", passed: false, detail: "Approval required" });
    } else {
      criteria.push({ name: "Manager Approval", passed: true, detail: "Approved" });
      outcome = "Eligible";
    }
  } else {
    outcome = "Eligible";
  }

  const criteriaJson: EligibilityCriteriaJson = {
    criteria,
    summary: outcome === "Eligible" ? "All criteria met" : `Outcome: ${outcome}`,
  };

  await prisma.eligibilityDecision.upsert({
    where: { registrationId },
    create: { registrationId, outcome, criteriaJson, evaluatedBy: actor.name },
    update: { outcome, criteriaJson, evaluatedAt: new Date(), evaluatedBy: actor.name },
  });

  let newStatus: RegistrationStatus;
  switch (outcome) {
    case "Eligible": newStatus = "Eligible"; break;
    case "NotEligible": newStatus = "NotEligible"; break;
    case "ApprovalRequired": newStatus = "ApprovalPending"; break;
    case "ExceptionReview": newStatus = "EligibilityPending"; break;
    default: newStatus = "EligibilityPending";
  }

  await prisma.registration.update({ where: { id: registrationId }, data: { status: newStatus } });

  if (outcome === "ApprovalRequired") {
    await requestApproval(registrationId, actor);
  }

  if (outcome === "NotEligible") {
    await createException({
      type: "NotEligible", severity: "Low", title: `Not eligible: ${reg.candidateName}`,
      driveId: reg.driveId, registrationId, description: criteriaJson.summary,
    });
    await createCommunication({
      driveId: reg.driveId, registrationId, recipientEmail: reg.email,
      templateType: "EligibilityRejected",
      subject: "Eligibility Update — Not Eligible",
      body: `Dear ${reg.candidateName},\n\nUnfortunately you do not meet eligibility criteria at this time.\n\n${criteriaJson.summary}`,
    }, actor);
  } else if (outcome === "Eligible") {
    await createCommunication({
      driveId: reg.driveId, registrationId, recipientEmail: reg.email,
      templateType: "EligibilityApproved",
      subject: "Eligibility Approved",
      body: `Dear ${reg.candidateName},\n\nYou have been confirmed eligible for the certification assessment.`,
    }, actor);
  }

  await writeAudit({
    entityType: "Registration", entityId: registrationId, action: "eligibility.evaluated",
    actorId: actor.id, actorName: actor.name, after: { outcome, criteria: criteriaJson },
  });

  return { outcome, criteriaJson };
}

export async function bulkEvaluateEligibility(driveId: string, actor: Actor) {
  const regs = await prisma.registration.findMany({
    where: { driveId, status: { in: ["Submitted", "Acknowledged", "EligibilityPending"] } },
  });
  const results = [];
  for (const reg of regs) {
    results.push(await evaluateEligibility(reg.id, actor));
  }
  return results;
}

// ─── Approval Workflow ────────────────────────────────────────────────────────

export async function requestApproval(registrationId: string, actor: Actor) {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId }, include: { drive: true },
  });
  if (!reg) throw new Error("Registration not found");

  const slaDue = new Date(Date.now() + APPROVAL_SLA_HOURS * 60 * 60 * 1000);
  const levels = reg.drive.managerApproval === "ManagerAndLD" ? [1, 2] : [1];

  for (const level of levels) {
    const approverEmail = level === 1 ? reg.managerEmail : "approver@maverick.local";
    await prisma.approval.create({
      data: {
        registrationId, driveId: reg.driveId, level,
        approverEmail, status: "Pending", slaDueAt: slaDue,
      },
    });
  }

  await prisma.registration.update({ where: { id: registrationId }, data: { status: "ApprovalPending" } });

  await createCommunication({
    driveId: reg.driveId, registrationId, recipientEmail: reg.managerEmail,
    templateType: "ApprovalRequest",
    subject: "Approval Required — Certification Drive",
    body: `Manager approval is required for ${reg.candidateName} (${reg.employeeId}) to participate in the certification drive.`,
    slaDueAt: slaDue,
  }, actor);

  await writeAudit({
    entityType: "Approval", entityId: registrationId, action: "approval.requested",
    actorId: actor.id, actorName: actor.name,
  });
}

export async function processApproval(approvalId: string, action: "approve" | "reject", actor: Actor, comments?: string) {
  const approval = await prisma.approval.findUnique({
    where: { id: approvalId }, include: { registration: { include: { drive: true } } },
  });
  if (!approval) throw new Error("Approval not found");

  const status = action === "approve" ? "Approved" : "Rejected";
  const updated = await prisma.approval.update({
    where: { id: approvalId },
    data: { status, comments, respondedAt: new Date(), approverId: actor.id },
  });

  const reg = approval.registration;
  if (action === "reject") {
    await prisma.registration.update({ where: { id: reg.id }, data: { status: "Rejected" } });
  } else {
    const pendingApprovals = await prisma.approval.count({
      where: { registrationId: reg.id, status: "Pending" },
    });
    if (pendingApprovals === 0) {
      await prisma.registration.update({ where: { id: reg.id }, data: { status: "Approved" } });
      await evaluateEligibility(reg.id, actor);
    }
  }

  await writeAudit({
    entityType: "Approval", entityId: approvalId, action: `approval.${action}d`,
    actorId: actor.id, actorName: actor.name, after: { status, comments },
  });
  return updated;
}

// ─── Assessment Service ───────────────────────────────────────────────────────

export async function scheduleAssessment(registrationId: string, date: Date, slot: string, actor: Actor) {
  const reg = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!reg) throw new Error("Registration not found");

  await prisma.assessmentResult.create({
    data: { registrationId, driveId: reg.driveId, assessmentDate: date, slot, attendance: "Scheduled" },
  });
  await prisma.registration.update({ where: { id: registrationId }, data: { status: "Scheduled" } });

  await createCommunication({
    driveId: reg.driveId, registrationId, recipientEmail: reg.email,
    templateType: "AssessmentScheduled",
    subject: "Assessment Scheduled",
    body: `Dear ${reg.candidateName},\n\nYour assessment is scheduled for ${date.toLocaleDateString()} at slot ${slot}.`,
  }, actor);

  await writeAudit({
    entityType: "Assessment", entityId: registrationId, action: "assessment.scheduled",
    actorId: actor.id, actorName: actor.name,
  });
}

export async function importResults(driveId: string, csvText: string, actor: Actor) {
  const drive = await prisma.drive.findUnique({ where: { id: driveId } });
  if (!drive) throw new Error("Drive not found");

  const rows = parseCsvResults(csvText);
  const results = [];

  for (const row of rows) {
    const reg = await prisma.registration.findUnique({
      where: { driveId_employeeId: { driveId, employeeId: row.employeeId } },
    });
    if (!reg) {
      await createException({
        type: "ResultImportError", severity: "Medium",
        title: `Import error: unknown employee ${row.employeeId}`,
        driveId, description: "Employee not found in drive registrations",
      });
      continue;
    }

    const outcome = row.attended && row.score >= drive.passThreshold ? "Passed" : "Failed";
    const attendance = row.attended ? "Attended" : "NoShow";

    await prisma.assessmentResult.create({
      data: {
        registrationId: reg.id, driveId,
        score: row.score, outcome, attendance,
        assessmentDate: new Date(), uploadedById: actor.id,
      },
    });

    const newStatus: RegistrationStatus = outcome === "Passed" ? "Passed" : "Failed";
    await prisma.registration.update({ where: { id: reg.id }, data: { status: newStatus } });

    await createCommunication({
      driveId, registrationId: reg.id, recipientEmail: reg.email,
      templateType: outcome === "Passed" ? "ResultPassed" : "ResultFailed",
      subject: `Assessment Result: ${outcome}`,
      body: `Dear ${reg.candidateName},\n\nYour assessment result: ${outcome}. Score: ${row.score}.`,
    }, actor);

    results.push({ employeeId: row.employeeId, outcome, score: row.score });
  }

  await writeAudit({
    entityType: "Assessment", entityId: driveId, action: "assessment.results_imported",
    actorId: actor.id, actorName: actor.name, metadata: { count: results.length },
  });
  return results;
}

// ─── Voucher Service ──────────────────────────────────────────────────────────

export async function importVouchers(
  input: { driveId: string; vendor: string; certificationTrack: string; codes: string[]; value: number; currency: string; expiryDate: Date },
  actor: Actor,
) {
  const created = [];
  for (const code of input.codes) {
    const trimmed = code.trim();
    if (!trimmed) continue;
    const codeHash = hashValue(trimmed);
    const existing = await prisma.voucher.findUnique({ where: { codeHash } });
    if (existing) continue;

    const voucher = await prisma.voucher.create({
      data: {
        driveId: input.driveId,
        vendor: input.vendor,
        certificationTrack: input.certificationTrack,
        encryptedCode: encryptCode(trimmed),
        codeHash,
        maskedCode: maskVoucherCode(trimmed),
        value: input.value,
        currency: input.currency,
        expiryDate: input.expiryDate,
        status: "Available",
      },
    });
    created.push(voucher);
  }

  await writeAudit({
    entityType: "Voucher", entityId: input.driveId, action: "voucher.imported",
    actorId: actor.id, actorName: actor.name, metadata: { count: created.length },
  });
  return created;
}

export async function allocateVoucher(registrationId: string, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const reg = await tx.registration.findUnique({
      where: { id: registrationId },
      include: { drive: true, vouchers: { where: { status: { in: ["Issued", "Reserved"] } } } },
    });
    if (!reg) throw new Error("Registration not found");
    if (reg.status !== "Passed") {
      throw new Error("Candidate must have passed assessment to receive voucher");
    }

    if (reg.vouchers.length > 0) {
      throw new Error("Candidate already has an active voucher — duplicate issuance prevented");
    }

    const voucher = await tx.voucher.findFirst({
      where: {
        driveId: reg.driveId,
        certificationTrack: reg.examTrack,
        status: "Available",
        expiryDate: { gt: new Date() },
      },
      orderBy: { expiryDate: "asc" },
    });

    if (!voucher) {
      await createException({
        type: "VoucherUnavailable", severity: "Critical",
        title: `No vouchers available for ${reg.examTrack}`,
        driveId: reg.driveId, registrationId,
      });
      throw new Error("No available vouchers for this track");
    }

    const updated = await tx.voucher.update({
      where: { id: voucher.id },
      data: {
        status: "Issued",
        assignedRegistrationId: reg.id,
        assignedEmployeeId: reg.employeeId,
        deliveryDate: new Date(),
      },
    });

    await tx.registration.update({ where: { id: registrationId }, data: { status: "VoucherIssued" } });
    await tx.drive.update({
      where: { id: reg.driveId },
      data: { budgetConsumed: { increment: voucher.value } },
    });

  const token = generateToken();
  await tx.voucherDeliveryToken.create({
    data: { voucherId: updated.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 7 * 86400 * 1000) },
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const deliveryLink = `${appUrl}/voucher-access?token=${token}`;

  await createCommunication({
    driveId: reg.driveId, registrationId, recipientEmail: reg.email,
    templateType: "VoucherIssued",
    subject: "Your Certification Voucher",
    body: `Dear ${reg.candidateName},\n\nYour voucher has been issued. Access it securely here:\n${deliveryLink}\n\nThis link expires in 7 days.`,
  }, actor);

  await writeAudit({
    entityType: "Voucher", entityId: voucher.id, action: "voucher.allocated",
    actorId: actor.id, actorName: actor.name,
    after: { registrationId, maskedCode: updated.maskedCode },
  });

  return { voucher: updated, token };
  });
}

export async function reissueVoucher(registrationId: string, reason: string, actor: Actor) {
  const existing = await prisma.voucher.findFirst({
    where: { assignedRegistrationId: registrationId, status: "Issued" },
  });
  if (existing) {
    await prisma.voucher.update({
      where: { id: existing.id },
      data: { status: "Revoked", revokedAt: new Date(), reissueReason: reason },
    });
    await writeAudit({
      entityType: "Voucher", entityId: existing.id, action: "voucher.revoked",
      actorId: actor.id, actorName: actor.name, metadata: { reason },
    });
  }
  return allocateVoucher(registrationId, actor);
}

export async function accessVoucherToken(token: string, actor: Actor) {
  const tokenHash = hashToken(token);
  const deliveryToken = await prisma.voucherDeliveryToken.findUnique({
    where: { tokenHash },
    include: { voucher: { include: { assignedRegistration: true } } },
  });

  if (!deliveryToken) throw new Error("Invalid or expired token");
  if (deliveryToken.expiresAt < new Date()) throw new Error("Token has expired");
  if (deliveryToken.voucher.status === "Revoked") throw new Error("Voucher has been revoked");

  if (!deliveryToken.usedAt) {
    await prisma.voucherDeliveryToken.update({ where: { id: deliveryToken.id }, data: { usedAt: new Date() } });
    await prisma.voucher.update({ where: { id: deliveryToken.voucherId }, data: { readDate: new Date() } });
    await writeAudit({
      entityType: "Voucher", entityId: deliveryToken.voucherId, action: "voucher.token_opened",
      actorId: actor.id, actorName: actor.name,
    });
  }

  return deliveryToken.voucher;
}

export async function revealVoucherCode(voucherId: string, actor: Actor) {
  const voucher = await prisma.voucher.findUnique({ where: { id: voucherId } });
  if (!voucher) throw new Error("Voucher not found");
  const code = decryptCode(voucher.encryptedCode);
  await writeAudit({
    entityType: "Voucher", entityId: voucherId, action: "voucher.code_revealed",
    actorId: actor.id, actorName: actor.name,
  });
  return code;
}

export async function redeemVoucher(voucherId: string, actor: Actor) {
  const voucher = await prisma.voucher.findUnique({ where: { id: voucherId } });
  if (!voucher) throw new Error("Voucher not found");
  if (voucher.status === "Revoked") throw new Error("Revoked voucher cannot be redeemed");
  if (voucher.status === "Expired") throw new Error("Expired voucher cannot be redeemed");

  const updated = await prisma.voucher.update({
    where: { id: voucherId },
    data: { status: "Redeemed", redeemDate: new Date() },
  });

  if (voucher.assignedRegistrationId) {
    await prisma.registration.update({
      where: { id: voucher.assignedRegistrationId },
      data: { status: "VoucherRedeemed" },
    });
  }

  await writeAudit({
    entityType: "Voucher", entityId: voucherId, action: "voucher.redeemed",
    actorId: actor.id, actorName: actor.name,
  });
  return updated;
}

// ─── Exception Service ────────────────────────────────────────────────────────

export async function createException(input: {
  type: string; severity?: string; title: string; description?: string;
  driveId?: string; registrationId?: string; ownerId?: string;
}) {
  return prisma.exceptionRecord.create({
    data: {
      type: input.type as never,
      severity: (input.severity ?? "Medium") as never,
      title: input.title,
      description: input.description,
      driveId: input.driveId,
      registrationId: input.registrationId,
      ownerId: input.ownerId,
      status: "Open",
    },
  });
}

export async function resolveException(id: string, notes: string, actor: Actor) {
  const ex = await prisma.exceptionRecord.update({
    where: { id },
    data: { status: "Resolved", resolutionNotes: notes, resolvedAt: new Date() },
  });
  await writeAudit({
    entityType: "Exception", entityId: id, action: "exception.resolved",
    actorId: actor.id, actorName: actor.name, after: { notes },
  });
  return ex;
}

// ─── Automation Service ─────────────────────────────────────────────────────────

export async function runDailyAutomation(actor: Actor) {
  const run = await prisma.automationRun.create({ data: { runType: "daily", status: "Running" } });
  const summary: Record<string, number> = {
    remindersCreated: 0, vouchersExpired: 0, approvalsEscalated: 0, commFailuresFlagged: 0,
  };

  try {
    const now = new Date();
    const vouchers = await prisma.voucher.findMany({
      where: { status: { in: ["Issued", "Available"] } },
    });

    for (const v of vouchers) {
      const daysLeft = Math.ceil((v.expiryDate.getTime() - now.getTime()) / 86400000);
      if (daysLeft <= 0 && v.status !== "Redeemed") {
        await prisma.voucher.update({ where: { id: v.id }, data: { status: "Expired" } });
        summary.vouchersExpired++;
      } else if (v.status === "Issued" && v.assignedRegistrationId) {
        const reg = await prisma.registration.findUnique({ where: { id: v.assignedRegistrationId } });
        if (reg && [30, 7, 3].includes(daysLeft)) {
          const template = daysLeft === 30 ? "VoucherReminderT30" : daysLeft === 7 ? "VoucherReminderT7" : "VoucherReminderT3";
          await createCommunication({
            driveId: v.driveId, registrationId: v.assignedRegistrationId,
            recipientEmail: reg.email, templateType: template,
            subject: `Voucher Expiring in ${daysLeft} Days`,
            body: `Your certification voucher expires in ${daysLeft} days. Please redeem it soon.`,
          }, actor);
          summary.remindersCreated++;
        }
        if (daysLeft <= 30 && daysLeft > 0) {
          await createException({
            type: "VoucherExpiryRisk", severity: daysLeft <= 7 ? "High" : "Medium",
            title: `Voucher expiring in ${daysLeft} days`,
            driveId: v.driveId, registrationId: v.assignedRegistrationId,
          });
        }
      }
    }

    const overdueApprovals = await prisma.approval.findMany({
      where: { status: "Pending", slaDueAt: { lt: now } },
    });
    for (const a of overdueApprovals) {
      await prisma.approval.update({ where: { id: a.id }, data: { status: "Escalated" } });
      await createException({
        type: "ApprovalOverdue", severity: "High",
        title: `Approval overdue for registration`,
        driveId: a.driveId, registrationId: a.registrationId,
      });
      summary.approvalsEscalated++;
    }

    const failedComms = await prisma.communication.findMany({ where: { status: "Failed" } });
    for (const c of failedComms) {
      await createException({
        type: "CommunicationFailed", severity: "High",
        title: `Failed communication: ${c.templateType}`,
        driveId: c.driveId, registrationId: c.registrationId ?? undefined,
      });
      summary.commFailuresFlagged++;
    }

    const breachedComms = await prisma.communication.findMany({
      where: { status: "Queued", slaDueAt: { lt: now } },
    });
    for (const c of breachedComms) {
      await createException({
        type: "SLABreached", severity: "Critical",
        title: `SLA breached: ${c.templateType}`,
        driveId: c.driveId, registrationId: c.registrationId ?? undefined,
      });
    }

    await prisma.automationRun.update({
      where: { id: run.id },
      data: { status: "Completed", completedAt: new Date(), summaryJson: summary },
    });
  } catch (e) {
    await prisma.automationRun.update({
      where: { id: run.id },
      data: { status: "Failed", completedAt: new Date(), error: String(e) },
    });
    throw e;
  }

  await writeAudit({
    entityType: "Automation", entityId: run.id, action: "automation.completed",
    actorId: actor.id, actorName: actor.name, metadata: summary,
  });
  return { runId: run.id, summary };
}

// ─── Dashboard / Reporting ──────────────────────────────────────────────────────

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [activeDrives, totalRegistrations, eligible, pendingApprovals, passed, failed, vouchers, redeemed, comms, breached] = await Promise.all([
    prisma.drive.count({ where: { status: "Active" } }),
    prisma.registration.count(),
    prisma.registration.count({ where: { status: { in: ["Eligible", "Approved", "Passed"] } } }),
    prisma.approval.count({ where: { status: "Pending" } }),
    prisma.registration.count({ where: { status: "Passed" } }),
    prisma.registration.count({ where: { status: "Failed" } }),
    prisma.voucher.count({ where: { status: { in: ["Issued", "Redeemed"] } } }),
    prisma.voucher.count({ where: { status: "Redeemed" } }),
    prisma.communication.count({ where: { status: "Sent" } }),
    prisma.communication.count({ where: { status: { in: ["Queued", "Failed"] }, slaDueAt: { lt: new Date() } } }),
  ]);

  const budget = await prisma.drive.aggregate({ _sum: { budgetConsumed: true } });
  const passTotal = passed + failed;

  return {
    activeDrives,
    totalRegistrations,
    eligibleCandidates: eligible,
    pendingApprovals,
    passRate: passTotal ? Math.round((passed / passTotal) * 100) : 0,
    voucherUtilization: vouchers ? Math.round((redeemed / vouchers) * 100) : 0,
    slaCompliance: comms ? Math.round(((comms - breached) / (comms + breached || 1)) * 100) : 100,
    budgetConsumed: budget._sum.budgetConsumed ?? 0,
  };
}

export async function getFunnelData(driveId?: string): Promise<FunnelStage[]> {
  const where = driveId ? { driveId } : {};
  const statuses: Array<{ stage: string; statuses: RegistrationStatus[] }> = [
    { stage: "Registered", statuses: ["Submitted", "Acknowledged", "EligibilityPending", "Eligible", "NotEligible", "ApprovalPending", "Approved", "Rejected", "Scheduled", "Attended", "Passed", "Failed", "VoucherIssued", "VoucherRedeemed", "Closed"] },
    { stage: "Eligible", statuses: ["Eligible", "Approved", "Scheduled", "Attended", "Passed", "Failed", "VoucherIssued", "VoucherRedeemed"] },
    { stage: "Scheduled", statuses: ["Scheduled", "Attended", "Passed", "Failed", "VoucherIssued", "VoucherRedeemed"] },
    { stage: "Attended", statuses: ["Attended", "Passed", "Failed", "VoucherIssued", "VoucherRedeemed"] },
    { stage: "Passed", statuses: ["Passed", "VoucherIssued", "VoucherRedeemed"] },
    { stage: "Voucher Issued", statuses: ["VoucherIssued", "VoucherRedeemed"] },
    { stage: "Redeemed", statuses: ["VoucherRedeemed"] },
  ];

  const results: FunnelStage[] = [];
  for (const s of statuses) {
    const count = await prisma.registration.count({ where: { ...where, status: { in: s.statuses } } });
    results.push({ stage: s.stage, count });
  }
  return results;
}

export async function getRecentAuditLogs(limit = 10) {
  return prisma.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: limit });
}

export async function getRiskItems() {
  const now = new Date();
  const lowInventory = await prisma.voucher.groupBy({
    by: ["certificationTrack", "driveId"],
    where: { status: "Available" },
    _count: { id: true },
  });
  const lowStock = lowInventory.filter((g) => g._count.id < 5);

  const overdueApprovals = await prisma.approval.count({ where: { status: { in: ["Pending", "Escalated"] }, slaDueAt: { lt: now } } });
  const expiringVouchers = await prisma.voucher.count({
    where: { status: "Issued", expiryDate: { lte: new Date(Date.now() + 30 * 86400000) } },
  });
  const failedComms = await prisma.communication.count({ where: { status: "Failed" } });

  return { lowStock, overdueApprovals, expiringVouchers, failedComms };
}

export async function getChartData() {
  const drives = await prisma.drive.findMany({ select: { id: true, name: true } });
  const registrationsByDrive = await Promise.all(
    drives.map(async (d) => ({
      name: d.name.length > 20 ? d.name.slice(0, 20) + "…" : d.name,
      count: await prisma.registration.count({ where: { driveId: d.id } }),
    })),
  );

  const passFail = await prisma.assessmentResult.groupBy({
    by: ["outcome"],
    _count: { id: true },
  });

  const vouchersByVendor = await prisma.voucher.groupBy({
    by: ["vendor"],
    _count: { id: true },
  });

  const voucherAging = await prisma.voucher.findMany({
    where: { status: { in: ["Issued", "Available"] } },
    select: { expiryDate: true, status: true },
  });

  return { registrationsByDrive, passFail, vouchersByVendor, voucherAging };
}
