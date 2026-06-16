import { prisma } from "@/lib/db";
import { getFunnelData, getChartData } from "@/lib/services";
import { PageHeader, ChartCard, FunnelCard } from "@/components/shared";
import { RegistrationsBarChart, PassFailChart, VendorChart, VoucherAgingChart } from "@/components/charts";

export default async function ReportsPage() {
  const [funnel, charts, statusCounts] = await Promise.all([
    getFunnelData(),
    getChartData(),
    prisma.registration.groupBy({ by: ["status"], _count: { id: true } }),
  ]);

  return (
    <div>
      <PageHeader title="Reports & Analytics" description="Executive reporting and certification drive analytics" />

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <ChartCard title="Drive Summary Funnel">
          <FunnelCard stages={funnel} />
        </ChartCard>
        <ChartCard title="Registrations by Status">
          <div className="space-y-2">
            {statusCounts.map((s) => (
              <div key={s.status} className="flex justify-between text-sm py-1 border-b">
                <span>{s.status}</span>
                <span className="font-semibold">{s._count.id}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <ChartCard title="Registrations by Drive">
          <RegistrationsBarChart data={charts.registrationsByDrive} />
        </ChartCard>
        <ChartCard title="Pass / Fail Trends">
          <PassFailChart data={charts.passFail.map((p) => ({ outcome: p.outcome, count: p._count.id }))} />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Voucher Utilization by Vendor">
          <VendorChart data={charts.vouchersByVendor} />
        </ChartCard>
        <ChartCard title="Voucher Aging">
          <VoucherAgingChart vouchers={charts.voucherAging} />
        </ChartCard>
      </div>
    </div>
  );
}
