import { prisma } from "@/lib/db";
import { allocateVoucherAction, redeemVoucherAction } from "@/lib/actions";
import { PageHeader, StatusBadge, DataTable, MetricCard } from "@/components/shared";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { Ticket, AlertTriangle } from "lucide-react";
import { VoucherImportForm } from "@/components/voucher-import-form";
import Link from "next/link";

export default async function VouchersPage({ searchParams }: { searchParams: { driveId?: string } }) {
  const drives = await prisma.drive.findMany({ select: { id: true, name: true, tracks: true } });
  const driveId = searchParams.driveId;

  const vouchers = await prisma.voucher.findMany({
    where: driveId ? { driveId } : {},
    include: { assignedRegistration: { select: { candidateName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const allVouchers = await prisma.voucher.findMany({
    select: { status: true, driveId: true },
  });

  const available = allVouchers.filter((v) => v.status === "Available").length;
  const issued = allVouchers.filter((v) => v.status === "Issued").length;
  const redeemed = allVouchers.filter((v) => v.status === "Redeemed").length;
  const lowStock = available < 5;

  const passedRegs = await prisma.registration.findMany({
    where: { status: "Passed", ...(driveId ? { driveId } : {}) },
    take: 10,
  });

  return (
    <div>
      <PageHeader title="Voucher Inventory" description="Secure voucher pool management and allocation" />

      {lowStock && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4" /> Low voucher inventory — only {available} available
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <MetricCard title="Available" value={available} icon={Ticket} variant="success" />
        <MetricCard title="Issued" value={issued} icon={Ticket} />
        <MetricCard title="Redeemed" value={redeemed} icon={Ticket} variant="success" />
        <MetricCard title="Total" value={allVouchers.length} icon={Ticket} />
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <Link href="/vouchers">
          <Button variant={!driveId ? "default" : "outline"} size="sm">All Drives</Button>
        </Link>
        {drives.map((d) => (
          <Link key={d.id} href={`/vouchers?driveId=${d.id}`}>
            <Button variant={driveId === d.id ? "default" : "outline"} size="sm">{d.name}</Button>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <div className="lg:col-span-2 rounded-xl border bg-white p-6 card-shadow">
          <h3 className="font-semibold mb-4">Import Vouchers</h3>
          <VoucherImportForm drives={drives} defaultDriveId={driveId ?? drives[0]?.id ?? ""} />
        </div>

        <div className="rounded-xl border bg-white p-6 card-shadow">
          <h3 className="font-semibold mb-4">Allocation Queue</h3>
          <p className="text-sm text-slate-500 mb-3">Passed candidates awaiting vouchers</p>
          <div className="space-y-2">
            {passedRegs.map((r) => (
              <form key={r.id} action={async () => { "use server"; await allocateVoucherAction(r.id); }} className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">{r.candidateName}</span>
                <Button type="submit" size="sm">Allocate</Button>
              </form>
            ))}
            {passedRegs.length === 0 && <p className="text-sm text-slate-400">No candidates in queue</p>}
          </div>
        </div>
      </div>

      {vouchers.length === 0 && (
        <div className="rounded-xl border bg-white p-8 text-center card-shadow mb-6">
          <Ticket className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No vouchers {driveId ? "for this drive" : "found"}</p>
          <p className="text-sm text-slate-400 mt-1">Import vouchers above or select a different drive</p>
        </div>
      )}

      {vouchers.length > 0 && (
        <DataTable
          data={vouchers as unknown as Record<string, unknown>[]}
          columns={[
            { key: "maskedCode", label: "Code (Masked)" },
            { key: "vendor", label: "Vendor" },
            { key: "certificationTrack", label: "Track" },
            { key: "status", label: "Status", render: (r) => <StatusBadge status={String(r.status)} /> },
            { key: "assigned", label: "Assigned To", render: (r) => String((r.assignedRegistration as { candidateName: string })?.candidateName ?? "—") },
            { key: "value", label: "Value", render: (r) => `$${r.value}` },
            { key: "expiryDate", label: "Expires", render: (r) => formatDate(r.expiryDate as string) },
            { key: "actions", label: "", render: (r) => r.status === "Issued" ? (
              <form action={async () => { "use server"; await redeemVoucherAction(String(r.id)); }}>
                <Button type="submit" size="sm" variant="outline">Mark Redeemed</Button>
              </form>
            ) : null },
          ]}
        />
      )}
    </div>
  );
}
