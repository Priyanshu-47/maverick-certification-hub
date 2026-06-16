import { PrismaClient } from "@prisma/client";
import { createCipheriv, scryptSync, randomBytes, createHash } from "crypto";

const prisma = new PrismaClient();

const ALGO = "aes-256-gcm";
function encryptCode(plain: string, secret: string): string {
  const key = scryptSync(secret, "maverick-salt", 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}
function hashValue(v: string) { return createHash("sha256").update(v).digest("hex"); }
function mask(code: string) { return "*".repeat(Math.max(0, code.length - 4)) + code.slice(-4); }

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "dev-only-key-do-not-use-in-prod";
const TRACKS = ["Azure Administrator", "Azure Developer", "AWS Solutions Architect", "Security Specialist"];
const LOCATIONS = ["New York", "London", "Singapore", "Dallas", "Chicago", "Bangalore", "Mumbai"];
const BUs = ["Technology", "Finance", "Operations", "Risk", "Legal", "Marketing", "HR"];
const VENDORS = ["Microsoft", "AWS", "CompTIA", "ISC2", "Google"];
const FIRST_NAMES = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan", "Shaurya", "Atharv", "Advik", "Pranav", "Advaith", "Aarush", "Diya", "Ananya", "Priya", "Kavya", "Aanya", "Aadhya", "Navya", "Saanvi", "Myra", "Pari", "Rahul", "Rohan", "Amit", "Suresh", "Vikram", "Sanjay", "Deepak", "Neha", "Pooja", "Simran", "Anjali", "Kavita", "Sunita", "Meera", "Ritu"];
const LAST_NAMES = ["Sharma", "Patel", "Kumar", "Singh", "Reddy", "Nair", "Gupta", "Joshi", "Mishra", "Verma", "Das", "Mukherjee", "Iyer", "Pillai", "Rao"];

function randItem<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function main() {
  console.log("Seeding Maverick Certification Hub...");

  // Clear all
  await prisma.agentActivity.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.exceptionRecord.deleteMany();
  await prisma.automationRun.deleteMany();
  await prisma.voucherDeliveryToken.deleteMany();
  await prisma.communication.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.assessmentResult.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.eligibilityDecision.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.repositoryFolder.deleteMany();
  await prisma.drive.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();

  // ─── Users ───────────────────────────────────────────────────────────────
  const users = await Promise.all([
    prisma.user.create({ data: { email: "admin@maverick.local", name: "Sarah Chen", role: "Admin", employeeId: "EMP001" } }),
    prisma.user.create({ data: { email: "coordinator@maverick.local", name: "James Wilson", role: "Coordinator", employeeId: "EMP002" } }),
    prisma.user.create({ data: { email: "approver@maverick.local", name: "Maria Garcia", role: "Approver", employeeId: "EMP003" } }),
    prisma.user.create({ data: { email: "readonly@maverick.local", name: "David Park", role: "ReadOnly", employeeId: "EMP004" } }),
  ]);
  const [admin, coordinator, approver] = users;

  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000);
  const in14 = new Date(now.getTime() + 14 * 86400000);
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const in60 = new Date(now.getTime() + 60 * 86400000);
  const in90 = new Date(now.getTime() + 90 * 86400000);
  const past30 = new Date(now.getTime() - 30 * 86400000);
  const past60 = new Date(now.getTime() - 60 * 86400000);
  const past120 = new Date(now.getTime() - 120 * 86400000);

  const repoFolders = [
    { name: "01_Registrations", path: "01_Registrations", sortOrder: 1 },
    { name: "02_Attendance", path: "02_Attendance", sortOrder: 2 },
    { name: "03_Assessments", path: "03_Assessments", sortOrder: 3 },
    { name: "04_Vouchers", path: "04_Vouchers", sortOrder: 4 },
    { name: "99_Audit", path: "99_Audit", sortOrder: 99 },
  ];

  // ─── Drives ──────────────────────────────────────────────────────────────
  const activeDrive = await prisma.drive.create({
    data: {
      driveCode: "DRV-00001", name: "Q2 2026 Cloud Certification Drive", sponsor: "Technology L&D",
      ownerId: admin.id, budget: 50000, budgetConsumed: 18500,
      startDate: past30, endDate: in90, registrationDeadline: in30,
      targetCount: 100, status: "Active", tracks: TRACKS, locations: LOCATIONS,
      tenureThreshold: 90, trainingRequired: true, maxPriorAttempts: 2,
      managerApproval: "ManagerOnly", passThreshold: 70, createdById: admin.id,
      repositoryFolders: { create: repoFolders },
    },
  });

  const publishedDrive = await prisma.drive.create({
    data: {
      driveCode: "DRV-00002", name: "Q3 2026 Security Certification Drive", sponsor: "Cybersecurity",
      ownerId: coordinator.id, budget: 30000, budgetConsumed: 0,
      startDate: in30, endDate: in90, registrationDeadline: in30,
      targetCount: 50, status: "Published", tracks: ["Security Specialist", "AWS Solutions Architect"],
      locations: LOCATIONS.slice(0, 4), createdById: admin.id,
      repositoryFolders: { create: repoFolders },
    },
  });

  const draftDrive = await prisma.drive.create({
    data: {
      driveCode: "DRV-00003", name: "Q4 2026 AI/ML Certification Drive", sponsor: "Data Science",
      ownerId: coordinator.id, budget: 25000, startDate: in60, endDate: in90,
      registrationDeadline: in60, targetCount: 30, status: "Draft",
      tracks: ["Azure Developer", "AWS Solutions Architect"], locations: LOCATIONS.slice(0, 3),
      createdById: admin.id, repositoryFolders: { create: repoFolders },
    },
  });

  const closedDrive = await prisma.drive.create({
    data: {
      driveCode: "DRV-00004", name: "Q1 2026 Azure Certification Drive", sponsor: "Technology L&D",
      ownerId: admin.id, budget: 40000, budgetConsumed: 38000,
      startDate: past120, endDate: past30, registrationDeadline: new Date(now.getTime() - 90 * 86400000),
      targetCount: 80, status: "Closed", tracks: ["Azure Administrator", "Azure Developer"],
      locations: LOCATIONS, createdById: admin.id,
      repositoryFolders: { create: repoFolders },
    },
  });

  // ─── Registrations ───────────────────────────────────────────────────────
  const STATUSES = ["Submitted", "Acknowledged", "EligibilityPending", "Eligible", "NotEligible",
    "ApprovalPending", "Approved", "Rejected", "Scheduled", "Attended", "Passed", "Failed",
    "VoucherIssued", "VoucherRedeemed", "Closed"] as const;

  const regCounts: Record<string, number> = {};
  for (let i = 1; i <= 80; i++) {
    const drive = i <= 50 ? activeDrive : i <= 65 ? closedDrive : publishedDrive;
    const status = STATUSES[i % STATUSES.length];
    const track = TRACKS[i % TRACKS.length];
    const tenure = randInt(30, 250);
    const training = i % 5 !== 0;
    const attempts = i % 8 === 0 ? 2 : i % 6 === 0 ? 1 : 0;
    const firstName = randItem(FIRST_NAMES);
    const lastName = randItem(LAST_NAMES);
    const empId = `EMP${String(100 + i).padStart(3, "0")}`;

    const reg = await prisma.registration.create({
      data: {
        registrationCode: `REG-${String(i).padStart(5, "0")}`,
        driveId: drive.id, employeeId: empId,
        candidateName: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`,
        businessUnit: randItem(BUs), location: randItem(LOCATIONS),
        managerEmail: `manager${i}@company.com`,
        examTrack: track, preferredSlot: `Slot ${randInt(1, 3)}`,
        priorAttempts: attempts, trainingCompleted: training, tenureDays: tenure,
        status, submittedAt: new Date(now.getTime() - randInt(1, 60) * 86400000),
      },
    });
    regCounts[drive.id] = (regCounts[drive.id] || 0) + 1;

    if (["Eligible", "Approved", "Passed", "Failed", "VoucherIssued", "VoucherRedeemed", "Closed"].includes(status)) {
      const outcome = tenure >= 90 && training && attempts < 2 ? "Eligible" : attempts >= 2 ? "NotEligible" : "ApprovalRequired";
      await prisma.eligibilityDecision.create({
        data: {
          registrationId: reg.id, outcome: outcome as never,
          criteriaJson: {
            criteria: [
              { name: "Tenure", passed: tenure >= 90, detail: `${tenure} days` },
              { name: "Training", passed: training, detail: training ? "Completed" : "Not completed" },
              { name: "Prior Attempts", passed: attempts < 2, detail: `${attempts}` },
            ],
            summary: outcome,
          },
        },
      });
    }

    if (status === "ApprovalPending") {
      await prisma.approval.create({
        data: {
          registrationId: reg.id, driveId: drive.id, level: 1,
          approverId: approver.id, approverEmail: approver.email,
          status: "Pending", slaDueAt: new Date(now.getTime() + (i % 3 === 0 ? -86400000 : 86400000)),
        },
      });
    }

    if (["Scheduled", "Attended", "Passed", "Failed", "VoucherIssued", "VoucherRedeemed", "Closed"].includes(status)) {
      const score = randInt(45, 98);
      const outcome = status === "Failed" ? "Failed" : status === "Scheduled" ? "Pending" : "Passed";
      await prisma.assessmentResult.create({
        data: {
          registrationId: reg.id, driveId: drive.id,
          assessmentDate: new Date(now.getTime() - randInt(1, 30) * 86400000),
          slot: `Slot ${randInt(1, 3)}`, attendance: "Attended",
          score: outcome === "Failed" ? randInt(30, 64) : score,
          outcome, uploadedById: coordinator.id,
        },
      });
    }
  }

  // ─── Vouchers ────────────────────────────────────────────────────────────
  let vIdx = 0;
  for (const drive of [activeDrive, closedDrive]) {
    for (let v = 0; v < 30; v++) {
      vIdx++;
      const code = `VOUCHER-${drive.driveCode}-${String(vIdx).padStart(4, "0")}`;
      const track = TRACKS[v % TRACKS.length];
      const vendor = VENDORS[v % VENDORS.length];
      const expiry = new Date(now.getTime() + randInt(7, 90) * 86400000);
      let status: "Available" | "Issued" | "Redeemed" | "Expired" = "Available";
      if (vIdx % 5 === 0) status = "Issued";
      if (vIdx % 8 === 0) status = "Redeemed";
      if (vIdx % 12 === 0) status = "Expired";

      await prisma.voucher.create({
        data: {
          driveId: drive.id, vendor, certificationTrack: track,
          encryptedCode: encryptCode(code, ENCRYPTION_KEY),
          codeHash: hashValue(code), maskedCode: mask(code),
          value: randInt(100, 400), currency: "USD", expiryDate: expiry, status,
        },
      });
    }
  }

  // Assign vouchers to passed registrations
  const passedRegs = await prisma.registration.findMany({
    where: { status: { in: ["Passed", "VoucherIssued", "VoucherRedeemed"] } }, take: 15,
  });
  for (const reg of passedRegs) {
    const voucher = await prisma.voucher.findFirst({
      where: { driveId: reg.driveId, certificationTrack: reg.examTrack, status: "Available" },
    });
    if (!voucher) continue;
    const newStatus = reg.status === "VoucherRedeemed" ? "Redeemed" : "Issued";
    await prisma.voucher.update({
      where: { id: voucher.id },
      data: {
        status: newStatus, assignedRegistrationId: reg.id, assignedEmployeeId: reg.employeeId,
        deliveryDate: new Date(),
        readDate: newStatus === "Redeemed" ? new Date() : undefined,
        redeemDate: newStatus === "Redeemed" ? new Date() : undefined,
      },
    });
    if (reg.status === "Passed") {
      await prisma.registration.update({ where: { id: reg.id }, data: { status: "VoucherIssued" } });
    }
  }

  // ─── Communications ──────────────────────────────────────────────────────
  const commTypes = ["RegistrationAcknowledgement", "EligibilityApproved", "EligibilityRejected", "ApprovalRequest", "AssessmentScheduled", "ResultPassed", "ResultFailed", "VoucherIssued", "VoucherReminderT30", "VoucherReminderT7", "VoucherReminderT3"] as const;
  const allRegs = await prisma.registration.findMany({ take: 30 });
  for (const reg of allRegs) {
    const commType = randItem([...commTypes]);
    await prisma.communication.create({
      data: {
        driveId: reg.driveId, registrationId: reg.id, recipientEmail: reg.email,
        templateType: commType,
        subject: commType.replace(/([A-Z])/g, " $1").trim(),
        body: `Dear ${reg.candidateName}, this is a notification regarding your ${commType.replace(/([A-Z])/g, " $1").trim().toLowerCase()} for the certification drive.`,
        status: randItem(["Sent", "Queued", "Sent", "Sent"]),
        sentAt: new Date(now.getTime() - randInt(1, 14) * 86400000),
        slaDueAt: new Date(now.getTime() + randInt(-2, 5) * 86400000),
      },
    });
  }

  // ─── Audit Logs ──────────────────────────────────────────────────────────
  const actions = ["drive.created", "drive.published", "drive.activated", "registration.submitted", "registration.acknowledged",
    "eligibility.evaluated", "assessment.imported", "voucher.allocated", "voucher.delivered", "approval.approved",
    "approval.rejected", "communication.sent", "automation.run", "exception.raised"];
  for (let a = 1; a <= 40; a++) {
    await prisma.auditLog.create({
      data: {
        entityType: randItem(["Drive", "Registration", "Voucher", "Approval", "Communication"]),
        entityId: activeDrive.id, action: randItem(actions),
        actorId: randItem([admin.id, coordinator.id, approver.id]),
        actorName: randItem([admin.name, coordinator.name, approver.name]),
        timestamp: new Date(now.getTime() - a * randInt(1, 6) * 3600000),
        afterJson: { seeded: true, index: a },
      },
    });
  }

  // ─── Exceptions ──────────────────────────────────────────────────────────
  const excTypes = ["DuplicateRegistration", "NotEligible", "ApprovalOverdue", "VoucherUnavailable", "VoucherExpiryRisk", "CommunicationFailed", "SLABreached", "ResultImportError"] as const;
  for (let e = 0; e < 10; e++) {
    await prisma.exceptionRecord.create({
      data: {
        driveId: activeDrive.id, type: excTypes[e % excTypes.length],
        severity: e % 4 === 0 ? "Critical" : e % 3 === 0 ? "High" : e % 2 === 0 ? "Medium" : "Low",
        title: `${excTypes[e % excTypes.length].replace(/([A-Z])/g, " $1").trim()} — Candidate ${randItem(FIRST_NAMES)}`,
        description: `Auto-detected exception for demo. ${excTypes[e % excTypes.length]} requires attention.`,
        ownerId: randItem([admin.id, coordinator.id]),
        status: e % 3 === 0 ? "Open" : e % 3 === 1 ? "InProgress" : "Resolved",
      },
    });
  }

  // ─── Approvals (pending ones for approver page) ──────────────────────────
  const pendingRegs = await prisma.registration.findMany({
    where: { status: "ApprovalPending" }, take: 5,
  });
  for (const reg of pendingRegs) {
    await prisma.approval.create({
      data: {
        registrationId: reg.id, driveId: reg.driveId, level: 1,
        approverId: approver.id, approverEmail: approver.email,
        status: "Pending", slaDueAt: new Date(now.getTime() + randInt(-1, 3) * 86400000),
      },
    });
  }

  // ─── Settings ────────────────────────────────────────────────────────────
  await prisma.setting.createMany({
    data: [
      { key: "ack_sla_minutes", value: "5" },
      { key: "approval_sla_hours", value: "48" },
      { key: "default_pass_threshold", value: "70" },
      { key: "org_name", value: "Maverick Certification Hub" },
    ],
  });

  // ─── Automation Runs ─────────────────────────────────────────────────────
  for (let r = 0; r < 5; r++) {
    await prisma.automationRun.create({
      data: {
        runType: r % 2 === 0 ? "daily" : "weekly",
        status: "Completed",
        summaryJson: { remindersCreated: randInt(1, 5), vouchersExpired: randInt(0, 2), approvalsEscalated: randInt(0, 3) },
        startedAt: new Date(now.getTime() - (r + 1) * 86400000),
        completedAt: new Date(now.getTime() - (r + 1) * 86400000 + 60000),
      },
    });
  }

  // ─── Agent Activities ────────────────────────────────────────────────────
  const agentActivities = [
    { agentType: "Drive", action: "health-check", entityType: "Drive", reasoning: "Drive 'Cloud Certification' is Active with 50 registrations. Health score: 85/100.", riskLevel: "low", status: "auto-executed" },
    { agentType: "Compliance", action: "eligibility-audit", entityType: "Drive", reasoning: "Audited 50 registrations. 40 eligible, 5 pending, 5 not eligible.", riskLevel: "low", status: "auto-executed" },
    { agentType: "Voucher", action: "inventory-check", entityType: "Voucher", reasoning: "30 vouchers available. 12 issued, 6 redeemed. Inventory sufficient.", riskLevel: "low", status: "auto-executed" },
    { agentType: "Comms", action: "sla-check", entityType: "Communication", reasoning: "25 communications sent today. 2 failed (retry needed). SLA at 92%.", riskLevel: "medium", status: "auto-executed" },
    { agentType: "ROI", action: "drive-summary", entityType: "Drive", reasoning: "Budget: $50K. Consumed: $18.5K (37%). 15 passed. Estimated ROI: 280%.", riskLevel: "low", status: "auto-executed" },
    { agentType: "Drive", action: "recommendation", entityType: "Drive", reasoning: "Published drive 'Security' has 0 registrations. Recommend promoting to Engineering BU.", riskLevel: "low", status: "approved" },
    { agentType: "Voucher", action: "leakage-alert", entityType: "Voucher", reasoning: "4 vouchers issued 20+ days ago not accessed. Risk of leakage.", riskLevel: "medium", status: "pending" },
    { agentType: "Compliance", action: "policy-review", entityType: "PolicyRule", reasoning: "Eligibility policy v2 active for 14 days. 92% pass rate. No anomalies.", riskLevel: "low", status: "auto-executed" },
    { agentType: "Drive", action: "risk-assessment", entityType: "Drive", reasoning: "3 candidates at risk of missing assessment deadline. Sending reminders.", riskLevel: "high", status: "pending" },
    { agentType: "ROI", action: "cost-analysis", entityType: "Drive", reasoning: "Cost per certification: $310. Industry average: $450. Below benchmark.", riskLevel: "low", status: "auto-executed" },
  ];

  for (const activity of agentActivities) {
    await prisma.agentActivity.create({
      data: {
        ...activity, entityId: activeDrive.id,
        input: {}, output: { status: activity.status },
        createdAt: new Date(now.getTime() - randInt(1, 72) * 3600000),
      } as never,
    });
  }

  // ─── Notifications ────────────────────────────────────────────────────────
  const notificationData = [
    { title: "SLA Breach Alert", description: "Acknowledgement SLA breached for 2 registrations in Azure AI-900 Drive. Immediate action required.", type: "alert", severity: "critical", href: "/approvals", icon: "AlertTriangle", color: "text-red-500", bgColor: "bg-red-50" },
    { title: "Approval Pending", description: "3 manager approvals awaiting response. Average wait time: 12 hours.", type: "pending", severity: "warning", href: "/approvals", icon: "ClipboardCheck", color: "text-amber-500", bgColor: "bg-amber-50" },
    { title: "Voucher Expiry Warning", description: "5 vouchers expiring in 7 days. Candidates need to redeem soon.", type: "warning", severity: "warning", href: "/vouchers", icon: "Ticket", color: "text-orange-500", bgColor: "bg-orange-50" },
    { title: "Drive Activated", description: "Q2 2026 Cloud Certification Drive is now Active. Registration open for 100 candidates.", type: "success", severity: "info", href: "/drives", icon: "CheckCircle", color: "text-emerald-500", bgColor: "bg-emerald-50" },
    { title: "New Registration", description: "Candidate Aarav Sharma (EMP101) registered for Azure Developer track.", type: "info", severity: "info", href: "/registrations", icon: "Mail", color: "text-blue-500", bgColor: "bg-blue-50" },
    { title: "Assessment Results Imported", description: "15 results imported for Cloud Certification Drive. 12 passed, 3 failed.", type: "success", severity: "info", href: "/assessments", icon: "CheckCircle", color: "text-emerald-500", bgColor: "bg-emerald-50" },
    { title: "Budget Alert", description: "Cloud Certification Drive consumed 37% of budget ($18,500 / $50,000).", type: "alert", severity: "warning", href: "/drives", icon: "AlertTriangle", color: "text-red-500", bgColor: "bg-red-50" },
    { title: "Voucher Delivered", description: "Voucher for Priya Patel delivered successfully. Awaiting redemption.", type: "success", severity: "info", href: "/vouchers", icon: "Ticket", color: "text-emerald-500", bgColor: "bg-emerald-50" },
    { title: "Exception Raised", description: "Duplicate registration detected for EMP115 in Cloud Drive. Needs review.", type: "alert", severity: "high", href: "/exceptions", icon: "AlertTriangle", color: "text-red-500", bgColor: "bg-red-50" },
    { title: "Agent Action Pending", description: "Voucher Agent flagged 4 unaccessed vouchers for potential reclamation.", type: "pending", severity: "medium", href: "/copilot", icon: "ClipboardCheck", color: "text-amber-500", bgColor: "bg-amber-50" },
  ];

  for (const user of users) {
    for (let i = 0; i < notificationData.length; i++) {
      const n = notificationData[i];
      await prisma.notification.create({
        data: {
          ...n,
          userId: user.id,
          read: i > 4,
          createdAt: new Date(now.getTime() - randInt(1, 48) * 3600000),
        },
      });
    }
  }

  // Count summary
  const counts = {
    users: users.length,
    drives: 4,
    registrations: await prisma.registration.count(),
    vouchers: await prisma.voucher.count(),
    communications: await prisma.communication.count(),
    auditLogs: await prisma.auditLog.count(),
    exceptions: await prisma.exceptionRecord.count(),
    agentActivities: agentActivities.length,
    notifications: await prisma.notification.count(),
  };

  console.log("Seed complete:");
  console.log(`  Users: ${counts.users}`);
  console.log(`  Drives: ${counts.drives} (Active, Published, Draft, Closed)`);
  console.log(`  Registrations: ${counts.registrations}`);
  console.log(`  Vouchers: ${counts.vouchers}`);
  console.log(`  Communications: ${counts.communications}`);
  console.log(`  Audit Logs: ${counts.auditLogs}`);
  console.log(`  Exceptions: ${counts.exceptions}`);
  console.log(`  Agent Activities: ${counts.agentActivities}`);
  console.log(`  Notifications: ${counts.notifications}`);
  console.log("");
  console.log("Demo logins:");
  console.log("  Admin:     admin@maverick.local");
  console.log("  Coordinator: coordinator@maverick.local");
  console.log("  Approver:  approver@maverick.local");
  console.log("  ReadOnly:  readonly@maverick.local");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
