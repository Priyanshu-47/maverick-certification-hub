import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId")?.trim();
  const driveId = searchParams.get("driveId");

  if (!employeeId || !driveId) {
    return NextResponse.json({ registration: null }, { status: 400 });
  }

  const registration = await prisma.registration.findUnique({
    where: { driveId_employeeId: { driveId, employeeId } },
    include: {
      drive: { select: { name: true } },
      eligibilityDecision: { select: { outcome: true } },
    },
  });

  if (!registration) {
    return NextResponse.json({ registration: null });
  }

  return NextResponse.json({
    registration: {
      id: registration.id,
      candidateName: registration.candidateName,
      employeeId: registration.employeeId,
      email: registration.email,
      status: registration.status,
      examTrack: registration.examTrack,
      registrationCode: registration.registrationCode,
      submittedAt: registration.submittedAt.toISOString(),
      driveName: registration.drive.name,
      eligibilityOutcome: registration.eligibilityDecision?.outcome ?? null,
    },
  });
}
