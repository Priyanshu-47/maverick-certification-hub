import * as React from "react";

import Link from "next/link";




import {
  LayoutDashboard, FolderKanban, Users, CheckCircle, ClipboardCheck, GraduationCap,
  Ticket, Mail, BarChart3, AlertTriangle, ScrollText, Settings, Zap, Search, Bell,
  ChevronRight, Inbox, Shield, Clock, AlertCircle, Folder, Eye, EyeOff,
} from "lucide-react";
import { cn, formatDate, formatDateTime, formatRelative, isOverdue } from "@/lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog } from "./ui";

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, FolderKanban, Users, CheckCircle, ClipboardCheck, GraduationCap,
  Ticket, Mail, BarChart3, AlertTriangle, ScrollText, Settings, Zap,
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  Draft: "default", Published: "info", Active: "success", Closed: "warning", Archived: "default",
  Submitted: "info", Acknowledged: "info", EligibilityPending: "warning", Eligible: "success",
  NotEligible: "danger", ApprovalPending: "warning", Approved: "success", Rejected: "danger",
  ApprovalRequired: "warning", ExceptionReview: "warning",
  Scheduled: "info", Attended: "primary", Passed: "success", Failed: "danger",
  VoucherIssued: "success", VoucherRedeemed: "success",
  Available: "success", Issued: "info", Redeemed: "success", Revoked: "danger", Expired: "warning",
  Queued: "warning", Sent: "success", Retried: "warning",
  Pending: "warning", Escalated: "danger",
  Open: "danger", InProgress: "warning", Resolved: "success", Waived: "default",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const variant = (STATUS_COLORS[status] ?? "default") as "default" | "success" | "warning" | "danger" | "info" | "primary";
  return <Badge variant={variant} className={className}>{status.replace(/([A-Z])/g, " $1").trim()}</Badge>;
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
const METRIC_ACCENTS = {
  default: { bg: "from-slate-50 to-white", icon: "bg-primary/10 text-primary", value: "text-primary" },
  success: { bg: "from-emerald-50/80 to-white", icon: "bg-emerald-100 text-emerald-700", value: "text-emerald-700" },
  warning: { bg: "from-amber-50/80 to-white", icon: "bg-amber-100 text-amber-700", value: "text-amber-700" },
  danger: { bg: "from-red-50/80 to-white", icon: "bg-red-100 text-red-700", value: "text-red-700" },
};

