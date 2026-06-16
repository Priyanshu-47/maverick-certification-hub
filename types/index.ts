export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "Admin" | "Coordinator" | "Approver" | "ReadOnly" | "Candidate";
  employeeId?: string | null;
};

export type CriteriaResult = {
  name: string;
  passed: boolean;
  detail: string;
};

export type EligibilityCriteriaJson = {
  criteria: CriteriaResult[];
  summary: string;
};

export type DashboardMetrics = {
  activeDrives: number;
  totalRegistrations: number;
  eligibleCandidates: number;
  pendingApprovals: number;
  passRate: number;
  voucherUtilization: number;
  slaCompliance: number;
  budgetConsumed: number;
};

export type FunnelStage = {
  stage: string;
  count: number;
};

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles?: SessionUser["role"][];
};
