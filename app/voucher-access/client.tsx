"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Shield, Eye } from "lucide-react";
import { VoucherMask } from "@/components/shared";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { revealVoucherPublicAction, accessVoucherTokenAction } from "@/lib/actions";

export default function VoucherAccessClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [voucher, setVoucher] = useState<{ id: string; maskedCode: string; vendor: string; certificationTrack: string; status: string } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [fullCode, setFullCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadVoucher = async () => {
    if (!token) { setError("No token provided"); return; }
    setLoading(true);
    const result = await accessVoucherTokenAction(token);
    if (result.success && result.voucher) {
      setVoucher(result.voucher);
      setError("");
    } else {
      setError("Invalid or expired token");
    }
    setLoading(false);
  };

  const revealCode = async () => {
    if (!voucher) return;
    const result = await revealVoucherPublicAction(voucher.id);
    if (result.success && result.code) {
      setFullCode(result.code);
      setRevealed(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Shield className="h-10 w-10 text-primary mx-auto mb-2" />
          <CardTitle>Secure Voucher Access</CardTitle>
          <p className="text-sm text-slate-500">Tokenized secure delivery</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!voucher ? (
            <>
              {token ? (
                <Button onClick={loadVoucher} disabled={loading} className="w-full">
                  {loading ? "Validating…" : "Access Voucher"}
                </Button>
              ) : (
                <p className="text-sm text-slate-500 text-center">Use the link from your voucher email.</p>
              )}
              {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><span className="text-slate-500">Vendor:</span> {voucher.vendor}</p>
                <p><span className="text-slate-500">Track:</span> {voucher.certificationTrack}</p>
              </div>
              <VoucherMask masked={voucher.maskedCode} revealed={revealed} fullCode={fullCode} />
              {!revealed && (
                <Button onClick={revealCode} className="w-full" variant="outline">
                  <Eye className="h-4 w-4" /> Reveal Code
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
