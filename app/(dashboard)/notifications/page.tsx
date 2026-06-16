"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardCheck, Ticket, CheckCircle, Mail, ArrowLeft, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ElementType> = {
  AlertTriangle, ClipboardCheck, Ticket, CheckCircle, Mail, Bell,
};

type Notification = {
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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleClick = async (id: string) => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAll = async () => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications</h1>
          <p className="text-slate-500 mt-1 text-sm">Stay updated on drives, approvals, and alerts</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAll} className="text-sm text-primary hover:underline font-medium">Mark all as read</button>
        )}
        {unreadCount > 0 && (
          <span className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-full font-medium">{unreadCount} unread</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="p-8 text-center"><Bell className="h-12 w-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No notifications</p></Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const Icon = ICON_MAP[n.icon] || Bell;
            return (
              <Link key={n.id} href={n.href} onClick={() => handleClick(n.id)}>
                <Card className={cn("hover:shadow-md transition-all cursor-pointer", !n.read && "border-l-4 border-l-primary")}>
                  <CardContent className="p-4 flex items-start gap-4">
                    <div className={cn("p-2.5 rounded-xl shrink-0", n.bgColor)}>
                      <Icon className={cn("h-5 w-5", n.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm", !n.read ? "font-bold text-slate-900" : "font-semibold text-slate-700")}>{n.title}</p>
                        {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-sm text-slate-500 mt-1 leading-relaxed">{n.description}</p>
                      <p className="text-xs text-slate-400 mt-2">{new Date(n.createdAt).toLocaleDateString()}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
