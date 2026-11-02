# SpendWise — Enterprise Team Expense & Approval Management System

SpendWise is a production-grade, enterprise-ready Team Expense & Approval Management System designed to handle complex organizational spending, dynamic multi-tiered approval workflows, strict transaction-safe budget accounting, and idempotent financial reimbursement processing.

---

## 🌟 Key Features & Business Workflows

### 1. Robust Multi-Role RBAC (Role-Based Access Control)
- **Employee**: Create and draft claims, upload receipts, submit expenses, track real-time approval status, withdraw claims, respond to change requests.
- **Manager**: Review pending submissions in a dedicated approval inbox, approve/reject/request changes with mandatory comments, reassign/delegate approval tasks, monitor departmental budgets.
- **Finance**: Audit approved claims, schedule payment disbursement dates, execute electronic or batch reimbursements with transaction guarantees, inspect financial timelines.
- **Admin**: Configure multi-level approval policy tiers, manage users and departments, allocate quarterly budgets, analyze full-system immutable audit logs.

### 2. Configurable Dynamic Approval State Machine
- **Tiered Approval Routing**: Claims are routed to different approval paths depending on amount thresholds (e.g., Level 1: < \$1,000 Manager approval; Level 2: \$1,000–\$5,000 Manager + Dept Head; Level 3: > \$5,000 Manager + Finance Lead).
- **Strict Self-Approval Prevention**: Claim submitters are strictly blocked from approving their own claims, regardless of managerial hierarchy, unless explicit system-wide override is enabled.
- **Sequence Enforcement**: Out-of-order approvals are rejected; steps must be resolved sequentially.
- **Reassignments & Delegations**: Approvers can delegate pending reviews with clear audit tracking.

### 3. Transaction-Safe Budget Accounting (Zero Double-Counting)
- **Three-Tier Accounting**:
  $$\text{Available Budget} = \text{Allocated} - (\text{Committed} + \text{Actual})$$
- **Atomic Reservation**: When a claim is submitted, the budget amount is atomically moved from `Available` into `Committed`.
- **Atomic Transition**: Upon reimbursement completion, the amount moves atomically from `Committed` to `Actual` within a MongoDB multi-document transaction—eliminating double counting.
- **Automatic De-reservation**: When a claim is rejected, withdrawn, or cancelled, reservations are atomically returned to `Available`.
- **Concurrency & Race Condition Handling**: Guarded by atomic conditional updates and MongoDB `WriteConflict` / retry handling.
- **Authorized Overrides**: Configurable emergency over-budget override permissions with full audit logging.

### 4. Idempotent Financial Reimbursement Engine
- **Duplicate Protection**: Reimbursement execution accepts an `Idempotency-Key` header (UUID or client transaction ID). Subsequent duplicate requests return the original record without double disbursements or duplicate ledger postings.
- **Lifecycle Guarantees**: Only fully `APPROVED` claims can be transitioned to `SCHEDULED` and `PAID`.

### 5. Append-Only Audit Logging & Notifications
- Every mutation (submission, step approval, rejection, withdrawal, override, and payout) generates an immutable audit record containing actor ID, IP address, timestamp, action type, and before/after state diff.
- Real-time in-app notification system with read tracking.

---

## 🛠️ Technology Stack

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Backend** | Node.js & Express.js | High-throughput, non-blocking asynchronous REST API |
| **Database** | MongoDB & Mongoose | Document flexibility with WiredTiger ACID multi-document transactions |
| **Validation** | Zod | Strictly typed runtime schema validation on every request |
| **Frontend** | React 18 & Vite | Fast reactive SPA with component isolation and instantaneous HMR |
| **Styling** | Tailwind CSS | Sleek, clean enterprise design system with responsive layouts |
| **Data Viz** | Recharts | Interactive financial analytics and budget utilization charts |
| **Icons** | Lucide React | Modern, accessible iconography |
| **API Docs** | Swagger / OpenAPI 3.0 | Interactive API testing documentation at `/api-docs` |
| **Testing** | Jest, Supertest, `mongodb-memory-server` | 100% automated replica-set integration test coverage |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **MongoDB** running locally on `mongodb://127.0.0.1:27017/spendwise` (or MongoDB Atlas)

### 1. Installation
Clone the repository and install all dependencies:
```bash
# Install root, backend, and frontend dependencies
npm run install:all
```

### 2. Environment Configuration
The backend comes pre-configured with defaults in `backend/.env`. You can customize them or copy from `.env.example`:
```ini
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/spendwise
JWT_SECRET=spendwise_super_secret_jwt_key_2026_enterprise_production
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
CLIENT_URL=http://localhost:5173
```

### 3. Seed Database with Realistic Demo Data
Run the database seed script to populate users across all roles, departments, tiered approval policies, active budgets, claims across every lifecycle state, audit logs, and notifications:
```bash
npm run seed
```

