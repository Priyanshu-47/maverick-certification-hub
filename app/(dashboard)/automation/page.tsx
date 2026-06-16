import { prisma } from "@/lib/db";
import { runAutomationAction } from "@/lib/actions";
import { PageHeader, StatusBadge, DataTable } from "@/components/shared";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { Zap } from "lucide-react";

export default async function AutomationPage() {
  const runs = await prisma.automationRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 });

  async function runAutomation() {
    "use server";
    await runAutomationAction();
  }

  return (
    <div>
      <PageHeader
        title="Automation"
        description="Daily reminder and SLA monitoring automation"
        actions={
          <form action={runAutomation}>
            <Button type="submit"><Zap className="h-4 w-4" /> Run Daily Automation</Button>
          </form>
        }
      />

      <Card className="mb-6">
        <CardHeader><CardTitle>Automation Tasks</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2 text-slate-600">
          <p>• Find vouchers nearing expiry (T-30, T-7, T-3 reminders)</p>
          <p>• Flag expired vouchers</p>
          <p>• Escalate overdue approvals</p>
          <p>• Flag communication failures and SLA breaches</p>
        </CardContent>
      </Card>

      <DataTable
        data={runs as unknown as Record<string, unknown>[]}
        columns={[
          { key: "runType", label: "Type" },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: "startedAt", label: "Started", render: (r) => formatDateTime(r.startedAt as string) },
          { key: "completedAt", label: "Completed", render: (r) => formatDateTime(r.completedAt as string) },
          { key: "summary", label: "Summary", render: (r) => JSON.stringify(r.summaryJson ?? {}) },
        ]}
      />
    </div>
  );
}
