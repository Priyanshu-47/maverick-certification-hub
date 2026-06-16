"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, FileText, Sparkles, CheckCircle, AlertTriangle, Clock, ExternalLink,
  GraduationCap, BookOpen, HelpCircle, Ticket, Shield,
} from "lucide-react";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { generatePassportAction, scoreVoucherAction, assessReadinessAction } from "@/lib/actions";

type Tab = "passport" | "readiness" | "voucher";

type PassportData = {
  registrationCode: string;
  candidateName: string;
  employeeId: string;
  driveName: string;
  examTrack: string;
  eligibilityPath: string[];
  trainingStatus: string;
  assessmentResult: { score: number | null; outcome: string; date: string | null };
  voucherStatus: { issued: boolean; redeemed: boolean; code?: string };
  evidenceLinks: string[];
  aiSummary: string;
  nextActions: string[];
  generatedAt: string;
};

type ReadinessResult = {
  readinessScore: number;
  weakTopics: string[];
  preparationPlan: { step: string; resource: string; estimatedHours: number }[];
  mockQuestions: { question: string; expectedAnswer: string; difficulty: string }[];
  recommendation: string;
  aiSummary: string;
};

type VoucherScoreResult = {
  likelihoodScore: number;
  riskFactors: string[];
  explanation: string;
  recommendation: string;
  confidence: number;
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-red-100 text-red-700",
};

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "passport", label: "Evidence Passport", icon: FileText },
  { key: "readiness", label: "Readiness Coach", icon: GraduationCap },
  { key: "voucher", label: "Voucher Scoring", icon: Shield },
];

const scoreColor = (s: number) => s >= 80 ? "text-emerald-600" : s >= 50 ? "text-amber-600" : "text-red-600";
const scoreBg = (s: number) => s >= 80 ? "bg-emerald-50 border-emerald-200" : s >= 50 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
const recVariant = (r: string) => r === "Issue" ? "success" : r === "Hold" ? "warning" : "danger";

