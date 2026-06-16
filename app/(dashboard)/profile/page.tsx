"use client";

import { Mail, User, Shield, Calendar, Hash, Building, Phone, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";

const ROLE_COLORS: Record<string, string> = {
  Admin: "bg-violet-100 text-violet-700 border-violet-200",
  Coordinator: "bg-blue-100 text-blue-700 border-blue-200",
  Approver: "bg-amber-100 text-amber-700 border-amber-200",
  ReadOnly: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function ProfilePage() {
  // Read from cookie
  const sessionStr = typeof document !== "undefined" ? document.cookie.split("; ").find((c) => c.startsWith("mch_session="))?.split("=").slice(1).join("=") : null;
  let user = { name: "User", email: "user@maverick.local", role: "Admin", employeeId: "EMP001" };
  try {
    if (sessionStr) user = JSON.parse(decodeURIComponent(sessionStr));
  } catch {}

  const initials = user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="hero-gradient rounded-2xl p-8 text-white mb-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white 0%, transparent 50%)" }} />
        <div className="relative flex items-center gap-5">
          <div className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl font-bold border-2 border-white/30 shadow-xl">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <p className="text-indigo-100/80 text-sm mt-1">{user.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={cn("text-xs font-medium px-3 py-1 rounded-full border", ROLE_COLORS[user.role] || "bg-white/20 text-white border-white/30")}>
                {user.role}
              </span>
              {user.employeeId && <span className="text-xs text-indigo-200/70">{user.employeeId}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <Card className="border-0 card-shadow">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Personal Information</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4 py-3 border-b border-slate-100">
              <div className="p-2 rounded-lg bg-slate-100"><User className="h-4 w-4 text-slate-500" /></div>
              <div className="flex-1"><p className="text-xs text-slate-500">Full Name</p><p className="text-sm font-medium text-slate-900">{user.name}</p></div>
            </div>
            <div className="flex items-center gap-4 py-3 border-b border-slate-100">
              <div className="p-2 rounded-lg bg-slate-100"><Mail className="h-4 w-4 text-slate-500" /></div>
              <div className="flex-1"><p className="text-xs text-slate-500">Email</p><p className="text-sm font-medium text-slate-900">{user.email}</p></div>
            </div>
            <div className="flex items-center gap-4 py-3 border-b border-slate-100">
              <div className="p-2 rounded-lg bg-slate-100"><Shield className="h-4 w-4 text-slate-500" /></div>
              <div className="flex-1"><p className="text-xs text-slate-500">Role</p><p className="text-sm font-medium text-slate-900">{user.role}</p></div>
            </div>
            <div className="flex items-center gap-4 py-3 border-b border-slate-100">
              <div className="p-2 rounded-lg bg-slate-100"><Hash className="h-4 w-4 text-slate-500" /></div>
              <div className="flex-1"><p className="text-xs text-slate-500">Employee ID</p><p className="text-sm font-medium text-slate-900">{user.employeeId}</p></div>
            </div>
            <div className="flex items-center gap-4 py-3 border-b border-slate-100">
              <div className="p-2 rounded-lg bg-slate-100"><Building className="h-4 w-4 text-slate-500" /></div>
              <div className="flex-1"><p className="text-xs text-slate-500">Department</p><p className="text-sm font-medium text-slate-900">Engineering</p></div>
            </div>
            <div className="flex items-center gap-4 py-3 border-b border-slate-100">
              <div className="p-2 rounded-lg bg-slate-100"><MapPin className="h-4 w-4 text-slate-500" /></div>
              <div className="flex-1"><p className="text-xs text-slate-500">Location</p><p className="text-sm font-medium text-slate-900">Bangalore, India</p></div>
            </div>
            <div className="flex items-center gap-4 py-3">
              <div className="p-2 rounded-lg bg-slate-100"><Calendar className="h-4 w-4 text-slate-500" /></div>
              <div className="flex-1"><p className="text-xs text-slate-500">Member Since</p><p className="text-sm font-medium text-slate-900">January 2026</p></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
