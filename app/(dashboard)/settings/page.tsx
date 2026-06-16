"use client";

import { useState, useEffect } from "react";
import { Bell, Globe, Save, Check, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    slaAlerts: true,
    language: "en",
    timezone: "IST",
  });

  useEffect(() => {
    const stored = localStorage.getItem("mch_settings");
    if (stored) setSettings(JSON.parse(stored));
  }, []);

  const handleSave = () => {
    localStorage.setItem("mch_settings", JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", checked ? "bg-primary" : "bg-slate-300")}
    >
      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage your notification and regional preferences</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Notifications */}
        <Card className="border-0 card-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-lg bg-primary/10"><Bell className="h-5 w-5 text-primary" /></div>
              <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">Email Notifications</p>
                  <p className="text-xs text-slate-500">Receive email for approvals and SLA breaches</p>
                </div>
                <Toggle checked={settings.emailNotifications} onChange={(v) => setSettings({ ...settings, emailNotifications: v })} />
              </div>
              <div className="flex items-center justify-between py-2 border-t border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">Push Notifications</p>
                  <p className="text-xs text-slate-500">Browser alerts for real-time updates</p>
                </div>
                <Toggle checked={settings.pushNotifications} onChange={(v) => setSettings({ ...settings, pushNotifications: v })} />
              </div>
              <div className="flex items-center justify-between py-2 border-t border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">SLA Breach Alerts</p>
                  <p className="text-xs text-slate-500">Get notified when SLAs are breached</p>
                </div>
                <Toggle checked={settings.slaAlerts} onChange={(v) => setSettings({ ...settings, slaAlerts: v })} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Regional */}
        <Card className="border-0 card-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-lg bg-primary/10"><Globe className="h-5 w-5 text-primary" /></div>
              <h2 className="text-lg font-semibold text-slate-900">Regional</h2>
            </div>
            <div className="space-y-4">
              <div className="py-2">
                <label className="text-sm font-medium text-slate-900">Language</label>
                <select className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" value={settings.language} onChange={(e) => setSettings({ ...settings, language: e.target.value })}>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                </select>
              </div>
              <div className="py-2 border-t border-slate-100">
                <label className="text-sm font-medium text-slate-900">Timezone</label>
                <select className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}>
                  <option value="IST">IST (UTC+5:30)</option>
                  <option value="UTC">UTC</option>
                  <option value="EST">EST (UTC-5)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} className="gap-2">
            {saved ? <><Check className="h-4 w-4" /> Saved!</> : <><Save className="h-4 w-4" /> Save Settings</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
