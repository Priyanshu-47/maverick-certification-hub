import { Suspense } from "react";
import VoucherAccessClient from "./client";

export default function VoucherAccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <VoucherAccessClient />
    </Suspense>
  );
}
