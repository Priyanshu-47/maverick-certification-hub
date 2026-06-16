"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Sparkles, Eye, EyeOff } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";
import { DEMO_USERS } from "@/lib/constants";
import { loginAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

const ROLE_COLORS: Record<string, string> = {
  Admin: "border-violet-200 hover:border-violet-400 hover:bg-violet-50",
  Coordinator: "border-blue-200 hover:border-blue-400 hover:bg-blue-50",
  Approver: "border-amber-200 hover:border-amber-400 hover:bg-amber-50",
  ReadOnly: "border-slate-200 hover:border-slate-400 hover:bg-slate-50",
};

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedEmail, setSelectedEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (email: string) => {
    if (!password) {
      setError("Please enter your password");
      return;
    }
    setLoading(true);
    setError("");
    const result = await loginAction(email, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  const handleSelectUser = (email: string) => {
    setSelectedEmail(email);
    setError("");
  };

  return (
    <div className="min-h-screen mesh-bg flex">
      <div className="hidden lg:flex lg:w-1/2 hero-gradient items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 80%, white 0%, transparent 50%)" }} />
        <div className="relative text-white max-w-md">
          <Shield className="h-14 w-14 mb-6 opacity-90" />
          <h1 className="text-3xl font-bold tracking-tight mb-4">Maverick Certification Hub</h1>
          <p className="text-indigo-100/90 text-lg leading-relaxed mb-6">
            Enterprise command center for MAP certification drives — registration through voucher redemption.
          </p>
          <div className="flex items-center gap-2 text-sm text-indigo-200/80">
            <Sparkles className="h-4 w-4" />
            Secured with AWS Cognito
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 lg:hidden">
            <Shield className="h-10 w-10 text-primary mx-auto mb-3" />
            <h1 className="text-xl font-bold text-slate-900">Maverick Certification Hub</h1>
          </div>

          <Card className="border-0 card-shadow-lg">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Sign in</h2>
              <p className="text-sm text-slate-500 mb-5">Select a user and enter password</p>

              <div className="space-y-2 mb-4">
                {DEMO_USERS.map((u) => (
                  <button
                    key={u.email}
                    disabled={loading}
                    onClick={() => handleSelectUser(u.email)}
                    className={cn(
                      "w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all disabled:opacity-50",
                      selectedEmail === u.email
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : ROLE_COLORS[u.role] ?? "border-slate-200",
                    )}
                  >
                    <span className="font-semibold text-slate-900">{u.name}</span>
                    <span className="text-xs text-slate-500 block mt-0.5">{u.role} · {u.email}</span>
                  </button>
                ))}
              </div>

              {selectedEmail && (
                <div className="space-y-3">
                  <div className="relative">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && selectedEmail) handleLogin(selectedEmail); }}
                      placeholder="Enter your password"
                      className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 pr-11 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <p className="text-xs text-slate-400 mt-1">Demo password: <span className="font-mono font-medium text-slate-600">Mav@2026</span></p>
                  </div>
                  <Button
                    onClick={() => handleLogin(selectedEmail)}
                    disabled={loading || !password}
                    className="w-full"
                    size="lg"
                  >
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>
                </div>
              )}

              {error && <p className="text-sm text-red-600 mt-3 text-center">{error}</p>}
            </CardContent>
          </Card>

          <p className="text-center text-sm text-slate-500 mt-6">
            <Link href="/" className="hover:text-primary font-medium">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
