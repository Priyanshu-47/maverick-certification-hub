"use client";

import { useState, useTransition } from "react";
import { Search, CheckCircle, XCircle, Clock, FileText, User, Award, Shield } from "lucide-react";
import { Card, CardContent, Button, Input, Label, Select } from "@/components/ui";
import { StatusBadge } from "@/components/shared";

type RegistrationResult = {
  id: string;
  candidateName: string;
  employeeId: string;
  email: string;
  status: string;
  examTrack: string;
  registrationCode: string;
  submittedAt: string;
  driveName: string;
  eligibilityOutcome: string | null;
};

type Drive = { id: string; name: string };

export default function StatusPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [driveId, setDriveId] = useState("");
  const [drives, setDrives] = useState<Drive[]>([]);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  // Load drives on mount
  useState(() => {
    fetch("/api/status/drives").then((r) => r.json()).then((d) => setDrives(d.drives || []));
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!employeeId.trim() || !driveId) {
      setError("Please enter both Employee ID and select a Drive");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/status/lookup?employeeId=${encodeURIComponent(employeeId.trim())}&driveId=${driveId}`);
      const data = await res.json();
      if (data.registration) {
        setResult(data.registration);
        setLoaded(true);
      } else {
        setError("No registration found for this employee in the selected drive");
        setLoaded(true);
      }
    });
  };

  const STATUS_ICONS: Record<string, typeof CheckCircle> = {
    Submitted: Clock, Acknowledged: CheckCircle, EligibilityPending: Clock,
    Eligible: CheckCircle, NotEligible: XCircle, ApprovalPending: Clock,
    Approved: CheckCircle, Rejected: XCircle, Scheduled: Clock,
    Attended: CheckCircle, Passed: Award, Failed: XCircle,
    VoucherIssued: FileText, VoucherRedeemed: Award, Closed: CheckCircle,
  };

  const statusSteps = [
    { key: "Submitted", label: "Registered" },
    { key: "Acknowledged", label: "Acknowledged" },
    { key: "Eligible", label: "Eligible" },
    { key: "Approved", label: "Approved" },
    { key: "Passed", label: "Passed" },
    { key: "VoucherIssued", label: "Voucher Issued" },
  ];

  const getStepIndex = (status: string) => {
    const order = ["Submitted", "Acknowledged", "EligibilityPending", "Eligible", "NotEligible",
      "ApprovalPending", "Approved", "Rejected", "Scheduled", "Attended", "Passed", "Failed", "VoucherIssued", "VoucherRedeemed", "Closed"];
    return order.indexOf(status);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Header */}
      <div className="hero-gradient py-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, white 0%, transparent 60%)" }} />
        <div className="max-w-2xl mx-auto px-4 text-center relative">
          <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Certification Status</h1>
          <p className="text-indigo-100/80 mt-2">Track your MAP certification drive progress in real-time</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-6 relative z-10 pb-12">
        {/* Search Card */}
        <Card className="shadow-xl border-0">
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <Label htmlFor="employeeId" className="text-sm font-semibold text-slate-700">Employee ID</Label>
                <div className="relative mt-1.5">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="employeeId"
                    placeholder="e.g. EMP100"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="driveId" className="text-sm font-semibold text-slate-700">Certification Drive</Label>
                <Select
                  id="driveId"
                  value={driveId}
                  onChange={(e) => setDriveId(e.target.value)}
                  className="mt-1.5"
                >
                  <option value="">Select a drive</option>
                  {drives.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={isPending}>
                {isPending ? (
                  <span className="flex items-center gap-2"><Clock className="h-4 w-4 animate-spin" /> Looking up...</span>
                ) : (
                  <span className="flex items-center gap-2"><Search className="h-4 w-4" /> Check Status</span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Error */}
        {error && loaded && (
          <Card className="mt-4 border-red-200 bg-red-50">
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <div className="mt-6 space-y-4">
            {/* Candidate Info */}
            <Card className="shadow-lg border-0">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-white flex items-center justify-center text-xl font-bold shrink-0">
                    {result.candidateName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-slate-900">{result.candidateName}</h2>
                    <p className="text-sm text-slate-500">{result.employeeId} · {result.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <StatusBadge status={result.status} />
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-500">{result.examTrack}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Progress Timeline */}
            <Card className="shadow-lg border-0">
              <CardContent className="p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Progress</h3>
                <div className="space-y-0">
                  {statusSteps.map((step, i) => {
                    const currentIdx = getStepIndex(result.status);
                    const stepIdx = getStepIndex(step.key);
                    const isCompleted = stepIdx <= currentIdx && !["NotEligible", "Failed", "Rejected"].includes(result.status);
                    const isCurrent = step.key === result.status || (i === 0 && result.status === "Submitted");
                    const Icon = STATUS_ICONS[step.key] || Clock;

                    return (
                      <div key={step.key} className="flex items-center gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                            isCompleted ? "bg-emerald-100 text-emerald-600" : isCurrent ? "bg-primary/10 text-primary ring-2 ring-primary/20" : "bg-slate-100 text-slate-400"
                          }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          {i < statusSteps.length - 1 && (
                            <div className={`w-0.5 h-6 ${isCompleted ? "bg-emerald-300" : "bg-slate-200"}`} />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${isCompleted || isCurrent ? "text-slate-900" : "text-slate-400"}`}>{step.label}</p>
                        </div>
                        {isCompleted && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                        {isCurrent && !isCompleted && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Details */}
            <Card className="shadow-lg border-0">
              <CardContent className="p-6">
                <h3 className="font-semibold text-slate-900 mb-3">Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Registration Code</span>
                    <span className="text-sm font-mono font-medium text-slate-900">{result.registrationCode}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Drive</span>
                    <span className="text-sm font-medium text-slate-900">{result.driveName}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Submitted</span>
                    <span className="text-sm text-slate-900">{new Date(result.submittedAt).toLocaleDateString()}</span>
                  </div>
                  {result.eligibilityOutcome && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-slate-500">Eligibility</span>
                      <StatusBadge status={result.eligibilityOutcome} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
