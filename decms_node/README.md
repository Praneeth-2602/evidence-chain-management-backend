# DECMS Node Backend (Express + MySQL)

Production-ready backend for the Digital Evidence Chain Management System (DECMS).

Backend Repo: https://github.com/Praneeth-2602/evidence-chain-management-backend
Frontend Repo: https://github.com/Praneeth-2602/evidence-chain-ui

## Quick start
1. Copy `.env.example` to `.env` and fill DB/JWT credentials.
2. Create the database from `sql/database.sql` (or run migrations if you adopt an ORM).
3. Install deps:

```bash
cd backend/decms_node
npm install
```

4. Seed initial data:

```bash
npm run seed            # base seed (admin user, minimal data)
npm run seed-history    # optional: historical transfers for analytics
npm run db:add-indexes  # optional: ensure helpful composite indexes
```

5. Start dev server:

```bash
npm run dev
```

## API overview

Auth
- `POST /api/auth/register`
- `POST /api/auth/login` → returns JWT

Cases
- Protected: `GET /api/cases`, `POST /api/cases`, `GET /api/cases/:id`, `PUT /api/cases/:id`
- Public (privacy-friendly): `GET /api/cases/public` → returns `case_id`, `case_title`, `case_number`, `status`, `created_at`, `assigned_to_name`

Evidence
- Protected: `POST /api/evidence` (multipart, field `file`), `GET /api/evidence/:id`, `GET /api/evidence/case/:caseId`

Transfers
- Protected (Admin immediate): `POST /api/transfers`
- Protected (Admin): Approve/Reject endpoints
- Public (request flow): `POST /api/transfers/public`

Reports
- Protected upload: `POST /api/reports` (multipart, field `report_file`)
- Public list: `GET /api/reports/public` (returns `file_url` when available)
- By Evidence (protected): `GET /api/reports/:evidenceId`

Analytics (protected)
- `GET /api/analytics/cases`, `GET /api/analytics/evidence`, `GET /api/analytics/transfers`

### Report downloads
Uploaded files are saved server-side. Public listings include a `file_url` (e.g., `/uploads/<filename>`). Static hosting for uploads is configured in `server.js` so the frontend can link to actual downloads.

## DBMS features (see `sql/database.sql`)
- Normalized schema for users, cases, evidence, transfers, reports, storage, logs, notifications
- Trigger `trg_after_transfer` to log transfers in `access_logs` and update custodian
- Stored procedure `sp_generate_analysis_summary(p_evidence_id)` to aggregate findings
- View `vw_case_overview` for quick case summaries
- Composite and lookup indexes via `scripts/add_indexes.js`

## Security
- Passwords hashed with `bcrypt`
- JWT-based auth; set a strong `JWT_SECRET` in `.env`
- Helmet for secure HTTP headers; basic CORS (harden for production)

## Roles (reference)
- Admin: Approve/Reject transfers, immediate transfers, close cases, view analytics/logs
- Lab Staff: Upload reports, mark evidence Under Analysis (if custodian)
- Investigator: View/browse evidence for assigned cases
- Public: Limited `/public` endpoints for demo seeding and basic listings

## Useful scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start dev server (nodemon) |
| `npm run seed` | Seed base data (admin, essentials) |
| `npm run seed-history` | Seed historical transfers for analytics |
| `npm run db:add-indexes` | Ensure recommended composite/lookup indexes |

## Next steps
- Add full payload validation (jsonschema / zod)
- Publish Postman collection / Swagger docs
- Add tests and CI
- Expand RBAC seeding and granular checks