export function MetricCard({ title, value, subtitle, icon: Icon, trend, variant = "default" }: {
  title: string; value: string | number; subtitle?: string;
  icon?: React.ElementType; trend?: string; variant?: "default" | "success" | "warning" | "danger";
}) {
  const accent = METRIC_ACCENTS[variant];
  return (
    <Card className={cn("overflow-hidden border-0 card-shadow bg-gradient-to-br", accent.bg)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
            <p className={cn("text-3xl font-bold mt-2 tracking-tight", accent.value)}>{value}</p>
            {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
            {trend && <p className="text-xs font-medium text-emerald-600 mt-1.5 flex items-center gap-1">↑ {trend}</p>}
          </div>
          {Icon && (
            <div className={cn("rounded-xl p-2.5 shrink-0", accent.icon)}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Dashboard Hero ─────────────────────────────────────────────────────────────
export function DashboardHero({ driveName, healthScore, activeRegs, slaCompliance }: {
  driveName: string; healthScore: number; activeRegs: number; slaCompliance: number;
}) {
  return (
    <div className="hero-gradient rounded-2xl p-6 lg:p-8 text-white card-shadow-lg mb-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white 0%, transparent 50%)" }} />
      <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <p className="text-indigo-200 text-sm font-medium mb-1">Active Drive Health</p>
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight">{driveName}</h2>
          <p className="text-indigo-100/80 text-sm mt-2 max-w-xl">
            End-to-end certification command center — registrations, eligibility, vouchers, and SLA monitoring.
          </p>
        </div>
        <div className="flex gap-4 lg:gap-6">
          <div className="text-center px-4 py-3 rounded-xl bg-white/10 backdrop-blur border border-white/10 min-w-[100px]">
            <p className="text-3xl font-bold">{healthScore}%</p>
            <p className="text-xs text-indigo-200 mt-1">Drive Health</p>
          </div>
          <div className="text-center px-4 py-3 rounded-xl bg-white/10 backdrop-blur border border-white/10 min-w-[100px]">
            <p className="text-3xl font-bold">{activeRegs}</p>
            <p className="text-xs text-indigo-200 mt-1">Registrations</p>
          </div>
          <div className="text-center px-4 py-3 rounded-xl bg-white/10 backdrop-blur border border-white/10 min-w-[100px]">
            <p className="text-3xl font-bold">{slaCompliance}%</p>
            <p className="text-xs text-indigo-200 mt-1">SLA Compliance</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page Header ──────────────────────────────────────────────────────────────
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="text-slate-500 mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon = Inbox, title, description, action }: {
  icon?: React.ElementType; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-slate-100 p-4 mb-4"><Icon className="h-8 w-8 text-slate-400" /></div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Confirm", danger }: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; description: string; confirmLabel?: string; danger?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-sm text-slate-600 mb-6">{description}</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? "danger" : "default"} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}

// ─── Timeline ───────────────────────────────────────────────────────────────────
export function Timeline({ events }: { events: Array<{ title: string; description?: string; time: string; variant?: string }> }) {
  return (
    <div className="space-y-4">
      {events.map((e, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={cn("h-2.5 w-2.5 rounded-full", e.variant === "danger" ? "bg-red-500" : e.variant === "success" ? "bg-emerald-500" : "bg-primary")} />
            {i < events.length - 1 && <div className="w-px h-full bg-slate-200 mt-1" />}
          </div>
          <div className="pb-4">
            <p className="text-sm font-medium">{e.title}</p>
            {e.description && <p className="text-xs text-slate-500 mt-0.5">{e.description}</p>}
            <p className="text-xs text-slate-400 mt-1">{e.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Audit Timeline ─────────────────────────────────────────────────────────────
export function AuditTimeline({ logs }: { logs: Array<{ action: string; actorName: string; timestamp: string | Date; metadata?: unknown }> }) {
  return (
    <Timeline events={logs.map((l) => ({
      title: l.action.replace(/\./g, " → "),
      description: `By ${l.actorName}`,
      time: formatDateTime(l.timestamp),
    }))} />
  );
}

// ─── SLA Indicator ──────────────────────────────────────────────────────────────
export function SLAIndicator({ dueAt }: { dueAt?: string | Date | null }) {
  if (!dueAt) return null;
  const overdue = isOverdue(dueAt);
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", overdue ? "text-red-600" : "text-emerald-600")}>
      <Clock className="h-3 w-3" />
      {overdue ? "SLA Breached" : `Due ${formatRelative(dueAt)}`}
    </span>
  );
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────────
export function RiskBadge({ severity }: { severity: string }) {
  const v = severity === "Critical" || severity === "High" ? "danger" : severity === "Medium" ? "warning" : "default";
  return <Badge variant={v as "danger" | "warning" | "default"}>{severity}</Badge>;
}

// ─── Voucher Mask ─────────────────────────────────────────────────────────────────
export function VoucherMask({ masked, onReveal, revealed, fullCode }: {
  masked: string; onReveal?: () => void; revealed?: boolean; fullCode?: string;
}) {
  return (
    <div className="flex items-center gap-2 font-mono text-sm bg-slate-50 rounded-lg px-4 py-3">
      {revealed && fullCode ? (
        <span className="text-emerald-700">{fullCode}</span>
      ) : (
        <span className="text-slate-600">{masked}</span>
      )}
      {onReveal && !revealed && (
        <Button variant="ghost" size="sm" onClick={onReveal} aria-label="Reveal voucher code">
          <Eye className="h-4 w-4" />
        </Button>
      )}
      {revealed && <EyeOff className="h-4 w-4 text-slate-400" />}
    </div>
  );
}

// ─── Repository Tree ──────────────────────────────────────────────────────────────
export function RepositoryTree({ folders }: { folders: Array<{ name: string; path: string }> }) {
  return (
    <div className="space-y-1">
      {folders.map((f) => (
        <div key={f.path} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-slate-50">
          <Folder className="h-4 w-4 text-slate-400" />
          <span>{f.name}</span>
          <span className="text-xs text-slate-400 ml-auto">{f.path}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Communication Preview ────────────────────────────────────────────────────────
export function CommunicationPreview({ subject, body, status }: { subject: string; body: string; status?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{subject}</CardTitle>
          {status && <StatusBadge status={status} />}
        </div>
      </CardHeader>
      <CardContent>
        <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans">{body}</pre>
      </CardContent>
    </Card>
  );
}

// ─── Search Filter Bar ──────────────────────────────────────────────────────────────
export function SearchFilterBar({ search, onSearch, filters }: {
  search?: string; onSearch?: (v: string) => void;
  filters?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      {onSearch && (
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            className="flex h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            placeholder="Search..."
            value={search ?? ""}
            onChange={(e) => onSearch(e.target.value)}
            aria-label="Search"
          />
        </div>
      )}
      {filters}
    </div>
  );
}

// ─── Chart Card ─────────────────────────────────────────────────────────────────────
export function ChartCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="border-0 card-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ─── Form Section ───────────────────────────────────────────────────────────────────
export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

// ─── Data Table (simplified) ────────────────────────────────────────────────────────
export function DataTable<T extends Record<string, unknown>>({ columns, data }: {
  columns: Array<{ key: string; label: string; render?: (row: T) => React.ReactNode }>;
  data: T[];
}) {
  if (!data.length) return <EmptyState title="No data" description="Nothing to display yet." />;
  return (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="h-11 px-4 text-left font-medium text-slate-500">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className={cn("border-b last:border-0 hover:bg-slate-50/50")}>
              {columns.map((c) => (
                <td key={c.key} className="p-4">{c.render ? c.render(row) : String(row[c.key] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// ─── Role Guard ───────────────────────────────────────────────────────────────────────
export function RoleGuard({ userRole, allowed, children, fallback }: {
  userRole?: string; allowed: string[]; children: React.ReactNode; fallback?: React.ReactNode;
}) {
  if (!userRole || !allowed.includes(userRole)) return fallback ?? null;
  return <>{children}</>;
}

// ─── Funnel Card ──────────────────────────────────────────────────────────────────────
export function FunnelCard({ stages }: { stages: Array<{ stage: string; count: number }> }) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <div className="space-y-3">
      {stages.map((s) => (
        <div key={s.stage} className="flex items-center gap-3">
          <span className="text-sm text-slate-600 w-28 shrink-0">{s.stage}</span>
          <div className="flex-1 h-7 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(s.count / max) * 100}%` }} />
          </div>
          <span className="text-sm font-semibold w-8 text-right">{s.count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Risk Panel ─────────────────────────────────────────────────────────────────────
export function RiskPanel({ items }: { items: Array<{ label: string; count: number; severity: string }> }) {
  return (
    <Card className="border-0 card-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500" /> Risk Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-500">
            <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            No active risks
          </div>
        ) : items.map((item) => (
          <div key={item.label} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-slate-50/80">
            <span className="text-sm font-medium text-slate-700">{item.label}</span>
            <div className="flex items-center gap-2">
              <RiskBadge severity={item.severity} />
              <span className="text-sm font-bold tabular-nums">{item.count}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export { ICON_MAP };
