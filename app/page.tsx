import Link from "next/link";
import {
  ArrowRight, Shield, Mail, CheckCircle, BarChart3, Zap, Lock, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="min-h-screen mesh-bg">
      <header className="border-b border-slate-200/60 bg-white/70 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg hero-gradient flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-slate-900">Maverick Certification Hub</span>
          </div>
          <div className="flex gap-3">
            <Link href="/login"><Button variant="outline">Sign In</Button></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-20">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/8 text-primary px-4 py-1.5 text-sm font-semibold mb-6 border border-primary/10">
              <Sparkles className="h-4 w-4" /> MAP Certification Drive Automation
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight mb-5 leading-[1.1]">
              Maverick<br className="sm:hidden" /> Certification Hub
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              Automate MAP certification drives from registration to voucher utilization — secure, auditable, SLA-driven.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login"><Button size="lg" className="shadow-lg shadow-primary/20">Get Started <ArrowRight className="h-4 w-4" /></Button></Link>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-20">
            {[
              { icon: Mail, title: "70% Less Email", desc: "Automated communications with SLA tracking", color: "text-primary" },
              { icon: Lock, title: "Zero Duplicates", desc: "Transactional voucher allocation", color: "text-emerald-600" },
              { icon: Zap, title: "SLA-Driven", desc: "5-minute acknowledgement SLA with breach alerts", color: "text-amber-600" },
              { icon: BarChart3, title: "Full Audit", desc: "Complete visibility into every key action", color: "text-indigo-600" },
            ].map((kpi) => (
              <div key={kpi.title} className="rounded-2xl border border-slate-200/80 bg-white p-6 card-shadow hover:card-shadow-lg transition-shadow">
                <kpi.icon className={cn("h-8 w-8 mb-4", kpi.color)} />
                <h3 className="font-bold text-slate-900">{kpi.title}</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{kpi.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-center mb-10 text-slate-900">Certification Journey</h2>
          <div className="flex flex-wrap justify-center items-center gap-4">
            {["Registration", "Eligibility", "Assessment", "Voucher", "Reporting"].map((step, i, arr) => (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className="h-14 w-14 rounded-2xl hero-gradient text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-primary/20">
                    {i + 1}
                  </div>
                  <span className="text-sm font-semibold mt-3 text-slate-700">{step}</span>
                </div>
                {i < arr.length - 1 && <ArrowRight className="h-5 w-5 text-slate-300 mx-2 sm:mx-4 hidden sm:block" />}
              </div>
            ))}
          </div>
        </section>

        <section className="hero-gradient py-20 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, white 0%, transparent 60%)" }} />
          <div className="max-w-4xl mx-auto px-6 text-center relative text-white">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-90" />
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Your certification command center</h2>
            <p className="text-indigo-100/90 mb-8 max-w-xl mx-auto">Centralized platform for L&D teams to manage drives efficiently, securely, and transparently.</p>
            <Link href="/login"><Button size="lg" variant="secondary" className="shadow-xl">Sign In</Button></Link>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-slate-500 bg-white/50">
        Maverick Certification Hub — Internal Enterprise Platform
      </footer>
    </div>
  );
}
