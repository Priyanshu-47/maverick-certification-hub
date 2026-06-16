import { prisma } from "@/lib/db";
import { resolveExceptionAction } from "@/lib/actions";
import { PageHeader, RiskBadge, StatusBadge, DataTable } from "@/components/shared";
import { Button, Input } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default async function ExceptionsPage() {
  const exceptions = await prisma.exceptionRecord.findMany({
    include: { owner: { select: { name: true } }, drive: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  async function resolve(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    const notes = String(formData.get("notes") ?? "Resolved");
    await resolveExceptionAction(id, notes);
  }

  return (
    <div>
      <PageHeader title="Exception Dashboard" description="Operational exceptions requiring attention" />
      <DataTable
        data={exceptions as unknown as Record<string, unknown>[]}
        columns={[
          { key: "title", label: "Exception" },
          { key: "type", label: "Type", render: (r) => String(r.type).replace(/([A-Z])/g, " $1").trim() },
          { key: "severity", label: "Severity", render: (r) => <RiskBadge severity={String(r.severity)} /> },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: "drive", label: "Drive", render: (r) => String((r.drive as { name: string })?.name ?? "—") },
          { key: "owner", label: "Owner", render: (r) => String((r.owner as { name: string })?.name ?? "Unassigned") },
          { key: "createdAt", label: "Created", render: (r) => formatDate(r.createdAt as string) },
          { key: "actions", label: "", render: (r) => r.status !== "Resolved" ? (
            <form action={resolve} className="flex gap-1">
              <input type="hidden" name="id" value={String(r.id)} />
              <input type="hidden" name="notes" value="Resolved via dashboard" />
              <Button type="submit" size="sm" variant="outline">Resolve</Button>
            </form>
          ) : null },
        ]}
      />
    </div>
  );
}
