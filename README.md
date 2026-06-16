# Maverick Certification Hub

Enterprise web application for automating MAP Certification Drives — from registration through eligibility, approvals, assessments, secure voucher distribution, and executive reporting.

**Project root:** `C:\Users\PLodha\source\maverick-certification-hub` (recommended — avoids OneDrive file-lock issues). A synced copy may exist under your Downloads `Design` folder.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| UI | Custom shadcn-style components, Radix UI primitives, Lucide icons |
| Charts | Recharts |
| Forms | React Hook Form + Zod (server validation) |
| Backend | Next.js Server Actions + service layer |
| Database | PostgreSQL + Prisma ORM |
| Auth | Mock provider (Microsoft Entra ID ready) |

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ (local or Docker)
- npm or pnpm

## Setup

### 1. Clone and install

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Generate encryption keys:

```bash
openssl rand -hex 32   # ENCRYPTION_KEY
openssl rand -hex 32   # TOKEN_SECRET
```

Update `DATABASE_URL` for your PostgreSQL instance.

### 3. Database

```bash
npm run db:setup
```

This runs `prisma db push` and seeds demo data.

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo Users

| Email | Role | Use Case |
|-------|------|----------|
| `admin@maverick.local` | Admin | Full access, drive creation |
| `coordinator@maverick.local` | Coordinator | Registrations, assessments |
| `approver@maverick.local` | Approver | Approval inbox |
| `readonly@maverick.local` | ReadOnly | Dashboards and reports |
| `candidate@maverick.local` | Candidate | Registration and status |

Sign in at `/login` — no password required (mock auth).

## Key Workflows

### Create a Drive
1. Sign in as Admin → **Drives** → **Create Drive**
2. Repository folders (`01_Registrations`, etc.) are provisioned automatically
3. Publish → Activate to open registration

### Candidate Registration
1. Go to `/register` or use drive registration link
2. Acknowledgement communication is generated immediately (5-min SLA)
3. Auto-acknowledge updates status to Acknowledged

### Eligibility
1. **Eligibility** queue → **Evaluate** (or bulk from drive detail)
2. Rules: tenure ≥90d, training complete, attempts <2, budget, manager approval
3. Criteria JSON stored with pass/fail breakdown

### Approvals
1. **Approvals** inbox for pending manager/L&D approvals
2. Approve/reject with SLA tracking and escalation

### Assessments
1. **Assessments** → import CSV (`employeeId, score, attended`)
2. Pass threshold from drive config; status auto-updates

### Voucher Allocation
1. Import vouchers (encrypted at rest, masked in UI)
2. Allocate to passed candidates — transactional, duplicate-safe
3. Secure delivery token link emailed to candidate
4. `/voucher-access?token=...` for reveal flow with audit

### Automation
1. **Automation** → **Run Daily Automation**
2. T-30/T-7/T-3 reminders, expiry flags, SLA breaches

## Architecture

```
app/                    # Next.js pages (App Router)
  (dashboard)/          # Authenticated shell
  register/             # Public registration
  status/               # Status lookup
  voucher-access/       # Secure voucher delivery
components/
  ui.tsx                # Base UI primitives
  shared.tsx            # StatusBadge, MetricCard, DataTable, etc.
  app-shell.tsx         # Sidebar + top bar
  charts.tsx            # Recharts wrappers
lib/
  services.ts           # All business logic (consolidated)
   actions.ts            # Server actions
   auth.ts               # Mock session + IdentityProvider adapter
   security.ts           # Encryption, hashing, RBAC
   adapters.ts           # Email, SharePoint, HRIS, LMS mocks
   audit.ts              # Append-only audit logging
   ai.ts                 # Azure OpenAI client + cost tracking
   policy-compiler.ts    # NL Policy Compiler (GenAI)
   voucher-intelligence.ts # Voucher scoring engine (GenAI)
   readiness-coach.ts    # AI Pre-Voucher Readiness Coach
   demand-intelligence.ts # Certification Demand Intelligence
   agents.ts             # Multi-Agent system (5 specialist agents, parallel orchestration)
   passport.ts           # Certification Evidence Passport
   roi.ts                # ROI Command Center
   rag.ts                # RAG document intelligence (skill extraction)
   chat.ts               # Natural language chat interface
   ab-testing.ts         # A/B policy testing + versioning
   cost-optimization.ts  # Semantic cache, batch workflows, token budget
   safety.ts             # PII redaction, content safety, kill switch
prisma/
  schema.prisma         # Full data model (21 entities)
  seed.ts               # Demo data
```

