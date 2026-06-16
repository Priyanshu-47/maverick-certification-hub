import Link from "next/link";
import {
  LayoutDashboard, Users, CheckCircle, ClipboardCheck, Ticket,
  FolderKanban, TrendingUp, DollarSign, Activity, Bot, Brain,
} from "lucide-react";
import { PageHeader, MetricCard, FunnelCard, RiskPanel, AuditTimeline, DashboardHero } from "@/components/shared";
import { ChartCard } from "@/components/shared";
import { RegistrationsBarChart, PassFailChart, VendorChart, VoucherAgingChart, SLATrendChart } from "@/components/charts";
import { getDashboardMetrics, getFunnelData, getRecentAuditLogs, getRiskItems, getChartData } from "@/lib/services";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui";
import { isAIConfigured } from "@/lib/ai";

export default async function DashboardPage() {
  const session = await getSession();
  const canCreate = session && ["Admin", "Coordinator"].includes(session.role);

  const [metrics, funnel, auditLogs, risks, charts, activeDrive, aiMetrics] = await Promise.all([
    getDashboardMetrics(),
    getFunnelData(),
    getRecentAuditLogs(8),
    getRiskItems(),
    getChartData(),
    prisma.drive.findFirst({
      where: { status: "Active" },
      select: { name: true },
      orderBy: { updatedAt: "desc" },
    }),
    // AI feature metrics
    Promise.all([
      prisma.policyRule.count(),
      prisma.readinessAssessment.count(),
      prisma.voucherScore.count(),
      prisma.agentActivity.count(),
      prisma.certificationPassport.count(),
      prisma.demandForecast.count(),
    ]).then(([policyRules, readinessAssessments, voucherScores, agentActivities, passports, demandForecasts]) => ({
      policyRules, readinessAssessments, voucherScores, agentActivities, passports, demandForecasts,
    })),
  ]);

  const riskItems = [
    { label: "Low voucher inventory", count: risks.lowStock.length, severity: "High" },
    { label: "Approvals breaching SLA", count: risks.overdueApprovals, severity: "Critical" },
    { label: "Upcoming voucher expiries", count: risks.expiringVouchers, severity: "Medium" },
    { label: "Failed communications", count: risks.failedComms, severity: "High" },
  ].filter((r) => r.count > 0);

  const slaTrend = [
    { date: "Week 1", compliance: 92 },
    { date: "Week 2", compliance: 95 },
    { date: "Week 3", compliance: 88 },
    { date: "Week 4", compliance: metrics.slaCompliance },
  ];

  const healthScore = Math.round((metrics.passRate + metrics.slaCompliance + metrics.voucherUtilization) / 3);

  return (
    <div>
      <DashboardHero
        driveName={activeDrive?.name ?? "No active drive"}
        healthScore={healthScore}
        activeRegs={metrics.totalRegistrations}
        slaCompliance={metrics.slaCompliance}
      />

      <PageHeader
        title="Executive Dashboard"
        description="Real-time certification drive health and KPI monitoring"
        actions={canCreate ? <Link href="/drives/new"><Button>Create Drive</Button></Link> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <MetricCard title="Active Drives" value={metrics.activeDrives} icon={FolderKanban} />
        <MetricCard title="Total Registrations" value={metrics.totalRegistrations} icon={Users} />
        <MetricCard title="Eligible Candidates" value={metrics.eligibleCandidates} icon={CheckCircle} variant="success" />
        <MetricCard title="Pending Approvals" value={metrics.pendingApprovals} icon={ClipboardCheck} variant={metrics.pendingApprovals > 5 ? "warning" : "default"} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <MetricCard title="Pass Rate" value={`${metrics.passRate}%`} icon={TrendingUp} variant="success" trend="+4% vs last drive" />
        <MetricCard title="Voucher Utilization" value={`${metrics.voucherUtilization}%`} icon={Ticket} />
        <MetricCard title="SLA Compliance" value={`${metrics.slaCompliance}%`} icon={Activity} variant={metrics.slaCompliance < 90 ? "warning" : "success"} />
        <MetricCard title="Budget Consumed" value={`$${metrics.budgetConsumed.toLocaleString()}`} icon={DollarSign} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <ChartCard title="Certification Funnel" description="End-to-end journey progression">
          <FunnelCard stages={funnel} />
        </ChartCard>
        <RiskPanel items={riskItems} />
        <ChartCard title="Recent Activity" description="Audit feed">
          <AuditTimeline logs={auditLogs} />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <ChartCard title="Registrations by Drive">
          <RegistrationsBarChart data={charts.registrationsByDrive} />
        </ChartCard>
        <ChartCard title="Pass / Fail Distribution">
          <PassFailChart data={charts.passFail.map((p) => ({ outcome: p.outcome, count: p._count.id }))} />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard title="Voucher Aging">
          <VoucherAgingChart vouchers={charts.voucherAging} />
        </ChartCard>
        <ChartCard title="SLA Compliance Trend">
          <SLATrendChart data={slaTrend} />
        </ChartCard>
        <ChartCard title="Utilization by Vendor">
          <VendorChart data={charts.vouchersByVendor} />
        </ChartCard>
      </div>

      {/* AI Features Status */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Brain className="w-5 h-5" />
          AI Engine Status
          <span className={`text-xs px-2 py-0.5 rounded-full ${isAIConfigured() ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
            {isAIConfigured() ? "Azure OpenAI Connected" : "Rule-Based Fallback"}
          </span>
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard title="Policy Rules" value={aiMetrics.policyRules} icon={Bot} />
          <MetricCard title="Readiness Checks" value={aiMetrics.readinessAssessments} icon={CheckCircle} />
          <MetricCard title="Voucher Scores" value={aiMetrics.voucherScores} icon={Ticket} />
          <MetricCard title="Agent Actions" value={aiMetrics.agentActivities} icon={Activity} />
          <MetricCard title="Passports" value={aiMetrics.passports} icon={ClipboardCheck} />
          <MetricCard title="Demand Forecasts" value={aiMetrics.demandForecasts} icon={TrendingUp} />
        </div>
        <div className="mt-3 text-right">
          <Link href="/copilot">
            <Button variant="outline" size="sm">
              <Bot className="w-4 h-4 mr-2" />
              Open AI Copilot
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
