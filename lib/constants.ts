export const REPO_FOLDERS = [
  { name: "01_Registrations", path: "01_Registrations", sortOrder: 1 },
  { name: "02_Attendance", path: "02_Attendance", sortOrder: 2 },
  { name: "03_Assessments", path: "03_Assessments", sortOrder: 3 },
  { name: "04_Vouchers", path: "04_Vouchers", sortOrder: 4 },
  { name: "99_Audit", path: "99_Audit", sortOrder: 99 },
];

export const DRIVE_STATUSES = ["Draft", "Published", "Active", "Closed", "Archived"] as const;
export const REGISTRATION_STATUSES = [
  "Submitted", "Acknowledged", "EligibilityPending", "Eligible", "NotEligible",
  "ApprovalPending", "Approved", "Rejected", "Scheduled", "Attended",
  "Passed", "Failed", "VoucherIssued", "VoucherRedeemed", "Closed",
] as const;

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  Admin: ["*"],
  Coordinator: ["drives:read", "drives:write", "registrations:*", "assessments:*", "communications:*", "vouchers:read", "reports:read", "exceptions:*", "audit:read"],
  Approver: ["drives:read", "registrations:read", "approvals:*", "reports:read", "audit:read"],
  ReadOnly: ["drives:read", "registrations:read", "reports:read", "audit:read", "dashboard:read"],
  Candidate: ["registrations:own", "status:lookup", "voucher:own"],
};

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", roles: ["Admin", "Coordinator", "Approver", "ReadOnly"] },
  { href: "/drives", label: "Drives", icon: "FolderKanban", roles: ["Admin", "Coordinator", "Approver", "ReadOnly"] },
  { href: "/registrations", label: "Registrations", icon: "Users", roles: ["Admin", "Coordinator", "Approver", "ReadOnly"] },
  { href: "/eligibility", label: "Eligibility", icon: "CheckCircle", roles: ["Admin", "Coordinator"] },
  { href: "/approvals", label: "Approvals", icon: "ClipboardCheck", roles: ["Admin", "Approver"] },
  { href: "/assessments", label: "Assessments", icon: "GraduationCap", roles: ["Admin", "Coordinator"] },
  { href: "/vouchers", label: "Vouchers", icon: "Ticket", roles: ["Admin", "Coordinator"] },
  { href: "/communications", label: "Communications", icon: "Mail", roles: ["Admin", "Coordinator"] },
  { href: "/reports", label: "Reports", icon: "BarChart3", roles: ["Admin", "Coordinator", "Approver", "ReadOnly"] },
  { href: "/exceptions", label: "Exceptions", icon: "AlertTriangle", roles: ["Admin", "Coordinator"] },
  { href: "/audit", label: "Audit Logs", icon: "ScrollText", roles: ["Admin", "Coordinator", "Approver", "ReadOnly"] },
  { href: "/settings", label: "Settings", icon: "Settings", roles: ["Admin"] },
  { href: "/automation", label: "Automation", icon: "Zap", roles: ["Admin", "Coordinator"] },
  { href: "/copilot", label: "AI Copilot", icon: "Bot", roles: ["Admin", "Coordinator"] },
  { href: "/roi", label: "ROI Center", icon: "TrendingUp", roles: ["Admin", "Coordinator", "ReadOnly"] },
  { href: "/certification-ai", label: "Certification AI", icon: "Sparkles", roles: ["Admin", "Coordinator"] },
];

export const DEMO_USERS = [
  { email: "admin@maverick.local", name: "Sarah Chen", role: "Admin", employeeId: "EMP001" },
  { email: "coordinator@maverick.local", name: "James Wilson", role: "Coordinator", employeeId: "EMP002" },
  { email: "approver@maverick.local", name: "Maria Garcia", role: "Approver", employeeId: "EMP003" },
  { email: "readonly@maverick.local", name: "David Park", role: "ReadOnly", employeeId: "EMP004" },
];

export const ACK_SLA_MINUTES = 5;
export const APPROVAL_SLA_HOURS = 48;
