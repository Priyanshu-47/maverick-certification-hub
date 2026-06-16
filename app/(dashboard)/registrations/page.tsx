import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, StatusBadge, DataTable } from "@/components/shared";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default async function RegistrationsPage({ searchParams }: { searchParams: { status?: string; driveId?: string } }) {
  const session = await getSession();
  const canRegister = session && ["Admin", "Coordinator"].includes(session.role);

  const where: Record<string, unknown> = {};
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.driveId) where.driveId = searchParams.driveId;

  const registrations = await prisma.registration.findMany({
    where,
    include: { drive: { select: { name: true, driveCode: true } } },
    orderBy: { submittedAt: "desc" },
    take: 100,
  });
  const drives = await prisma.drive.findMany({ select: { id: true, name: true } });

  return (
    <div>
      <PageHeader
        title="Registrations"
        description="Candidate registration management"
        actions={
          <div className="flex gap-2">
            {canRegister && <Link href="/register"><Button>Candidate Registration</Button></Link>}
            <Link href="/status"><Button variant="outline">Status Lookup</Button></Link>
          </div>
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {drives.map((d) => (
          <Link key={d.id} href={`/registrations?driveId=${d.id}`}>
            <Button size="sm" variant={searchParams.driveId === d.id ? "default" : "outline"}>{d.name.slice(0, 20)}</Button>
          </Link>
        ))}
      </div>

      <DataTable
        data={registrations as unknown as Record<string, unknown>[]}
        columns={[
          { key: "registrationCode", label: "ID", render: (r) => (
            <Link href={`/certification-ai?tab=passport&id=${encodeURIComponent(String(r.registrationCode))}`} className="font-mono text-xs text-primary hover:underline">{String(r.registrationCode)}</Link>
          )},
          { key: "candidateName", label: "Name", render: (r) => (
            <Link href={`/registrations/${r.id}`} className="font-medium text-primary hover:underline">{String(r.candidateName)}</Link>
          )},
          { key: "employeeId", label: "Employee ID" },
          { key: "drive", label: "Drive", render: (r) => String((r.drive as { name: string })?.name ?? "") },
          { key: "examTrack", label: "Track" },
          { key: "location", label: "Location" },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: "submittedAt", label: "Submitted", render: (r) => formatDate(r.submittedAt as string) },
        ]}
      />
    </div>
  );
}