### 4. Start the Application
Run both backend and frontend concurrently in development mode:
```bash
npm run dev
```
- **Frontend SPA**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000/api/v1](http://localhost:5000/api/v1)
- **Interactive Swagger API Docs**: [http://localhost:5000/api-docs](http://localhost:5000/api-docs)

---

## 👥 Demo User Accounts

Use any of the following pre-seeded credentials to test different role capabilities (Password for all accounts: `Password123!`):

| Role | Email | Password | Department | Primary Workflows |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin@spendwise.local` | `Password123!` | Executive | Manage Users, Policies, Budgets, Global Audit Logs |
| **Finance Lead** | `finance@spendwise.local` | `Password123!` | Finance | Payout Queue, Reimbursements, Idempotency, Budget Health |
| **Eng Manager** | `engineering.mgr@spendwise.local` | `Password123!` | Engineering | Approval Inbox, Team Claims, Reassignments, Department Budget |
| **Sales Manager** | `sales.mgr@spendwise.local` | `Password123!` | Sales & Marketing | Approval Inbox, Team Claims, Reassignments |
| **Developer 1** | `dev1@spendwise.local` | `Password123!` | Engineering | Submit Claims, Upload Receipts, Track Workflow, Withdraw |
| **Developer 2** | `dev2@spendwise.local` | `Password123!` | Engineering | Submit Claims, Change Requests Response |
| **Sales Rep** | `salesrep1@spendwise.local` | `Password123!` | Sales & Marketing | Submit Travel / Client Entertainment Claims |

> **Tip**: The login page includes a **One-Click Quick Login** role selector to test all personas instantly without typing credentials!

---

## 🧪 Automated Testing Suite

SpendWise includes comprehensive automated test suites running against an in-memory MongoDB replica set with real multi-document ACID transactions:

```bash
npm test --prefix backend
```

### Test Coverage Highlights:
- **`tests/auth.test.js`**: Authentication, JWT token issuance, cookie handling, role-based route access controls.
- **`tests/expenses.test.js`**: Claim drafting, amount validation, mandatory receipt enforcement, edits, withdrawals, employee data isolation.
- **`tests/approvalEngine.test.js`**: Policy threshold routing, multi-step sequential approvals, strict self-approval prevention, out-of-order rejection.
- **`tests/budgetTransactions.test.js`**: Atomic budget reservations, de-reservations upon rejection, committed-to-actual transition (zero double counting), concurrent spend limit protection.
- **`tests/reimbursements.test.js`**: Payout authorizations, payment status transitions, idempotency key replay verification.
- **`tests/concurrencyAndRollback.test.js`**: ACID transaction rollback verification on simulated failure mid-workflow.

---

## 📁 Project Directory Structure

```text
spendwise project/
├── ARCHITECTURE.md              # Detailed architecture, state machine & transaction specifications
├── README.md                    # Project overview, setup, credentials & documentation
├── package.json                 # Monorepo scripts (dev, test, seed, build)
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── config/              # DB connection, env variables, swagger setup
│   │   ├── controllers/         # REST API controller handlers
│   │   ├── middleware/          # Auth, RBAC, Zod validation, idempotency, rate limiting, error handling
│   │   ├── models/              # Mongoose schemas (13 enterprise models)
│   │   ├── routes/              # Express API routers under /api/v1
│   │   ├── schemas/             # Zod validation schemas
│   │   ├── scripts/             # Database seeder (seed.js)
│   │   ├── services/            # Core business logic (State machine, budgets, audit, notifications)
│   │   ├── app.js               # Express app configuration
│   │   └── server.js            # Server bootstrap
│   └── tests/                   # 6 Jest test suites (27 passing tests)
└── frontend/
    ├── package.json
    ├── vite.config.js           # Vite dev server with proxy to backend :5000
    ├── tailwind.config.js       # Modern design system configuration
    ├── index.html
    └── src/
        ├── api/                 # Axios HTTP client with cookie credentials
        ├── components/          # Reusable UI widgets (DataTable, Timeline, StatusBadge, Modals)
        ├── context/             # AuthContext & NotificationContext
        ├── pages/               # 14 feature pages
        ├── App.jsx              # Client-side router with role-guarded routes
        └── main.jsx             # React entry point
```

---

## 🛡️ Security Best Practices

1. **HttpOnly Cookie Authentication**: JWT tokens are stored in secure, HttpOnly, SameSite cookies to protect against XSS token theft, while supporting Bearer authorization headers for API clients.
2. **Strict Zod Input Validation**: Every request payload, query string, and parameter is validated against strict schemas before controller execution.
3. **No Blind Trust / Data Isolation**: Employees cannot view claims or financial data belonging to other employees or unauthorized departments.
4. **Rate Limiting**: Protects sensitive authentication routes from brute force attacks.
5. **Safe File Uploads**: Uploads are restricted to approved MIME types (PNG, JPEG, WEBP, PDF) with a 5MB size ceiling and stored safely.

---

## 📄 License

MIT © SpendWise Inc. Built for enterprise financial excellence.
