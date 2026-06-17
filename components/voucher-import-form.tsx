"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { importVouchersAction } from "@/lib/actions";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { Upload, FileText } from "lucide-react";

type Drive = { id: string; name: string; tracks: string[] };

export function VoucherImportForm({ drives, defaultDriveId }: { drives: Drive[]; defaultDriveId: string }) {
  const [codes, setCodes] = useState("");
  const [fileName, setFileName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setCodes(reader.result as string);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (formData: FormData) => {
    setPending(true);
    setMessage("");
    try {
      formData.set("codes", codes);
      await importVouchersAction(formData);
      setMessage("Vouchers imported successfully! Table refreshing...");
      setCodes("");
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      setMessage("Error: " + String(e));
    }
    setPending(false);
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="driveId">Drive</Label>
          <Select id="driveId" name="driveId" defaultValue={defaultDriveId}>
            {drives.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="vendor">Vendor</Label>
          <Input id="vendor" name="vendor" required placeholder="Microsoft" />
        </div>
        <div>
          <Label htmlFor="certificationTrack">Track</Label>
          <Select id="certificationTrack" name="certificationTrack">
            {(drives[0]?.tracks ?? ["Azure Administrator"]).map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="value">Value (USD)</Label>
          <Input id="value" name="value" type="number" defaultValue="200" />
        </div>
        <div>
          <Label htmlFor="expiryDate">Expiry Date</Label>
          <Input id="expiryDate" name="expiryDate" type="date" required />
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
          placeholder="MS-AZ-001&#10;MS-AZ-002&#10;MS-AZ-003"
        />
      </div>
      {message && (
        <p className={`text-sm ${message.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>{message}</p>
      )}
      <Button type="submit" disabled={pending || !codes.trim()}>
        {pending ? "Importing..." : "Import Vouchers"}
      </Button>
    </form>
  );
}