export default function CertificationAIPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (searchParams.get("tab") as Tab) || "passport";
  const initialId = searchParams.get("id") || "";

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [regId, setRegId] = useState(initialId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [passport, setPassport] = useState<PassportData | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [voucherScore, setVoucherScore] = useState<VoucherScoreResult | null>(null);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [voucherHistory, setVoucherHistory] = useState<(VoucherScoreResult & { registrationId: string; timestamp: string })[]>([]);

  useEffect(() => {
    const tab = searchParams.get("tab") as Tab;
    const id = searchParams.get("id");
    if (tab && TABS.some((t) => t.key === tab)) setActiveTab(tab);
    if (id) setRegId(id);
  }, [searchParams]);

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setError("");
  };

  const handlePassport = async () => {
    if (!regId.trim()) return;
    setLoading(true); setError(""); setPassport(null); setReadiness(null); setVoucherScore(null);
    try {
      const [p, r, v] = await Promise.all([
        generatePassportAction(regId.trim()),
        assessReadinessAction(regId.trim()),
        scoreVoucherAction(regId.trim()),
      ]);
      if (p.error) setError(p.error); else setPassport(p as unknown as PassportData);
      if (r.success) setReadiness(r as unknown as ReadinessResult);
      if (v.success) setVoucherScore(v as unknown as VoucherScoreResult);
    } catch { setError("Failed to generate passport"); }
    setLoading(false);
  };

  const handleReadiness = async () => {
    if (!regId.trim()) return;
    setLoading(true); setError(""); setReadiness(null);
    try {
      const r = await assessReadinessAction(regId.trim());
      if (r.error) setError(r.error); else setReadiness(r as unknown as ReadinessResult);
    } catch { setError("Failed to assess readiness"); }
    setLoading(false);
  };

  const handleVoucher = async () => {
    if (!regId.trim()) return;
    setLoading(true); setError(""); setVoucherScore(null);
    try {
      const r = await scoreVoucherAction(regId.trim());
      if (r.error) setError(r.error);
      else {
        const data = r as unknown as VoucherScoreResult;
        setVoucherScore(data);
        setVoucherHistory((prev) => [{ ...data, registrationId: regId.trim(), timestamp: new Date().toISOString() }, ...prev]);
      }
    } catch { setError("Failed to score voucher"); }
    setLoading(false);
  };

  const handleAction = () => {
    if (activeTab === "passport") handlePassport();
    else if (activeTab === "readiness") handleReadiness();
    else handleVoucher();
  };

  const actionLabel = loading
    ? (activeTab === "passport" ? "Generating..." : activeTab === "readiness" ? "Assessing..." : "Scoring...")
    : (activeTab === "passport" ? "Generate All" : activeTab === "readiness" ? "Assess Readiness" : "Score Allocation");
  const actionIcon = loading ? <Sparkles className="h-4 w-4 mr-2 animate-spin" /> : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="p-2 rounded-lg hover:bg-slate-100 transition-colors"><ArrowLeft className="h-4 w-4 text-slate-600" /></Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Certification AI</h1>
          <p className="text-slate-500 mt-1 text-sm">AI-powered passport, readiness coaching, and voucher intelligence</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => switchTab(tab.key)}
              className={cn("flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}>
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Input */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Registration ID</label>
              <input value={regId} onChange={(e) => setRegId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAction()}
                placeholder="e.g. REG-00067 or paste the full registration ID" className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <Button onClick={handleAction} disabled={loading || !regId.trim()} size="lg">
              {actionIcon}{actionLabel}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </CardContent>
      </Card>

      {/* ═══ PASSPORT TAB ═══ */}
      {activeTab === "passport" && passport && (
        <div className="space-y-6">
          <Card className="border-0 bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2"><FileText className="h-5 w-5" /><span className="text-sm font-medium text-violet-200">Evidence Passport</span></div>
                  <h2 className="text-2xl font-bold">{passport.candidateName}</h2>
                  <p className="text-violet-200 mt-1">{passport.employeeId} · {passport.driveName}</p>
                </div>
                <div className="text-right">
                  <Badge variant="info" className="bg-white/20 text-white border-white/30">{passport.examTrack}</Badge>
                  <p className="text-xs text-violet-300 mt-2">Generated {new Date(passport.generatedAt).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardContent className="p-6">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-500" />Eligibility Rule Path</h3>
                <div className="space-y-2">
                  {passport.eligibilityPath.map((step, i) => (
                    <div key={i} className={cn("flex items-start gap-3 p-3 rounded-lg text-sm", step.startsWith("PASS") ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")}>
                      {step.startsWith("PASS") ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}{step}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div><p className="text-xs font-semibold uppercase text-slate-500">Training</p><p className={cn("text-lg font-bold", passport.trainingStatus === "Completed" ? "text-emerald-600" : "text-amber-600")}>{passport.trainingStatus}</p></div>
                <div><p className="text-xs font-semibold uppercase text-slate-500">Assessment</p><p className={cn("text-lg font-bold", passport.assessmentResult.outcome === "Passed" ? "text-emerald-600" : passport.assessmentResult.outcome === "Failed" ? "text-red-600" : "text-slate-600")}>{passport.assessmentResult.score !== null ? `${passport.assessmentResult.score}%` : "—"} · {passport.assessmentResult.outcome}</p></div>
                <div><p className="text-xs font-semibold uppercase text-slate-500">Voucher</p><div className="flex gap-2 mt-1">{passport.voucherStatus.issued && <Badge variant="info">Issued</Badge>}{passport.voucherStatus.redeemed && <Badge variant="success">Redeemed</Badge>}{!passport.voucherStatus.issued && <Badge variant="default">Not Issued</Badge>}</div></div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-500" />AI-Generated Summary</h3>
              <p className="text-slate-700 leading-relaxed">{passport.aiSummary}</p>
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Recommended Next Actions</p>
                {passport.nextActions.map((a, i) => <div key={i} className="flex items-center gap-2 text-sm text-slate-700"><Clock className="h-3 w-3 text-slate-400 shrink-0" />{a}</div>)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-slate-900 mb-3">Evidence Links</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {passport.evidenceLinks.map((link, i) => (
                  <Link key={i} href={link} className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:border-primary/40 hover:bg-primary/5 transition-all text-sm text-slate-700">
                    <ExternalLink className="h-3 w-3 text-slate-400 shrink-0" />{link.split("/").pop()?.replace(/-/g, " ")}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "passport" && !passport && !loading && (
        <Card className="p-12 text-center">
          <FileText className="h-16 w-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Audit-ready certification profile</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto">Enter a registration ID and click &quot;Generate All&quot; to create a full evidence passport with readiness score and voucher intelligence.</p>
        </Card>
      )}

      {/* ═══ READINESS TAB ═══ */}
      {activeTab === "readiness" && readiness && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardContent className="p-6 text-center">
                <h3 className="font-semibold text-slate-900 mb-4">Readiness Score</h3>
                <div className={cn("rounded-2xl border-2 p-6 inline-block", scoreBg(readiness.readinessScore))}>
                  <p className={cn("text-5xl font-bold", scoreColor(readiness.readinessScore))}>{readiness.readinessScore}</p>
                  <p className="text-xs text-slate-500 mt-1">out of 100</p>
                </div>
                <div className="mt-4"><Badge variant={readiness.recommendation === "Issue" ? "success" : readiness.recommendation === "Hold" ? "warning" : "danger"} className="text-sm">{readiness.recommendation === "Issue" ? "Ready for Voucher" : readiness.recommendation === "Hold" ? "Needs Preparation" : "Retraining Required"}</Badge></div>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardContent className="p-6">
                <h3 className="font-semibold text-slate-900 mb-3">AI Assessment Summary</h3>
                <p className="text-slate-700 leading-relaxed">{readiness.aiSummary}</p>
                {readiness.weakTopics.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Weak Areas</p>
                    <div className="flex flex-wrap gap-2">
                      {readiness.weakTopics.map((t, i) => <div key={i} className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 px-3 py-1 rounded-full"><AlertTriangle className="h-3 w-3" />{t}</div>)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" />Preparation Plan</h3>
              <div className="space-y-3">
                {readiness.preparationPlan.map((step, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</div>
                    <div className="flex-1"><p className="text-sm font-semibold text-slate-900">{step.step}</p><p className="text-xs text-slate-500 mt-0.5">{step.resource}</p></div>
                    <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0"><Clock className="h-3 w-3" />{step.estimatedHours}h</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-right"><p className="text-xs text-slate-400">Total estimated: {readiness.preparationPlan.reduce((a, s) => a + s.estimatedHours, 0)} hours</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><HelpCircle className="h-4 w-4 text-primary" />Mock Exam Questions</h3>
              <div className="space-y-3">
                {readiness.mockQuestions.map((q, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
                    <button onClick={() => setExpandedQ(expandedQ === i ? null : i)} className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3"><span className="text-xs font-bold text-slate-400">Q{i + 1}</span><span className="text-sm text-slate-700">{q.question}</span></div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", DIFFICULTY_COLORS[q.difficulty] || "bg-slate-100 text-slate-600")}>{q.difficulty}</span>
                        <svg className={cn("h-4 w-4 text-slate-400 transition-transform", expandedQ === i && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </button>
                    {expandedQ === i && <div className="px-4 pb-4 border-t border-slate-100 pt-3"><p className="text-xs font-semibold uppercase text-slate-500 mb-1">Expected Answer</p><p className="text-sm text-slate-700 bg-emerald-50 p-3 rounded-lg">{q.expectedAnswer}</p></div>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "readiness" && !readiness && !loading && (
        <Card className="p-12 text-center">
          <GraduationCap className="h-16 w-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">AI Pre-Voucher Readiness Coach</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto">Enter a registration ID to run an AI-powered readiness assessment with preparation plan, mock questions, and voucher recommendation.</p>
        </Card>
      )}

      {/* ═══ VOUCHER TAB ═══ */}
      {activeTab === "voucher" && voucherScore && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardContent className="p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Voucher Intelligence Score</h3>
                <div className="flex items-center gap-6">
                  <div className={cn("rounded-2xl border-2 p-6 text-center shrink-0", scoreBg(voucherScore.likelihoodScore))}>
                    <p className={cn("text-5xl font-bold", scoreColor(voucherScore.likelihoodScore))}>{voucherScore.likelihoodScore}</p>
                    <p className="text-xs text-slate-500 mt-1">out of 100</p>
                  </div>
                  <div className="flex-1">
                    <Badge variant={recVariant(voucherScore.recommendation)} className="text-sm mb-3">{voucherScore.recommendation}</Badge>
                    <p className="text-slate-700 leading-relaxed">{voucherScore.explanation}</p>
                    <p className="text-xs text-slate-400 mt-2">Confidence: {voucherScore.confidence}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-slate-900 mb-3">Risk Factors</h3>
                {voucherScore.riskFactors.length === 0 ? (
                  <div className="flex items-center gap-2 text-emerald-700 text-sm"><CheckCircle className="h-4 w-4" />No risk factors identified</div>
                ) : (
                  <div className="space-y-2">
                    {voucherScore.riskFactors.map((f, i) => <div key={i} className="flex items-start gap-2 text-sm text-red-700 bg-red-50 p-2 rounded-lg"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{f}</div>)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "voucher" && !voucherScore && !loading && (
        <Card className="p-12 text-center">
          <Ticket className="h-16 w-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Voucher Intelligence Engine</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto">Enter a registration ID to get an AI-powered score predicting whether a certification voucher will be productively used.</p>
        </Card>
      )}
    </div>
  );
}