## Security Notes

- Voucher codes encrypted with AES-256-GCM (`ENCRYPTION_KEY`)
- Unique `codeHash` prevents duplicate voucher import
- One active issued voucher per registration (transactional allocation)
- Delivery tokens stored as SHA-256 hashes with expiry
- Full code reveal audited; production should add step-up auth
- Never commit `.env` or real secrets

## AI Features (GenAI-Powered)

### NL Policy Compiler (`lib/policy-compiler.ts`)
L&D managers type eligibility rules in natural English. The AI compiles them into executable, versioned rules with a visual glass-box reasoning tree for every decision.
- **Route:** `/copilot` → NL Policy Compiler tab
- **Fallback:** Rule-based extraction when Azure OpenAI is not configured

### Voucher Intelligence Engine (`lib/voucher-intelligence.ts`)
Scores every voucher allocation request on Likelihood of Productive Use (0-100). Blocks leakage before it happens, explains decisions in plain English, and auto-reclaims unused vouchers.
- **Route:** Server actions → `scoreVoucherAction`
- **Impact:** Voucher leakage ~22% → <3%

### AI Pre-Voucher Readiness Coach (`lib/readiness-coach.ts`)
Before releasing a voucher, checks candidate readiness: generates readiness score, weak topic areas, personalized preparation plan, AI-generated mock questions, and Issue/Hold/Reattempt recommendation.
- **Route:** Server actions → `assessReadinessAction`

### Certification Demand Intelligence (`lib/demand-intelligence.ts`)
Analyzes project pipelines, RFPs, and skill requirements to recommend the right certification drives. Example: "Healthcare project requires 40 AI-certified Mavericks → Recommend Azure AI-900."
- **Route:** `/copilot` → Demand Intelligence tab

### Multi-Agent System (`lib/agents.ts`)
Five specialist agents collaborate autonomously via **`Promise.all` parallel execution**:
- **Drive Agent** — lifecycle management, risk scoring
- **Compliance Agent** — eligibility audit with evidence
- **Voucher Agent** — allocation & leakage prevention
- **Comms Agent** — SLA monitoring with escalation suggestions
- **ROI Agent** — profitability analysis with data-backed insights
- **Route:** `/copilot` → Agents tab (click "Run All 5 Agents (Parallel)")

### Certification Evidence Passport (`lib/passport.ts`)
Audit-ready certification profile: registration, eligibility path, training status, assessment result, voucher status, evidence links, AI-generated summary, and recommended next action.
- **Route:** Server actions → `generatePassportAction`

### ROI Command Center (`lib/roi.ts`)
Supply-chain trace: L&D budget → candidate → certification outcome → project deployment → billable revenue. Profitability heatmaps and skill-gap forecasts.
- **Route:** `/roi`
- **UI:** Formatted cards with color-coded ROI scores, BU profitability bars, top track badges

### RAG Document Intelligence (`lib/rag.ts`)
Upload RFPs, SOWs, job descriptions. AI extracts certification requirements — skills, priority levels, timelines, candidate counts — and recommends certification tracks.
- **Route:** `/copilot` → Document RAG tab
- **Supported formats:** `.txt`, `.md`, `.csv`, `.json`
- **Fallback:** Pattern matching extracts 18+ skill types (Azure, AWS, Python, ML, etc.) when AI is unavailable

### AI Chat Interface (`lib/chat.ts`)
Natural language query engine — ask about drives, candidates, vouchers, metrics, approvals. Gathers relevant context from the database and responds in natural language.
- **Route:** `/copilot` → Chat tab
- **Example queries:** "How many active drives?", "What's the pass rate?", "Show pending approvals"
- **Voice input:** Click mic button (Web Speech API, Chrome/Edge)

