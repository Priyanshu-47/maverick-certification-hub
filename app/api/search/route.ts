import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";

  if (!q) return NextResponse.json({ results: [] });

  const pattern = `%${q}%`;

  const [drives, registrations, vouchers] = await Promise.all([
    prisma.drive.findMany({
      where: {
        OR: [
          { name: { contains: pattern, mode: "insensitive" } },
          { driveCode: { contains: pattern, mode: "insensitive" } },
          { sponsor: { contains: pattern, mode: "insensitive" } },
        ],
      },
      take: 20,
    }),
    prisma.registration.findMany({
      where: {
        OR: [
          { candidateName: { contains: pattern, mode: "insensitive" } },
          { employeeId: { contains: pattern, mode: "insensitive" } },
          { email: { contains: pattern, mode: "insensitive" } },
          { registrationCode: { contains: pattern, mode: "insensitive" } },
        ],
      },
      include: { drive: { select: { name: true } } },
      take: 20,
    }),
    prisma.voucher.findMany({
      where: {
        OR: [
          { maskedCode: { contains: pattern, mode: "insensitive" } },
          { vendor: { contains: pattern, mode: "insensitive" } },
          { certificationTrack: { contains: pattern, mode: "insensitive" } },
        ],
      },
      take: 20,
    }),
  ]);

  const results = [
    ...drives.map((d) => ({
      type: "drive",
      id: d.id,
      title: d.name,
      subtitle: `${d.driveCode} · ${d.sponsor}`,
      status: d.status,
      href: `/drives/${d.id}`,
    })),
    ...registrations.map((r) => ({
      type: "registration",
      id: r.id,
      title: r.candidateName,
      subtitle: `${r.employeeId} · ${(r as any).drive?.name || ""} · ${r.examTrack}`,
      status: r.status,
      href: `/registrations/${r.id}`,
    })),
    ...vouchers.map((v) => ({
      type: "voucher",
      id: v.id,
      title: v.maskedCode,
      subtitle: `${v.vendor} · ${v.certificationTrack} · $${v.value}`,
      status: v.status,
      href: "/vouchers",
    })),
  ];

  return NextResponse.json({ results });
}
