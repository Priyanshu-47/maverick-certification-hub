import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { publishDriveAction, closeDriveAction, activateDriveAction, bulkEligibilityAction } from "@/lib/actions";
import {
  PageHeader, StatusBadge, RepositoryTree, DataTable, AuditTimeline,
} from "@/components/shared";
import { Button, Card, CardContent, CardHeader, CardTitle, Tabs, TabsList, TabsTrigger } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";

export default async function DriveDetailPage({
  params, searchParams,
}: { params: { id: string }; searchParams: { tab?: string } }) {
  const session = await getSession();
  const canEdit = session && ["Admin", "Coordinator"].includes(session.role);

  const drive = await prisma.drive.findUnique({
    where: { id: params.id },
    include: {
      owner: true,
      repositoryFolders: { orderBy: { sortOrder: "asc" } },
      registrations: { take: 20, orderBy: { submittedAt: "desc" } },
      vouchers: { take: 10 },
      communications: { take: 10, orderBy: { createdAt: "desc" } },
    },
  });
  if (!drive) notFound();

  const tab = searchParams.tab ?? "overview";
  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: "Drive", entityId: params.id },
    orderBy: { timestamp: "desc" },
    take: 10,
  });

  async function publish() { "use server"; await publishDriveAction(params.id); }
  async function activate() { "use server"; await activateDriveAction(params.id); }
  async function close() { "use server"; await closeDriveAction(params.id); }
  async function bulkEligibility() { "use server"; await bulkEligibilityAction(params.id); }

  const tabs = ["overview", "registrations", "eligibility", "assessments", "vouchers", "communications", "audit"];

  return (
    <div>
      <PageHeader
        title={drive.name}
        description={`${drive.driveCode} · ${drive.sponsor}`}
        actions={canEdit ? (
          <div className="flex gap-2">
            {drive.status === "Draft" && <form action={publish}><Button type="submit">Publish</Button></form>}
            {drive.status === "Published" && <form action={activate}><Button type="submit">Activate</Button></form>}
            {drive.status !== "Closed" && (
              <form action={close}><Button type="submit" variant="danger">Close Drive</Button></form>
            )}
            <Link href={`/drives/${params.id}/edit`}><Button variant="outline">Edit</Button></Link>
          </div>
        ) : undefined}
      />

      <div className="flex items-center gap-3 mb-6">
        <StatusBadge status={drive.status} />
        <span className="text-sm text-slate-500">Budget: ${drive.budgetConsumed.toLocaleString()} / ${drive.budget.toLocaleString()}</span>
        <span className="text-sm text-slate-500">Target: {drive.targetCount}</span>
      </div>

      <div className="flex gap-1 mb-6 flex-wrap">
        {tabs.map((t) => (
          <Link key={t} href={`/drives/${params.id}?tab=${t}`}>
            <Button variant={tab === t ? "default" : "outline"} size="sm" className="capitalize">{t}</Button>
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Drive Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Owner</span><span>{drive.owner.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Start</span><span>{formatDate(drive.startDate)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">End</span><span>{formatDate(drive.endDate)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Registration Deadline</span><span>{formatDate(drive.registrationDeadline)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tracks</span><span>{drive.tracks.join(", ")}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Locations</span><span>{drive.locations.join(", ")}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Pass Threshold</span><span>{drive.passThreshold}%</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Approval</span><span>{drive.managerApproval}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Document Repository</CardTitle></CardHeader>
            <CardContent>
              <RepositoryTree folders={drive.repositoryFolders.map((f) => ({ name: f.name, path: f.path }))} />
              <p className="text-xs text-slate-400 mt-3">Abstract repository — future SharePoint integration</p>
            </CardContent>
          </Card>
          {canEdit && (
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-3 flex-wrap">
                <Link href={`/register?driveId=${drive.id}`}><Button variant="outline">Registration Link</Button></Link>
                <form action={bulkEligibility}><Button type="submit" variant="outline">Run Bulk Eligibility</Button></form>
                <Link href={`/assessments?driveId=${drive.id}`}><Button variant="outline">Import Results</Button></Link>
                <Link href={`/vouchers?driveId=${drive.id}`}><Button variant="outline">Manage Vouchers</Button></Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "registrations" && (
        <DataTable
          data={drive.registrations as unknown as Record<string, unknown>[]}
          columns={[
            { key: "registrationCode", label: "ID" },
            { key: "candidateName", label: "Name", render: (r) => (
              <Link href={`/registrations/${r.id}`} className="text-primary hover:underline">{String(r.candidateName)}</Link>
            )},
            { key: "employeeId", label: "Employee ID" },
            { key: "examTrack", label: "Track" },
            { key: "status", label: "Status", render: (r) => <StatusBadge status={String(r.status)} /> },
            { key: "submittedAt", label: "Submitted", render: (r) => formatDate(r.submittedAt as string) },
          ]}
        />
      )}

      {tab === "vouchers" && (
        <DataTable
          data={drive.vouchers as unknown as Record<string, unknown>[]}
          columns={[
            { key: "maskedCode", label: "Code" },
            { key: "vendor", label: "Vendor" },
            { key: "certificationTrack", label: "Track" },
            { key: "status", label: "Status", render: (r) => <StatusBadge status={String(r.status)} /> },
            { key: "value", label: "Value", render: (r) => `$${r.value}` },
            { key: "expiryDate", label: "Expires", render: (r) => formatDate(r.expiryDate as string) },
          ]}
        />
      )}

      {tab === "communications" && (
        <div className="space-y-4">
          {drive.communications.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{c.subject}</p>
                    <p className="text-sm text-slate-500">{c.recipientEmail} · {c.templateType}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "audit" && <AuditTimeline logs={auditLogs} />}

      {(tab === "eligibility" || tab === "assessments") && (
        <div className="text-center py-12 text-slate-500">
          <p>View detailed {tab} from the dedicated module pages.</p>
          <Link href={`/${tab}`} className="text-primary hover:underline mt-2 inline-block">Go to {tab}</Link>
        </div>
      )}
    </div>
  );
}
