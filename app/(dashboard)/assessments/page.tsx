import { prisma } from "@/lib/db";
import { scheduleAssessmentAction } from "@/lib/actions";
import { PageHeader, StatusBadge, DataTable } from "@/components/shared";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { AssessmentImportForm } from "@/components/assessment-import-form";

export default async function AssessmentsPage({ searchParams }: { searchParams: { driveId?: string } }) {
  const drives = await prisma.drive.findMany({ select: { id: true, name: true } });
  const driveId = searchParams.driveId ?? drives[0]?.id;

  const results = await prisma.assessmentResult.findMany({
    where: driveId ? { driveId } : {},
    include: { registration: { select: { candidateName: true, employeeId: true } } },
    orderBy: { uploadedAt: "desc" },
    take: 50,
  });

  const scheduled = await prisma.registration.findMany({
    where: { status: { in: ["Eligible", "Approved", "Scheduled"] }, ...(driveId ? { driveId } : {}) },
    take: 20,
  });

  return (
    <div>
      <PageHeader title="Assessments & Results" description="Schedule candidates and import assessment results" />

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <div className="rounded-xl border bg-white p-6 card-shadow">
          <h3 className="font-semibold mb-2">Import Results (CSV)</h3>
          <p className="text-sm text-slate-500 mb-4">
            Format: employeeId, score, attended (yes/no) — one per line.{" "}
            <a href="/samples/assessment-results.csv" download className="text-blue-600 underline hover:text-blue-800">
              Download sample CSV
            </a>
          </p>
          <AssessmentImportForm drives={drives} defaultDriveId={driveId ?? ""} />
        </div>

        <div className="rounded-xl border bg-white p-6 card-shadow">
          <h3 className="font-semibold mb-4">Schedule Assessment</h3>
          <p className="text-sm text-slate-500 mb-4">Select a candidate from eligible queue</p>
          <div className="space-y-2">
            {scheduled.slice(0, 5).map((r) => (
              <form key={r.id} action={async () => {
                "use server";
                await scheduleAssessmentAction(r.id, new Date().toISOString().split("T")[0], r.preferredSlot ?? "Slot 1");
              }} className="flex items-center justify-between py-2 border-b">
                <span className="text-sm">{r.candidateName} — {r.examTrack}</span>
                <Button type="submit" size="sm" variant="outline">Schedule</Button>
              </form>
            ))}
          </div>
        </div>
      </div>

      <DataTable
        data={results as unknown as Record<string, unknown>[]}
        columns={[
          { key: "candidate", label: "Candidate", render: (r) => String((r.registration as { candidateName: string })?.candidateName ?? "") },
          { key: "employeeId", label: "Employee ID", render: (r) => String((r.registration as { employeeId: string })?.employeeId ?? "") },
          { key: "assessmentDate", label: "Date", render: (r) => formatDate(r.assessmentDate as string) },
          { key: "slot", label: "Slot" },
          { key: "attendance", label: "Attendance", render: (r) => <StatusBadge status={String(r.attendance)} /> },
          { key: "score", label: "Score" },
          { key: "outcome", label: "Outcome", render: (r) => <StatusBadge status={String(r.outcome)} /> },
        ]}
      />
    </div>
  );
}
