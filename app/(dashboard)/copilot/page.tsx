"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import {
  Bot, Play, Check, X, Clock, Shield, Ticket, Mail, TrendingUp, RefreshCw,
  AlertCircle, FileText, Zap, MessageSquare, Upload, GitCompare, LiveIndicator,
  Send, Mic, MicOff,
} from "lucide-react";
import { Card, Button, Badge } from "@/components/ui";
import { PageHeader } from "@/components/shared";
import {
  orchestrateDriveAction, getAgentFeedAction, approveAgentAction, rejectAgentAction,
  compilePolicyAction, analyzeDemandAction, analyzeDocumentAction,
  chatAction, liveEvaluateAction, getPolicyVersionsAction, runABTestAction,
} from "@/lib/actions";
import { prisma } from "@/lib/db";

type AgentActivity = { id: string; agentType: string; action: string; entityType: string | null; reasoning: string | null; riskLevel: string; status: string; createdAt: Date; };
type ChatMsg = { role: "user" | "assistant"; content: string; timestamp: Date };

const AGENT_ICONS: Record<string, typeof Bot> = { Drive: Play, Compliance: Shield, Voucher: Ticket, Comms: Mail, ROI: TrendingUp };
const RISK_COLORS: Record<string, string> = { low: "bg-green-100 text-green-800", medium: "bg-yellow-100 text-yellow-800", high: "bg-red-100 text-red-800" };
const STATUS_COLORS: Record<string, string> = { pending: "bg-blue-100 text-blue-800", approved: "bg-green-100 text-green-800", rejected: "bg-red-100 text-red-800", "auto-executed": "bg-gray-100 text-gray-800" };
const PRIORITY_COLORS: Record<string, string> = { Critical: "bg-red-100 text-red-800", High: "bg-orange-100 text-orange-800", Medium: "bg-yellow-100 text-yellow-800", Low: "bg-green-100 text-green-800" };

type Tab = "agents" | "chat" | "policy" | "demand" | "upload" | "abtest";

