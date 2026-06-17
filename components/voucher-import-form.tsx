"use client";

import { useState, useRef } from "react";
import { importVouchersAction } from "@/lib/actions";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { Upload, FileText } from "lucide-react";

type Drive = { id: string; name: string; tracks: string[] };

export function VoucherImportForm({ drives, defaultDriveId }: { drives: Drive[]; defaultDriveId: string }) {
  const [codes, setCodes] = useState("");
  const [fileName, setFileName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCodes(reader.result as string);
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      formData.set("codes", codes);
      const result = await importVouchersAction(formData);
      setSuccess(`Imported ${result?.count ?? "?"} vouchers! Refreshing...`);
      window.location.href = "/vouchers?driveId=" + (result?.driveId ?? "");
    } catch (err: any) {
      setError(err?.message || "Import failed");
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Drive</Label>
          <select name="driveId" defaultValue={defaultDriveId} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            {drives.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="vendor">Vendor</Label>
          <Input id="vendor" name="vendor" required placeholder="Microsoft" defaultValue="Microsoft" />
        </div>
        <div>
          <Label htmlFor="certificationTrack">Track</Label>
          <Select id="certificationTrack" name="certificationTrack" defaultValue={drives[0]?.tracks[0] ?? "Azure Administrator"}>
            {(drives[0]?.tracks ?? ["Azure Administrator"]).map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="value">Value (USD)</Label>
          <Input id="value" name="value" type="number" defaultValue="200" />
        </div>
        <div>
          <Label htmlFor="expiryDate">Expiry Date</Label>
          <Input id="expiryDate" name="expiryDate" type="date" required defaultValue="2026-12-31" />
        </div>
      </div>
      <div>
        <Label>Voucher Codes (one per line)</Label>
        <div className="flex items-center gap-3 mt-1 mb-2">
          <input ref={fileRef} type="file" accept=".txt,.csv" onChange={handleFile} className="hidden" id="voucherFile" />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Choose File
          </Button>
          {fileName && (
            <span className="text-sm text-slate-600 flex items-center gap-1">
              <FileText className="w-4 h-4" /> {fileName}
            </span>
          )}
          <a href="/samples/voucher-codes.txt" download className="text-blue-600 underline hover:text-blue-800 text-xs">Download sample</a>
        </div>
        <Textarea
          id="codes"
          name="codes"
          rows={4}
          value={codes}
          onChange={(e) => setCodes(e.target.value)}
          placeholder={"MS-AZ-001\nMS-AZ-002\nMS-AZ-003"}
        />
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      {success && <p className="text-sm font-medium text-green-600">{success}</p>}
      <Button type="submit" disabled={pending || !codes.trim()}>
        {pending ? "Importing..." : "Import Vouchers"}
      </Button>
    </form>
  );
}