### A/B Policy Testing (`lib/ab-testing.ts`)
Version policies, run head-to-head comparisons, and see exactly which candidates differ between two policy versions. Shows pass rates, confidence, and per-candidate results.
- **Route:** `/copilot` → A/B Test tab
- **Usage:** Compile at least 2 policies in NL Compiler, then compare in A/B Test tab

### Live NL Policy Evaluation
Evaluate any candidate against compiled policy rules in real-time. Shows reasoning tree with pass/fail per criterion — fully transparent glass-box decisions.
- **Route:** `liveEvaluateAction` server action
- **Usage:** After compiling a policy, candidates are evaluated against the latest version

### Voice Copilot
Web Speech API integration for hands-free interaction — click mic, speak your query, and the chat responds.
- **Browser support:** Chrome, Edge (webkitSpeechRecognition)
- **Fallback:** Falls back to typing on unsupported browsers

### Cost Optimization (`lib/cost-optimization.ts`)
- Semantic caching (5-min TTL) to avoid duplicate AI calls
- Batch workflow manager with rate limiting
- Token budget manager (daily limit tracking)

### Safety Controls (`lib/safety.ts`)
- PII detection and redaction
- Content safety checks
- Kill switch per agent type
- Risk-tiered autonomy (auto/notify/approve)

### Configuration
AI is configured via AWS Bedrock. Add to `.env`:
```
AWS_BEDROCK_ACCESS_KEY=your-access-key
AWS_BEDROCK_SECRET_KEY=your-secret-key
AWS_BEDROCK_REGION=ap-southeast-2
AWS_BEDROCK_MODEL=amazon.nova-pro-v1:0
```
The system auto-detects provider: AWS Bedrock config → Bedrock, `sk-ant-` prefix → Claude, Azure config → OpenAI, otherwise → rule-based fallback. Bedrock uses Amazon Nova Pro via the Converse API for reliable JSON outputs.

## Future Integrations

Adapter interfaces in `lib/adapters.ts`:

- **Microsoft Entra ID** — replace `MockIdentityProvider`
- **Microsoft Graph** — replace `MockEmailProvider`
- **SharePoint** — replace `MockDocumentRepositoryProvider`
- **Power BI** — `BIExportProvider`
- **Azure Key Vault** — key management
- **HRIS / LMS / Voucher vendors** — mock providers ready to swap

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed demo data |
| `npm run db:setup` | Push + seed |

## Seed Data Summary

- 5 users (Admin, Coordinator, Approver, ReadOnly, Candidate)
- 3 drives (Active, Draft, Closed)
- 61+ registrations across statuses
- 50+ vouchers (encrypted)
- 25+ audit logs, 20+ communications, 8 exceptions
- 8 agent activity entries (demo-ready Agent Activity Feed)

## License

Internal enterprise use — Maverick Certification Hub.

---

## Demo Flow for Hackathon Judges

**Login:** `admin@maverick.local` at `/login`

### 1. Dashboard (`/dashboard`)
View real-time AI metrics: total drives, voucher leakage, active candidates, ROI score.

### 2. Copilot — Agents Tab (`/copilot`)
Click **"Run All 5 Agents (Parallel)"** → Watch 5 agents execute concurrently with different risk levels. Approve/reject pending actions.

### 3. Copilot — NL Compiler Tab
Type: *"Tenure > 90 days, Python training done, no more than 1 failed attempt, BU = Tech"*
→ See compiled rules in a formatted table with field, operator, value.

### 4. Copilot — Document RAG Tab
Upload a sample RFP `.txt` file → AI extracts skills (Azure AI, ML, Python), priorities, timelines, and candidate counts.

### 5. Copilot — Chat Tab
Ask: "How many active drives are there?" or "What's the pass rate?" or use the **mic button** for voice input.

### 6. Copilot — A/B Test Tab
Compare two policy versions → See pass rate differences and which candidates are affected (yellow-highlighted rows).

### 7. ROI Center (`/roi`)
View profitability by business unit, top certification tracks, and ROI scores with color-coded cards.
