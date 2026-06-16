import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const drives = await prisma.drive.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ drives });
}
