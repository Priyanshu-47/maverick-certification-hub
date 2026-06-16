import Link from "next/link";
import { prisma } from "@/lib/db";
import { approvalAction } from "@/lib/actions";
import { PageHeader, StatusBadge, SLAIndicator, DataTable } from "@/components/shared";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default async function ApprovalsPage() {
  const approvals = await prisma.approval.findMany({
    where: { status: { in: ["Pending", "Escalated"] } },
    include: { registration: { select: { candidateName: true, employeeId: true, examTrack: true } } },
    orderBy: { slaDueAt: "asc" },
  });

  async function approve(formData: FormData) {
    "use server";
    await approvalAction(formData);
  }

  async function reject(formData: FormData) {
    "use server";
    await approvalAction(formData);
  }

  return (
    <div>
      <PageHeader title="Approval Inbox" description="Review eligibility exceptions and manager approvals" />
      <DataTable
        data={approvals as unknown as Record<string, unknown>[]}
        columns={[
          { key: "candidate", label: "Candidate", render: (r) => {
            const reg = r.registration as { candidateName: string; employeeId: string };
            return (
              <div>
                <Link href={`/registrations/${r.registrationId}`} className="font-medium text-primary hover:underline">
                  {reg?.candidateName}
                </Link>
                <span className="text-xs text-slate-500 block">{reg?.employeeId}</span>
              </div>
            );
          }},
          { key: "level", label: "Level", render: (r) => `Level ${r.level}` },
          { key: "approverEmail", label: "Approver" },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: "sla", label: "SLA", render: (r) => <SLAIndicator dueAt={r.slaDueAt as string} /> },
          { key: "requestedAt", label: "Requested", render: (r) => formatDate(r.requestedAt as string) },
          { key: "actions", label: "Actions", render: (r) => (
            <div className="flex gap-1">
              <form action={approve}>
                <input type="hidden" name="approvalId" value={String(r.id)} />
                <input type="hidden" name="action" value="approve" />
                <Button type="submit" size="sm" variant="success">Approve</Button>
              </form>
              <form action={reject}>
                <input type="hidden" name="approvalId" value={String(r.id)} />
                <input type="hidden" name="action" value="reject" />
                <Button type="submit" size="sm" variant="danger">Reject</Button>
              </form>
            </div>
          )},
        ]}
      />
    </div>
  );
}
