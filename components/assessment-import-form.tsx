"use client";

import { useState, useRef } from "react";
import { importResultsAction } from "@/lib/actions";
import { Button, Label, Textarea } from "@/components/ui";
import { Upload, FileText } from "lucide-react";

type Drive = { id: string; name: string };

export function AssessmentImportForm({ drives, defaultDriveId }: { drives: Drive[]; defaultDriveId: string }) {
  const [csvText, setCsvText] = useState("");
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
    reader.onload = () => setCsvText(reader.result as string);
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
      formData.set("csvText", csvText);
      const result = await importResultsAction(formData);
      setSuccess(`Imported ${result?.count ?? "?"} results! Refreshing...`);
      window.location.href = "/assessments?driveId=" + (result?.driveId ?? "");
    } catch (err: any) {
      setError(err?.message || "Import failed");
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Drive</Label>
        <select name="driveId" defaultValue={defaultDriveId} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
          {drives.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <Label>Upload CSV File</Label>
        <div className="flex items-center gap-3 mt-1">
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" id="csvFile" />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Choose CSV File
          </Button>
          {fileName && (
            <span className="text-sm text-slate-600 flex items-center gap-1">
              <FileText className="w-4 h-4" /> {fileName}
            </span>
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="csvText">Or Paste CSV Data</Label>
        <Textarea
          id="csvText"
          name="csvText"
          rows={6}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={"EMP101, 85, yes\nEMP102, 62, yes\nEMP103, 45, no"}
        />
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      {success && <p className="text-sm font-medium text-green-600">{success}</p>}
      <Button type="submit" disabled={pending || !csvText.trim()}>
        {pending ? "Importing..." : "Import Results"}
      </Button>
    </form>
  );
}
