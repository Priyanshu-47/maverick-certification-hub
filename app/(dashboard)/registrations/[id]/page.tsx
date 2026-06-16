import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  PageHeader, StatusBadge, Timeline, CommunicationPreview, VoucherMask,
} from "@/components/shared";
import { evaluateEligibilityAction, allocateVoucherAction } from "@/lib/actions";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";

export default async function RegistrationDetailPage({ params }: { params: { id: string } }) {
  const reg = await prisma.registration.findUnique({
    where: { id: params.id },
    include: {
      drive: true,
      eligibilityDecision: true,
      approvals: { orderBy: { requestedAt: "asc" } },
      assessmentResults: { orderBy: { uploadedAt: "desc" } },
      vouchers: true,
      communications: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!reg) notFound();

  const auditLogs = await prisma.auditLog.findMany({
    where: { entityId: params.id },
    orderBy: { timestamp: "desc" },
    take: 15,
  });

  async function evaluate() { "use server"; await evaluateEligibilityAction(params.id); }
  async function allocate() { "use server"; await allocateVoucherAction(params.id); }

  const criteria = reg.eligibilityDecision?.criteriaJson as { criteria?: Array<{ name: string; passed: boolean; detail: string }> } | null;

  const timelineEvents = [
    { title: "Registration Submitted", time: formatDateTime(reg.submittedAt), variant: "default" },
    ...reg.communications.map((c) => ({
      title: c.templateType.replace(/([A-Z])/g, " $1").trim(),
      description: c.subject,
      time: formatDateTime(c.sentAt ?? c.createdAt),
      variant: c.status === "Failed" ? "danger" : "success",
    })),
    ...reg.assessmentResults.map((a) => ({
      title: `Assessment: ${a.outcome}`,
      description: `Score: ${a.score ?? "—"}`,
      time: formatDateTime(a.uploadedAt),
      variant: a.outcome === "Passed" ? "success" : a.outcome === "Failed" ? "danger" : "default",
    })),
  ];

  return (
    <div>
      <PageHeader
        title={reg.candidateName}
        description={`${reg.registrationCode} · ${reg.employeeId}`}
        actions={<StatusBadge status={reg.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Candidate Details</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Email</span><p>{reg.email}</p></div>
              <div><span className="text-slate-500">Business Unit</span><p>{reg.businessUnit}</p></div>
              <div><span className="text-slate-500">Location</span><p>{reg.location}</p></div>
              <div><span className="text-slate-500">Manager</span><p>{reg.managerEmail}</p></div>
              <div><span className="text-slate-500">Exam Track</span><p>{reg.examTrack}</p></div>
              <div><span className="text-slate-500">Tenure</span><p>{reg.tenureDays} days</p></div>
              <div><span className="text-slate-500">Training</span><p>{reg.trainingCompleted ? "Completed" : "Not completed"}</p></div>
              <div><span className="text-slate-500">Prior Attempts</span><p>{reg.priorAttempts}</p></div>
              <div><span className="text-slate-500">Drive</span><p><Link href={`/drives/${reg.driveId}`} className="text-primary hover:underline">{reg.drive.name}</Link></p></div>
            </CardContent>
          </Card>

          {criteria?.criteria && (
            <Card>
              <CardHeader><CardTitle>Eligibility Criteria</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {criteria.criteria.map((c) => (
                    <div key={c.name} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm">{c.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{c.detail}</span>
                        <StatusBadge status={c.passed ? "Eligible" : "NotEligible"} />
                      </div>
                    </div>
                  ))}
                </div>
                <form action={evaluate} className="mt-4">
                  <Button type="submit" variant="outline" size="sm">Re-run Eligibility</Button>
                </form>
              </CardContent>
            </Card>
          )}

          {reg.vouchers.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Voucher</CardTitle></CardHeader>
              <CardContent>
                {reg.vouchers.map((v) => (
                  <div key={v.id} className="space-y-2">
                    <VoucherMask masked={v.maskedCode} />
                    <div className="flex gap-4 text-sm text-slate-500">
                      <span>{v.vendor}</span>
                      <StatusBadge status={v.status} />
                      <span>Expires {formatDate(v.expiryDate)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent><Timeline events={timelineEvents} /></CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {!reg.eligibilityDecision && (
                <form action={evaluate}><Button type="submit" className="w-full">Run Eligibility Check</Button></form>
              )}
              {reg.status === "Passed" && !reg.vouchers.some((v) => v.status === "Issued") && (
                <form action={allocate}><Button type="submit" className="w-full" variant="success">Allocate Voucher</Button></form>
              )}
              <Link href={`/assessments?registrationId=${reg.id}`}><Button variant="outline" className="w-full">Schedule Assessment</Button></Link>
            </CardContent>
          </Card>

          {reg.approvals.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Approvals</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {reg.approvals.map((a) => (
                  <div key={a.id} className="text-sm border-b pb-2 last:border-0">
                    <div className="flex justify-between">
                      <span>Level {a.level}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="text-slate-500">{a.approverEmail}</p>
                    {a.comments && <p className="text-xs mt-1">{a.comments}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Communications</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {reg.communications.slice(-3).map((c) => (
                <CommunicationPreview key={c.id} subject={c.subject} body={c.body.slice(0, 100) + "…"} status={c.status} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
