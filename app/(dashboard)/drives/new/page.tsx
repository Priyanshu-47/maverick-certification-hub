import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createDriveAction } from "@/lib/actions";
import { PageHeader, FormSection } from "@/components/shared";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";

const TRACKS = ["Azure Administrator", "Azure Developer", "AWS Solutions Architect", "Security Specialist"];
const LOCATIONS = ["New York", "London", "Singapore", "Dallas", "Chicago"];

export default async function NewDrivePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const users = await prisma.user.findMany({ where: { role: { in: ["Admin", "Coordinator"] } } });

  async function handleCreate(formData: FormData) {
    "use server";
    const result = await createDriveAction(formData);
    if (result.success && result.driveId) redirect(`/drives/${result.driveId}`);
  }

  return (
    <div>
      <PageHeader title="Create Certification Drive" description="Configure a new MAP certification drive" />
      <form action={handleCreate} className="max-w-3xl space-y-8">
        <FormSection title="Basic Information">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Drive Name</Label>
            <Input id="name" name="name" required placeholder="Q3 2026 Cloud Certification Drive" />
          </div>
          <div>
            <Label htmlFor="sponsor">Sponsor</Label>
            <Input id="sponsor" name="sponsor" required placeholder="Technology L&D" />
          </div>
          <div>
            <Label htmlFor="ownerId">Owner</Label>
            <Select id="ownerId" name="ownerId" required>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="budget">Budget (USD)</Label>
            <Input id="budget" name="budget" type="number" required placeholder="50000" />
          </div>
          <div>
            <Label htmlFor="targetCount">Target Count</Label>
            <Input id="targetCount" name="targetCount" type="number" required placeholder="100" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="policyUrl">Policy URL</Label>
            <Input id="policyUrl" name="policyUrl" type="url" placeholder="https://internal.company.com/policies/cert" />
          </div>
        </FormSection>

        <FormSection title="Schedule">
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input id="startDate" name="startDate" type="date" required />
          </div>
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input id="endDate" name="endDate" type="date" required />
          </div>
          <div>
            <Label htmlFor="registrationDeadline">Registration Deadline</Label>
            <Input id="registrationDeadline" name="registrationDeadline" type="date" required />
          </div>
        </FormSection>

        <FormSection title="Tracks & Locations">
          <div className="sm:col-span-2">
            <Label>Tracks (stored as JSON in this form)</Label>
            <input type="hidden" name="tracks" value={JSON.stringify(TRACKS.slice(0, 2))} />
            <p className="text-sm text-slate-500 mt-1">{TRACKS.slice(0, 2).join(", ")}</p>
          </div>
          <div className="sm:col-span-2">
            <Label>Locations</Label>
            <input type="hidden" name="locations" value={JSON.stringify(LOCATIONS.slice(0, 3))} />
            <p className="text-sm text-slate-500 mt-1">{LOCATIONS.slice(0, 3).join(", ")}</p>
          </div>
        </FormSection>

        <FormSection title="Eligibility & Approval Policy">
          <div>
            <Label htmlFor="tenureThreshold">Tenure Threshold (days)</Label>
            <Input id="tenureThreshold" name="tenureThreshold" type="number" value="90" />
          </div>
          <div>
            <Label htmlFor="maxPriorAttempts">Max Prior Attempts</Label>
            <Input id="maxPriorAttempts" name="maxPriorAttempts" type="number" value="2" />
          </div>
          <div>
            <Label htmlFor="passThreshold">Pass Threshold (%)</Label>
            <Input id="passThreshold" name="passThreshold" type="number" value="70" />
          </div>
          <div>
            <Label htmlFor="managerApproval">Approval Policy</Label>
            <Select id="managerApproval" name="managerApproval">
              <option value="None">No Approval</option>
              <option value="ManagerOnly">Manager Only</option>
              <option value="ManagerAndLD">Manager + L&D</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="trainingRequired">Training Required</Label>
            <Select id="trainingRequired" name="trainingRequired">
              <option value="true">Yes</option>
              <option value="false">No</option>
            </Select>
          </div>
        </FormSection>

        <div className="flex gap-3">
          <Button type="submit">Create Drive</Button>
          <Button type="button" variant="outline" asChild><a href="/drives">Cancel</a></Button>
        </div>
      </form>
    </div>
  );
}
