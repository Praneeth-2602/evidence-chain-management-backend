# DECMS Node Backend (Express + MySQL)

This folder contains a production-oriented scaffold for the Digital Evidence Chain Management System (DECMS) backend.

Quick start
1. Copy `.env.example` to `.env` and fill credentials.
2. Create the database from `sql/database.sql` (or run migrations if you adapt ORM).
3. Install deps:

```bash
cd backend/decms_node
npm install
```

4. Seed initial admin user:

```bash
npm run seed
```

5. Start dev server:

```bash
npm run dev
```

API notes
- Auth: `POST /api/auth/register`, `POST /api/auth/login` (returns JWT)
- Cases: `GET /api/cases`, `POST /api/cases`, `GET /api/cases/:id`, `PUT /api/cases/:id`
- Evidence: `POST /api/evidence` (multipart/form-data; field `file`), `GET /api/evidence/:id`, `GET /api/evidence/case/:caseId`
- Transfers: `POST /api/transfers`, `GET /api/transfers/:evidenceId`
- Reports: `POST /api/reports` (multipart file `report_file`), `GET /api/reports/:evidenceId`
- Analytics: `GET /api/analytics/cases`, `GET /api/analytics/evidence`, `GET /api/analytics/transfers`

DBMS features included in `sql/database.sql`:
- Normalized schema for users, cases, evidence, transfers, reports, storage, logs, notifications.
- Trigger `trg_after_transfer` to auto-log transfers into `access_logs` and update custodian.
- Stored procedure `sp_generate_analysis_summary(p_evidence_id)` to aggregate findings.
- View `vw_case_overview` for quick case summaries.

Security
- Passwords hashed with `bcrypt`.
- JWT-based auth; change `JWT_SECRET` in `.env`.
- Helmet used for secure HTTP headers.

Next steps you may want me to implement for you:
- Add full input validation (jsonschema) for payloads.
- Create Postman collection / Swagger docs.
- Add tests and CI config.
- Add RBAC seeding and more robust role checks.
