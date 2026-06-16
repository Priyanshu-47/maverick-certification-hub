# Maverick Certification Hub — Architecture

## Overview

Single Next.js 14 monolith with App Router, consolidated service layer, and PostgreSQL via Prisma. Designed for demo-ready local development with clean adapter boundaries for enterprise integrations.

## Folder Structure

```
/app
  page.tsx                 # Landing page
  login/page.tsx           # Mock role selection
  register/page.tsx        # Candidate registration (public)
  status/page.tsx          # Status lookup (public)
  voucher-access/          # Secure token delivery (public)
  (dashboard)/             # Authenticated app shell
    layout.tsx             # Auth guard + AppShell
    dashboard/page.tsx
    drives/...
    registrations/...
    eligibility/page.tsx
    approvals/page.tsx
    assessments/page.tsx
    vouchers/page.tsx
    communications/page.tsx
    reports/page.tsx
    exceptions/page.tsx
    audit/page.tsx
    automation/page.tsx
    settings/page.tsx

/components
  ui.tsx                   # Button, Card, Input, Table, Dialog, Badge
  shared.tsx               # StatusBadge, MetricCard, DataTable, Timeline, etc.
  app-shell.tsx            # Sidebar navigation + top bar
  charts.tsx               # Recharts visualizations

/lib
  db.ts                    # Prisma client singleton
  auth.ts                  # Cookie session + IdentityProvider adapter
  security.ts              # AES encryption, hashing, RBAC helpers
  audit.ts                 # Append-only audit writer
  adapters.ts              # Email, SharePoint, HRIS, LMS, BI mocks
  services.ts              # All business logic (single consolidated file)
  actions.ts               # Server actions (API boundary)
  validators.ts            # Zod schemas
  constants.ts             # Nav, roles, repo folders
  utils.ts                 # Formatting, CSV export, masking

/prisma
  schema.prisma            # 14 entities + enums
  seed.ts                  # Demo data

/types
  index.ts                 # Shared TypeScript types
```

## Data Model

Core entities: User, Drive, RepositoryFolder, Registration, EligibilityDecision, Approval, AssessmentResult, Voucher, VoucherDeliveryToken, Communication, AutomationRun, AuditLog, ExceptionRecord, Setting.

Key constraints:
- `@@unique([driveId, employeeId])` on Registration
- `codeHash` unique on Voucher
- One active issued voucher per registration (enforced in transaction)

## Request Flow

```
UI (Server Component / Client)
  → Server Action (lib/actions.ts)
  → Service (lib/services.ts)
  → Prisma + Audit + Adapters
```

## RBAC Roles

| Role | Capabilities |
|------|-------------|
| Admin | Full access |
| Coordinator | Drives, registrations, assessments, communications |
| Approver | Approvals, read-only drives |
| ReadOnly | Dashboards, reports, audit |
| Candidate | Own registration, status lookup, voucher access |

## Integration Adapters

All in `lib/adapters.ts` with mock implementations:

- `IdentityProvider` → Microsoft Entra ID
- `EmailProvider` → Microsoft Graph
- `DocumentRepositoryProvider` → SharePoint
- `HRISProvider`, `LMSProvider`, `VoucherVendorProvider`, `BIExportProvider`

## Security

- Voucher encryption: AES-256-GCM with scrypt-derived key
- Token delivery: random token → SHA-256 hash stored
- Audit: every critical action logged with actor, before/after JSON
- Env-based secrets only (see `.env.example`)
