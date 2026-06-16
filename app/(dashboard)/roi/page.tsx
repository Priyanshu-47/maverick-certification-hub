"use client";

import { useState, useTransition } from "react";
import { TrendingUp, DollarSign, BarChart3, RefreshCw, AlertCircle, Building2 } from "lucide-react";
import { Card, Button } from "@/components/ui";
import { PageHeader, MetricCard } from "@/components/shared";
import { generateROIReportAction } from "@/lib/actions";

type ROIReport = {
  totalInvestment: number;
  totalRevenue: number;
  roiPercent: number;
  certificationsByTrack: { track: string; count: number; avgCost: number }[];
  deploymentRate: number;
  topPerformingTracks: string[];
  profitabilityByBU: { bu: string; investment: number; revenue: number; roi: number }[];
  aiInsights: string;
};

export default function ROIPage() {
  const [report, setReport] = useState<ROIReport | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadReport = () => {
    startTransition(async () => {
      setError("");
      const result = await generateROIReportAction();
      if (result.success) {
        setReport(result as unknown as ROIReport);
      } else {
        setError(result.error || "Failed to generate report");
      }
    });
  };

  return (
    <div>
      <PageHeader
        title="ROI Command Center"
        description="Skill-to-Revenue Trace — certification profitability and skill-gap forecasting"
        actions={
          <Button onClick={loadReport} disabled={isPending}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isPending ? "animate-spin" : ""}`} />
            {isPending ? "Generating..." : "Generate ROI Report"}
          </Button>
        }
      />

      {error && (
        <Card className="p-4 border-red-200 bg-red-50 mb-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
        </Card>
      )}

      {!report && !error && (
        <Card className="p-12 text-center text-gray-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Click &quot;Generate ROI Report&quot; to analyze certification investment returns.</p>
        </Card>
      )}

      {report && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Total Investment" value={`$${report.totalInvestment.toLocaleString()}`} icon={DollarSign} />
            <MetricCard title="Estimated Revenue" value={`$${report.totalRevenue.toLocaleString()}`} icon={TrendingUp} variant="success" />
            <MetricCard title="ROI" value={`${report.roiPercent}%`} icon={BarChart3} variant={report.roiPercent > 100 ? "success" : "default"} />
            <MetricCard title="Deployment Rate" value={`${report.deploymentRate}%`} icon={TrendingUp} />
          </div>

          {/* AI Insights */}
          <Card className="p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              AI Strategic Insights
            </h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{report.aiInsights}</p>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Certification Tracks */}
            <Card className="p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-600" />
                Certifications by Track
              </h3>
              {report.certificationsByTrack.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No certification data yet.</p>
              ) : (
                <div className="space-y-3">
                  {report.certificationsByTrack.map((track) => (
                    <div key={track.track} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{track.track}</p>
                        <p className="text-xs text-gray-500">{track.count} certifications</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">${track.avgCost.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">avg cost</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* BU Profitability */}
            <Card className="p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                Profitability by Business Unit
              </h3>
              {report.profitabilityByBU.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No BU data yet.</p>
              ) : (
                <div className="space-y-3">
                  {report.profitabilityByBU.map((bu) => (
                    <div key={bu.bu} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">{bu.bu}</p>
                        <span className={`text-sm font-bold ${bu.roi > 100 ? "text-green-600" : bu.roi > 0 ? "text-yellow-600" : "text-red-600"}`}>
                          {bu.roi}% ROI
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>Invested: ${bu.investment.toLocaleString()}</span>
                        <span>Revenue: ${bu.revenue.toLocaleString()}</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(5, bu.roi / 5))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Top Tracks */}
          {report.topPerformingTracks.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold mb-3">Top Performing Certification Tracks</h3>
              <div className="flex flex-wrap gap-3">
                {report.topPerformingTracks.map((track, i) => (
                  <div key={track} className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-800 rounded-lg">
                    <span className="text-lg font-bold text-green-600">#{i + 1}</span>
                    <span className="font-medium">{track}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
