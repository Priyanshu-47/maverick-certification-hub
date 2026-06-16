import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, StatusBadge, DataTable } from "@/components/shared";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default async function DrivesPage({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  const session = await getSession();
  const canCreate = session && ["Admin", "Coordinator"].includes(session.role);

  const where: Record<string, unknown> = {};
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.q) where.name = { contains: searchParams.q, mode: "insensitive" };

  const drives = await prisma.drive.findMany({
    where,
    include: { owner: true, _count: { select: { registrations: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Certification Drives"
        description="Manage MAP certification drive lifecycle"
        actions={canCreate ? <Link href="/drives/new"><Button><Plus className="h-4 w-4" /> Create Drive</Button></Link> : undefined}
      />

      <div className="flex gap-2 mb-4">
        {["", "Active", "Draft", "Closed", "Published"].map((s) => (
          <Link key={s} href={s ? `/drives?status=${s}` : "/drives"}>
            <Button variant={searchParams.status === s || (!searchParams.status && !s) ? "default" : "outline"} size="sm">
              {s || "All"}
            </Button>
          </Link>
        ))}
      </div>

      <DataTable
        data={drives as unknown as Record<string, unknown>[]}
        columns={[
          { key: "driveCode", label: "ID", render: (r) => <span className="font-mono text-xs">{String(r.driveCode)}</span> },
          { key: "name", label: "Name", render: (r) => (
            <Link href={`/drives/${r.id}`} className="font-medium text-primary hover:underline">{String(r.name)}</Link>
          )},
          { key: "sponsor", label: "Sponsor" },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: "registrations", label: "Registrations", render: (r) => String((r._count as { registrations: number })?.registrations ?? 0) },
          { key: "startDate", label: "Start", render: (r) => formatDate(r.startDate as string) },
          { key: "endDate", label: "End", render: (r) => formatDate(r.endDate as string) },
        ]}
      />
    </div>
  );
}
