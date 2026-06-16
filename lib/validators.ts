import { z } from "zod";

export const driveSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  sponsor: z.string().min(1),
  ownerId: z.string().min(1),
  budget: z.coerce.number().positive(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  registrationDeadline: z.string().min(1),
  targetCount: z.coerce.number().int().positive(),
  policyUrl: z.string().url().optional().or(z.literal("")),
  tracks: z.array(z.string()).min(1, "Select at least one track"),
  locations: z.array(z.string()).min(1, "Select at least one location"),
  tenureThreshold: z.coerce.number().int().min(0).default(90),
  trainingRequired: z.boolean().default(true),
  maxPriorAttempts: z.coerce.number().int().min(0).default(2),
  managerApproval: z.enum(["None", "ManagerOnly", "ManagerAndLD"]).default("ManagerOnly"),
  passThreshold: z.coerce.number().int().min(0).max(100).default(70),
});

export const registrationSchema = z.object({
  driveId: z.string().min(1),
  employeeId: z.string().min(1),
  candidateName: z.string().min(2),
  email: z.string().email(),
  businessUnit: z.string().min(1),
  location: z.string().min(1),
  managerEmail: z.string().email(),
  examTrack: z.string().min(1),
  preferredSlot: z.string().optional(),
  priorAttempts: z.coerce.number().int().min(0).default(0),
  trainingCompleted: z.boolean().default(false),
  tenureDays: z.coerce.number().int().min(0).default(0),
});

export const approvalActionSchema = z.object({
  approvalId: z.string(),
  action: z.enum(["approve", "reject"]),
  comments: z.string().optional(),
});

export const voucherBulkSchema = z.object({
  driveId: z.string(),
  vendor: z.string().min(1),
  certificationTrack: z.string().min(1),
  codes: z.string().min(1),
  value: z.coerce.number().positive(),
  currency: z.string().default("USD"),
  expiryDate: z.string().min(1),
});

export const statusLookupSchema = z.object({
  employeeId: z.string().min(1),
  driveId: z.string().min(1),
});

export const resultImportSchema = z.object({
  driveId: z.string(),
  csvText: z.string().min(1),
});