export default function CopilotPage() {
  const [feed, setFeed] = useState<AgentActivity[]>([]);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<Tab>("agents");

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Policy state
  const [policyInput, setPolicyInput] = useState("");
  const [policyResult, setPolicyResult] = useState<{ rules: Array<{ field: string; operator: string; value: string | number | boolean; label: string }>; explanation: string; version: number } | null>(null);

  // Demand state
  const [demandInput, setDemandInput] = useState("");
  const [demandResult, setDemandResult] = useState<{ projectName: string; skillGaps: Array<{ skill: string; required: number; available: number; gap: number; priority: string }>; recommendedTracks: Array<{ track: string; candidatesNeeded: number; expectedPassRate: number }>; candidateCount: number; timeline: string; aiAnalysis: string } | null>(null);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<{ skills: Array<{ skill: string; requiredLevel: string; priority: string; context: string }>; summary: string; projectName: string; candidateCount: number; timeline: string } | null>(null);

  // Live eval state
  const [liveEvalResult, setLiveEvalResult] = useState<{ candidateName: string; employeeId: string; policyName: string; result: { passed: boolean; reasoningTree: { rule: string; passed: boolean; detail: string; children?: Array<{ rule: string; passed: boolean; detail: string }> } } } | null>(null);

  // A/B test state
  const [abResult, setAbResult] = useState<{ policyA: { name: string }; policyB: { name: string }; totalCandidates: number; resultsA: { passed: number; passRate: number }; resultsB: { passed: number; passRate: number }; winner: string; confidence: string; candidateDetails: Array<{ candidateName: string; resultA: boolean; resultB: boolean; difference: boolean }> } | null>(null);

  const loadFeed = () => startTransition(async () => { const r = await getAgentFeedAction(30); if (r.success) setFeed(r.feed as AgentActivity[]); });
  useEffect(() => { loadFeed(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const runOrchestration = () => startTransition(async () => { await orchestrateDriveAction(); loadFeed(); });

  // Chat
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput;
    setChatInput("");
    setChatMessages((p) => [...p, { role: "user", content: msg, timestamp: new Date() }]);
    setChatLoading(true);
    const r = await chatAction(msg);
    setChatMessages((p) => [...p, { role: "assistant", content: r.success ? r.message : r.error || "Error", timestamp: new Date() }]);
    setChatLoading(false);
  };

  // Voice
  const [listening, setListening] = useState(false);
  const startVoice = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (e: any) => { setChatInput(e.results[0][0].transcript); };
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  // Compile policy
  const compilePolicy = () => startTransition(async () => { const r = await compilePolicyAction(policyInput); if (r.success) setPolicyResult(r as any); });

  // Analyze demand
  const analyzeDemand = () => startTransition(async () => { try { const input = JSON.parse(demandInput); const r = await analyzeDemandAction(input); if (r.success) setDemandResult(r as any); } catch {} });

  // Upload document
  const handleUpload = () => {
    if (!uploadFile) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const content = reader.result as string;
      startTransition(async () => {
        const r = await analyzeDocumentAction(uploadFile.name, content);
        if (r.success) setUploadResult(r as any);
      });
    };
    reader.readAsText(uploadFile);
  };

  // Live evaluate
  const liveEval = (regId: string) => startTransition(async () => { const r = await liveEvaluateAction(regId); if (r.success) setLiveEvalResult(r as any); });

  // A/B test
  const runAB = (a: string, b: string, drive: string) => startTransition(async () => { const r = await runABTestAction(a, b, drive); if (r.success) setAbResult(r as any); });

  const tabs: { id: Tab; label: string; icon: typeof Bot }[] = [
    { id: "agents", label: "Agents", icon: Bot },
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "policy", label: "NL Compiler", icon: FileText },
    { id: "upload", label: "Document RAG", icon: Upload },
    { id: "demand", label: "Demand", icon: TrendingUp },
    { id: "abtest", label: "A/B Test", icon: GitCompare },
  ];

  return (
    <div>
      <PageHeader title="Certification Copilot" description="AI-powered multi-agent orchestration, chat, document analysis, and live evaluation"
        actions={<Button onClick={loadFeed} variant="outline" disabled={isPending}><RefreshCw className={`w-4 h-4 mr-2 ${isPending ? "animate-spin" : ""}`} />Refresh</Button>} />

      <div className="flex gap-1 mb-6 border-b overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ─── Agents Tab ─────────────────────────────── */}
      {activeTab === "agents" && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Agent Orchestration</h3>
              <Button size="sm" onClick={runOrchestration} disabled={isPending}><Zap className="w-4 h-4 mr-1" />Run All 5 Agents (Parallel)</Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Drive, Compliance, Voucher, Comms, ROI agents execute concurrently via Promise.all</p>
          </Card>
          {feed.length === 0 ? (
            <Card className="p-8 text-center text-gray-500"><Bot className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p>Click &quot;Run All 5 Agents&quot; to start.</p></Card>
          ) : (
            <div className="space-y-3">
              {feed.map((item) => { const Icon = AGENT_ICONS[item.agentType] || Bot; return (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-gray-100 shrink-0"><Icon className="w-5 h-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm">{item.agentType} Agent</span>
                        <Badge className={RISK_COLORS[item.riskLevel] || ""}>{item.riskLevel}</Badge>
                        <Badge className={STATUS_COLORS[item.status] || ""}>{item.status}</Badge>
                        <span className="text-xs text-gray-400 ml-auto"><Clock className="w-3 h-3 inline mr-1" />{new Date(item.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-700"><span className="font-medium">{item.action}</span>{item.entityType && <span className="text-gray-500"> on {item.entityType}</span>}</p>
                      {item.reasoning && <p className="text-sm text-gray-500 bg-gray-50 rounded p-2 mt-1">{item.reasoning}</p>}
                      {item.status === "pending" && (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" onClick={async () => { await approveAgentAction(item.id); loadFeed(); }}><Check className="w-3 h-3 mr-1" />Approve</Button>
                          <Button size="sm" variant="outline" onClick={async () => { await rejectAgentAction(item.id); loadFeed(); }}><X className="w-3 h-3 mr-1" />Reject</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ); })}
            </div>
          )}
        </div>
      )}

      {/* ─── Chat Tab ───────────────────────────────── */}
      {activeTab === "chat" && (
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><MessageSquare className="w-5 h-5" />AI Chat Assistant</h3>
            <p className="text-xs text-gray-500 mb-3">Ask about drives, candidates, vouchers, metrics. Use voice button or type.</p>
            <div className="h-[400px] overflow-y-auto border rounded-lg p-3 mb-3 bg-gray-50 space-y-3">
              {chatMessages.length === 0 && <p className="text-center text-gray-400 text-sm py-8">Ask me anything about your certification drives...</p>}
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-blue-600 text-white" : "bg-white border shadow-sm"}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && <div className="flex justify-start"><div className="bg-white border rounded-lg px-3 py-2 text-sm text-gray-400 animate-pulse">Thinking...</div></div>}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2">
              <input className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="Ask about drives, candidates, metrics..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} />
              <Button onClick={startVoice} variant={listening ? "default" : "outline"} size="icon" title="Voice input">
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}><Send className="w-4 h-4" /></Button>
            </div>
          </Card>
        </div>
      )}

      {/* ─── NL Policy Compiler Tab ─────────────────── */}
      {activeTab === "policy" && (
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Natural Language Policy Compiler</h3>
            <p className="text-sm text-gray-500 mb-3">Type eligibility rules in English. AI compiles to executable rules.</p>
            <textarea className="w-full border rounded-md p-3 text-sm min-h-[100px]" placeholder="e.g., Tenure > 90 days, Python training done, no more than 1 failed attempt, BU = Tech" value={policyInput} onChange={(e) => setPolicyInput(e.target.value)} />
            <Button onClick={compilePolicy} disabled={isPending || !policyInput.trim()} className="mt-2">{isPending ? "Compiling..." : "Compile Rules"}</Button>
          </Card>
          {policyResult && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3"><FileText className="w-5 h-5 text-blue-600" /><h3 className="font-semibold">Compiled Rules</h3><Badge variant="info">v{policyResult.version}</Badge></div>
              <p className="text-sm text-gray-600 mb-3">{policyResult.explanation}</p>
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-gray-50"><th className="text-left py-2 px-3">Rule</th><th className="text-left py-2 px-3">Field</th><th className="text-left py-2 px-3">Op</th><th className="text-left py-2 px-3">Value</th></tr></thead>
                <tbody>{policyResult.rules.map((r, i) => (
                  <tr key={i} className="border-b"><td className="py-2 px-3">{r.label}</td><td className="py-2 px-3"><code className="bg-gray-100 px-1 rounded text-xs">{r.field}</code></td><td className="py-2 px-3"><Badge>{r.operator}</Badge></td><td className="py-2 px-3 font-medium">{String(r.value)}</td></tr>
                ))}</tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* ─── Document RAG Tab ───────────────────────── */}
      {activeTab === "upload" && (
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2"><Upload className="w-5 h-5" />Document Intelligence (RAG)</h3>
            <p className="text-sm text-gray-500 mb-3">Upload RFPs, SOWs, job descriptions. AI extracts certification requirements.</p>
            <div className="flex items-center gap-3">
              <input type="file" accept=".txt,.md,.csv,.json" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} className="flex-1 text-sm" />
              <Button onClick={handleUpload} disabled={!uploadFile || isPending}>{isPending ? "Analyzing..." : "Analyze Document"}</Button>
            </div>
          </Card>
          {uploadResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 text-center"><p className="text-xs text-gray-500">Project</p><p className="font-semibold text-sm">{uploadResult.projectName}</p></Card>
                <Card className="p-3 text-center"><p className="text-xs text-gray-500">Skills Found</p><p className="font-semibold text-2xl text-blue-600">{uploadResult.skills.length}</p></Card>
                <Card className="p-3 text-center"><p className="text-xs text-gray-500">Candidates</p><p className="font-semibold text-2xl text-green-600">{uploadResult.candidateCount}</p></Card>
              </div>
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Extracted Skills</h3>
                <div className="space-y-2">{uploadResult.skills.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                    <div className="flex-1"><p className="font-medium text-sm">{s.skill}</p><p className="text-xs text-gray-500">{s.requiredLevel} — {s.context}</p></div>
                    <Badge className={PRIORITY_COLORS[s.priority] || ""}>{s.priority}</Badge>
                  </div>
                ))}</div>
              </Card>
              <Card className="p-4"><h3 className="font-semibold mb-2">Summary</h3><p className="text-sm text-gray-600">{uploadResult.summary}</p></Card>
            </div>
          )}
        </div>
      )}

      {/* ─── Demand Tab ─────────────────────────────── */}
      {activeTab === "demand" && (
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Certification Demand Intelligence</h3>
            <textarea className="w-full border rounded-md p-3 text-sm min-h-[120px] font-mono" placeholder='{"projectName":"Healthcare AI","requiredSkills":[{"skill":"Azure AI","required":40,"available":18}]}' value={demandInput} onChange={(e) => setDemandInput(e.target.value)} />
            <Button onClick={analyzeDemand} disabled={isPending || !demandInput.trim()} className="mt-2">{isPending ? "Analyzing..." : "Analyze Demand"}</Button>
          </Card>
          {demandResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <Card className="p-3 text-center"><p className="text-xs text-gray-500">Project</p><p className="font-semibold text-sm">{demandResult.projectName}</p></Card>
                <Card className="p-3 text-center"><p className="text-xs text-gray-500">Total Gap</p><p className="font-semibold text-2xl text-red-600">{demandResult.candidateCount}</p></Card>
                <Card className="p-3 text-center"><p className="text-xs text-gray-500">Timeline</p><p className="font-semibold text-sm">{demandResult.timeline}</p></Card>
                <Card className="p-3 text-center"><p className="text-xs text-gray-500">Tracks</p><p className="font-semibold text-2xl text-blue-600">{demandResult.recommendedTracks.length}</p></Card>
              </div>
              <Card className="p-4"><h3 className="font-semibold mb-3">Skill Gaps</h3>
                <div className="space-y-2">{demandResult.skillGaps.map((g) => (
                  <div key={g.skill} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                    <div className="flex-1"><p className="font-medium text-sm">{g.skill}</p><div className="flex gap-4 text-xs text-gray-500 mt-1"><span>Required: {g.required}</span><span>Available: {g.available}</span><span className="text-red-600 font-semibold">Gap: {g.gap}</span></div></div>
                    <Badge className={PRIORITY_COLORS[g.priority] || ""}>{g.priority}</Badge>
                  </div>
                ))}</div>
              </Card>
              <Card className="p-4"><h3 className="font-semibold mb-2">AI Analysis</h3><p className="text-sm text-gray-600 whitespace-pre-wrap">{demandResult.aiAnalysis}</p></Card>
            </div>
          )}
        </div>
      )}

      {/* ─── A/B Test Tab ───────────────────────────── */}
      {activeTab === "abtest" && (
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2"><GitCompare className="w-5 h-5" />A/B Policy Testing</h3>
            <p className="text-sm text-gray-500 mb-3">Compare two policy versions against all candidates. See pass rate differences and which candidates are affected.</p>
            <p className="text-xs text-gray-400">Compile at least 2 policies in the NL Compiler tab first, then compare them here.</p>
          </Card>
          {abResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="p-3 text-center"><p className="text-xs text-gray-500">Policy A</p><p className="font-semibold text-sm">{abResult.policyA.name}</p><p className="text-2xl font-bold text-blue-600">{abResult.resultsA.passRate}%</p></Card>
                <Card className="p-3 text-center"><p className="text-xs text-gray-500">Policy B</p><p className="font-semibold text-sm">{abResult.policyB.name}</p><p className="text-2xl font-bold text-green-600">{abResult.resultsB.passRate}%</p></Card>
                <Card className="p-3 text-center"><p className="text-xs text-gray-500">Winner</p><p className="font-semibold text-2xl">{abResult.winner === "Tie" ? "Tie" : `Policy ${abResult.winner}`}</p></Card>
                <Card className="p-3 text-center"><p className="text-xs text-gray-500">Confidence</p><p className="font-semibold text-sm">{abResult.confidence}</p></Card>
              </div>
              <Card className="p-4"><h3 className="font-semibold mb-3">Candidate Comparison</h3>
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-gray-50"><th className="text-left py-2 px-3">Candidate</th><th className="text-center py-2 px-3">Policy A</th><th className="text-center py-2 px-3">Policy B</th><th className="text-center py-2 px-3">Diff</th></tr></thead>
                    <tbody>{abResult.candidateDetails.map((c, i) => (
                      <tr key={i} className={`border-b ${c.difference ? "bg-yellow-50" : ""}`}>
                        <td className="py-2 px-3">{c.candidateName}</td>
                        <td className="text-center py-2 px-3">{c.resultA ? <Check className="w-4 h-4 text-green-600 inline" /> : <X className="w-4 h-4 text-red-600 inline" />}</td>
                        <td className="text-center py-2 px-3">{c.resultB ? <Check className="w-4 h-4 text-green-600 inline" /> : <X className="w-4 h-4 text-red-600 inline" />}</td>
                        <td className="text-center py-2 px-3">{c.difference ? <Badge className="bg-yellow-100 text-yellow-800">Different</Badge> : <span className="text-gray-400">Same</span>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
