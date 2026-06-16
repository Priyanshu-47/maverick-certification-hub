import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createRegistrationAction } from "@/lib/actions";
import { PageHeader, FormSection } from "@/components/shared";
import { Button, Input, Label, Select } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: { driveId?: string; error?: string } }) {
  const drives = await prisma.drive.findMany({
    where: { status: { in: ["Published", "Active"] } },
    select: { id: true, name: true, tracks: true, locations: true },
  });

  async function handleRegister(formData: FormData) {
    "use server";
    const result = await createRegistrationAction(formData);
    if (result.success && result.registrationId) redirect(`/registrations/${result.registrationId}`);
    if (result.error) redirect(`/register?error=${encodeURIComponent(String(result.error))}`);
  }

  const selectedDrive = drives.find((d) => d.id === searchParams.driveId) ?? drives[0];

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <PageHeader title="Candidate Registration" description="Register for a MAP certification drive" />
        {searchParams.error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{searchParams.error}</div>
        )}
        <form action={handleRegister} className="bg-white rounded-xl border p-6 space-y-6 card-shadow">
          <FormSection title="Drive Selection">
            <div className="sm:col-span-2">
              <Label htmlFor="driveId">Certification Drive</Label>
              <Select id="driveId" name="driveId" required defaultValue={selectedDrive?.id}>
                {drives.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
          </FormSection>

          <FormSection title="Candidate Information">
            <div>
              <Label htmlFor="employeeId">Employee ID</Label>
              <Input id="employeeId" name="employeeId" required placeholder="EMP100" />
            </div>
            <div>
              <Label htmlFor="candidateName">Full Name</Label>
              <Input id="candidateName" name="candidateName" required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="businessUnit">Business Unit</Label>
              <Input id="businessUnit" name="businessUnit" required />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Select id="location" name="location" required>
                {(selectedDrive?.locations ?? ["New York"]).map((l) => <option key={l} value={l}>{l}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="managerEmail">Manager Email</Label>
              <Input id="managerEmail" name="managerEmail" type="email" required />
            </div>
          </FormSection>

          <FormSection title="Exam Details">
            <div>
              <Label htmlFor="examTrack">Exam Track</Label>
              <Select id="examTrack" name="examTrack" required>
                {(selectedDrive?.tracks ?? ["Azure Administrator"]).map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="preferredSlot">Preferred Slot</Label>
              <Select id="preferredSlot" name="preferredSlot">
                <option value="Slot 1">Slot 1 — Morning</option>
                <option value="Slot 2">Slot 2 — Afternoon</option>
                <option value="Slot 3">Slot 3 — Evening</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="priorAttempts">Prior Attempts</Label>
              <Input id="priorAttempts" name="priorAttempts" type="number" value="0" min="0" />
            </div>
            <div>
              <Label htmlFor="tenureDays">Tenure (days)</Label>
              <Input id="tenureDays" name="tenureDays" type="number" value="120" min="0" />
            </div>
            <div>
              <Label htmlFor="trainingCompleted">Training Completed</Label>
              <Select id="trainingCompleted" name="trainingCompleted">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </Select>
            </div>
          </FormSection>

          <Button type="submit" className="w-full">Submit Registration</Button>
        </form>
      </div>
    </div>
  );
}
