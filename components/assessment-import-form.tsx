"use client";

import { useState, useRef } from "react";
import { importResultsAction, scheduleAssessmentAction } from "@/lib/actions";
import { Button, Label, Select, Textarea } from "@/components/ui";
import { Upload, FileText } from "lucide-react";

type Drive = { id: string; name: string };

export function AssessmentImportForm({ drives, defaultDriveId }: { drives: Drive[]; defaultDriveId: string }) {
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(reader.result as string);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (formData: FormData) => {
    setPending(true);
    setMessage("");
    try {
      formData.set("csvText", csvText);
      await importResultsAction(formData);
      setMessage("Results imported successfully!");
      setCsvText("");
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setMessage("Error: " + String(e));
    }
    setPending(false);
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="driveId">Drive</Label>
        <Select id="driveId" name="driveId" defaultValue={defaultDriveId}>
          {drives.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
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
          placeholder="EMP101, 85, yes&#10;EMP102, 62, yes&#10;EMP103, 45, no"
        />
      </div>
      {message && (
        <p className={`text-sm ${message.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>{message}</p>
      )}
      <Button type="submit" disabled={pending || !csvText.trim()}>
        {pending ? "Importing..." : "Import Results"}
      </Button>
    </form>
  );
}
