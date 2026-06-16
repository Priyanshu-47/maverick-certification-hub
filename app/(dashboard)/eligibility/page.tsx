import Link from "next/link";
import { prisma } from "@/lib/db";
import { evaluateEligibilityAction } from "@/lib/actions";
import { PageHeader, StatusBadge, DataTable } from "@/components/shared";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default async function EligibilityPage() {
  const registrations = await prisma.registration.findMany({
    where: { status: { in: ["Submitted", "Acknowledged", "EligibilityPending", "Eligible", "NotEligible", "ApprovalPending"] } },
    include: { drive: { select: { name: true } }, eligibilityDecision: true },
    orderBy: { submittedAt: "desc" },
    take: 50,
  });

  async function evaluate(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    await evaluateEligibilityAction(id);
  }

  return (
    <div>
      <PageHeader title="Eligibility Queue" description="Review and evaluate candidate eligibility" />
      <DataTable
        data={registrations as unknown as Record<string, unknown>[]}
        columns={[
          { key: "candidateName", label: "Candidate", render: (r) => (
            <Link href={`/registrations/${r.id}`} className="text-primary hover:underline">{String(r.candidateName)}</Link>
          )},
          { key: "employeeId", label: "Employee ID" },
          { key: "drive", label: "Drive", render: (r) => String((r.drive as { name: string })?.name ?? "") },
          { key: "tenureDays", label: "Tenure" },
          { key: "trainingCompleted", label: "Training", render: (r) => r.trainingCompleted ? "✓" : "✗" },
          { key: "priorAttempts", label: "Attempts" },
          { key: "outcome", label: "Eligibility", render: (r) => {
            const ed = r.eligibilityDecision as { outcome: string } | null;
            return ed ? <StatusBadge status={ed.outcome} /> : <span className="text-slate-400">Pending</span>;
          }},
          { key: "action", label: "Action", render: (r) => (
            <form action={evaluate}>
              <input type="hidden" name="id" value={String(r.id)} />
              <Button type="submit" size="sm" variant="outline">Evaluate</Button>
            </form>
          )},
        ]}
      />
    </div>
  );
}
