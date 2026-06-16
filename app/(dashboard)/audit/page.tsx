import { prisma } from "@/lib/db";
import { PageHeader, DataTable } from "@/components/shared";
import { formatDateTime } from "@/lib/utils";

export default async function AuditPage({ searchParams }: { searchParams: { entityType?: string } }) {
  const where = searchParams.entityType ? { entityType: searchParams.entityType } : {};
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: 100,
  });

  const entityTypes = ["Drive", "Registration", "Voucher", "Approval", "Communication", "Exception"];

  return (
    <div>
      <PageHeader title="Audit Logs" description="Append-only audit trail for all critical actions" />

      <div className="flex gap-2 mb-4 flex-wrap">
        <a href="/audit"><span className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium border">All</span></a>
        {entityTypes.map((t) => (
          <a key={t} href={`/audit?entityType=${t}`}>
            <span className={`inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium border ${searchParams.entityType === t ? "bg-primary text-white" : ""}`}>{t}</span>
          </a>
        ))}
      </div>

      <DataTable
        data={logs as unknown as Record<string, unknown>[]}
        columns={[
          { key: "timestamp", label: "Time", render: (r) => formatDateTime(r.timestamp as string) },
          { key: "action", label: "Action", render: (r) => <span className="font-mono text-xs">{String(r.action)}</span> },
          { key: "entityType", label: "Entity" },
          { key: "entityId", label: "Entity ID", render: (r) => <span className="font-mono text-xs truncate max-w-[120px]">{String(r.entityId).slice(0, 12)}…</span> },
          { key: "actorName", label: "Actor" },
          { key: "ipAddress", label: "IP" },
        ]}
      />
    </div>
  );
}
