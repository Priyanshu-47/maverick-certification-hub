"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, Users, CheckCircle, ClipboardCheck, GraduationCap,
  Ticket, Mail, BarChart3, AlertTriangle, ScrollText, Settings, Zap, Search, Bell,
  LogOut, Menu, X, Bot, TrendingUp, User, ChevronDown, FileText, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { Button } from "./ui";
import { logoutAction } from "@/lib/actions";
import type { SessionUser } from "@/types";

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, FolderKanban, Users, CheckCircle, ClipboardCheck, GraduationCap,
  Ticket, Mail, BarChart3, AlertTriangle, ScrollText, Settings, Zap, Bot, TrendingUp,
  FileText, Bell, Sparkles,
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  Admin: "bg-violet-100 text-violet-700",
  Coordinator: "bg-blue-100 text-blue-700",
  Approver: "bg-amber-100 text-amber-700",
  ReadOnly: "bg-slate-100 text-slate-600",
};

type DBNotification = {
  id: string;
  title: string;
  description: string;
  type: string;
  severity: string;
  href: string;
  icon: string;
  color: string;
  bgColor: string;
  read: boolean;
  createdAt: string;
};

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [notifications, setNotifications] = React.useState<DBNotification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const notifRef = React.useRef<HTMLDivElement>(null);
  const profileRef = React.useRef<HTMLDivElement>(null);

  const navItems = NAV_ITEMS.filter((n) => !n.roles || n.roles.includes(user.role));

  // Fetch notifications from DB
  const fetchNotifications = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  React.useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  React.useEffect(() => { if (!loading) fetchNotifications(); }, [pathname, fetchNotifications, loading]);

  // Close dropdowns on outside click
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotificationsOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotifClick = async (id: string) => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setNotificationsOpen(false);
  };

  const handleMarkAllRead = async () => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  const handleLogout = async () => {
    await logoutAction();
    window.location.href = "/login";
  };

  return (
    <div className="flex h-screen overflow-hidden mesh-bg">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 transform transition-transform lg:translate-x-0 lg:static",
        "bg-[rgb(var(--sidebar))] text-white border-r border-white/5",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex h-16 items-center gap-3 px-5 border-b border-white/10">
          <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center">
            <ShieldIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Maverick</p>
            <p className="text-[11px] text-indigo-200/70">Certification Hub</p>
          </div>
          <button className="ml-auto lg:hidden text-white/70 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-3 space-y-0.5 overflow-y-auto h-[calc(100vh-4rem)]">
          {navItems.map((item) => {
            const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}
                className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active ? "bg-white/15 text-white shadow-sm" : "text-indigo-100/70 hover:bg-white/8 hover:text-white",
                )}>
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-14 border-b bg-white/80 backdrop-blur-md flex items-center gap-4 px-4 lg:px-6 shrink-0 sticky top-0 z-20">
          <button className="lg:hidden p-1 rounded-lg hover:bg-slate-100" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5 text-slate-600" />
          </button>

          <form onSubmit={handleSearch} className="relative flex-1 max-w-md hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input className="w-full h-9 rounded-lg border border-slate-200/80 bg-white pl-10 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
              placeholder="Search drives, candidates, vouchers…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </form>

          <div className="flex items-center gap-2 ml-auto">
            {/* ─── Notifications ──────────────────────────── */}
            <div className="relative" ref={notifRef}>
              <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
                onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }}>
                <Bell className="h-5 w-5 text-slate-500" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <p className="font-semibold text-sm text-slate-900">Notifications</p>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead} className="text-[11px] text-primary hover:underline font-medium">Mark all read</button>
                      )}
                      {unreadCount > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">{unreadCount}</span>}
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-400">No notifications</div>
                    ) : notifications.map((n) => {
                      const Icon = ICON_MAP[n.icon] || Bell;
                      return (
                        <Link key={n.id} href={n.href}
                          onClick={() => handleNotifClick(n.id)}
                          className={cn("block px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors", !n.read && "bg-blue-50/30")}>
                          <div className="flex gap-3">
                            <div className={cn("mt-0.5 shrink-0", n.color)}><Icon className="h-4 w-4" /></div>
                            <div className="min-w-0 flex-1">
                              <p className={cn("text-sm", !n.read ? "font-semibold text-slate-900" : "font-medium text-slate-700")}>{n.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{n.description}</p>
                              <p className="text-[11px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                            </div>
                            {!n.read && <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 shrink-0" />}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  <div className="px-4 py-2 border-t border-slate-100 text-center">
                    <Link href="/notifications" onClick={() => setNotificationsOpen(false)} className="text-xs font-medium text-primary hover:underline">View all notifications</Link>
                  </div>
                </div>
              )}
            </div>

            {/* ─── Profile ──────────────────────────────── */}
            <div className="relative" ref={profileRef}>
              <button className="flex items-center gap-2 pl-3 border-l border-slate-200 hover:bg-slate-50 rounded-lg px-2 py-1 transition-colors"
                onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }}>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-900 leading-tight">{user.name}</p>
                  <p className="text-[11px] text-slate-500">{user.role}</p>
                </div>
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                  {user.name.charAt(0)}
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 hidden sm:block" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-indigo-600 text-white flex items-center justify-center text-lg font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", ROLE_BADGE_COLORS[user.role] || "bg-slate-100 text-slate-600")}>{user.role}</span>
                      {user.employeeId && <span className="text-[11px] text-slate-400">{user.employeeId}</span>}
                    </div>
                  </div>
                  <div className="py-1">
                    <Link href="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setProfileOpen(false)}>
                      <User className="h-4 w-4 text-slate-400" /> My Profile
                    </Link>
                    <Link href="/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setProfileOpen(false)}>
                      <Settings className="h-4 w-4 text-slate-400" /> Settings
                    </Link>
                  </div>
                  <div className="border-t border-slate-100 py-1">
                    <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full">
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function ShieldIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
