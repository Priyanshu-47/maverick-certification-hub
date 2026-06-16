import { prisma } from "@/lib/db";
import { PageHeader, StatusBadge, SLAIndicator, CommunicationPreview } from "@/components/shared";
import { DataTable } from "@/components/shared";
import { MetricCard } from "@/components/shared";
import { formatDateTime } from "@/lib/utils";
import { Mail, CheckCircle, XCircle, Clock } from "lucide-react";

export default async function CommunicationsPage() {
  const communications = await prisma.communication.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { drive: { select: { name: true } } },
  });

  const sent = communications.filter((c) => c.status === "Sent").length;
  const failed = communications.filter((c) => c.status === "Failed").length;
  const queued = communications.filter((c) => c.status === "Queued").length;
  const breached = communications.filter((c) => c.slaDueAt && c.status === "Queued" && c.slaDueAt < new Date()).length;

  return (
    <div>
      <PageHeader title="Communications" description="Automated email simulation with SLA tracking" />

      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <MetricCard title="Sent" value={sent} icon={CheckCircle} variant="success" />
        <MetricCard title="Failed" value={failed} icon={XCircle} variant={failed > 0 ? "danger" : "default"} />
        <MetricCard title="Queued" value={queued} icon={Clock} variant="warning" />
        <MetricCard title="SLA Breached" value={breached} icon={Mail} variant={breached > 0 ? "danger" : "success"} />
      </div>

      <DataTable
        data={communications as unknown as Record<string, unknown>[]}
        columns={[
          { key: "templateType", label: "Template", render: (r) => String(r.templateType).replace(/([A-Z])/g, " $1").trim() },
          { key: "recipientEmail", label: "Recipient" },
          { key: "drive", label: "Drive", render: (r) => String((r.drive as { name: string })?.name ?? "") },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: "sla", label: "SLA", render: (r) => <SLAIndicator dueAt={r.slaDueAt as string} /> },
          { key: "sentAt", label: "Sent", render: (r) => formatDateTime(r.sentAt as string) },
        ]}
      />
    </div>
  );
}
