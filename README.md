<div align="center">
	<h1>Digital Evidence Chain Management System (DECMS)</h1>
	<p><strong>Backend & Database Layer</strong></p>
	<p>Express + MySQL implementation featuring role-based workflows, evidence custody tracking, reports, and analytics.</p>
	<p>
		Backend Repo Root • See detailed service README in <code>decms_node/README.md</code><br/>
		Frontend: <a href="https://github.com/Praneeth-2602/evidence-chain-ui" target="_blank">evidence-chain-ui</a>
	</p>
</div>

---

## 📦 Contents

| Path | Description |
|------|-------------|
| `decms_node/` | Node.js Express application (API + business logic) |
| `decms_node/sql/database.sql` | Full schema (tables, FKs, trigger, view, stored procedure) |
| `decms_node/scripts/` | Seeding, historical data, index creation, test helpers |

## 🚀 Quick Start (Backend)

```bash
cd backend/decms_node
cp .env.example .env   # fill DB creds + JWT_SECRET
npm install
npm run seed           # base seed
npm run seed-history   # optional: historical transfers
npm run db:add-indexes # optional: ensure composite indexes
npm run dev            # start API (nodemon)
```

Backend detailed usage & endpoints: see `decms_node/README.md`.

## 🧠 Implemented DBMS Concepts

- Normalized relational schema with foreign keys & cascade rules
- Trigger (`trg_after_transfer`) for custody update + access logging
- View (`vw_case_overview`) for reporting/summary queries
- Stored procedure (`sp_generate_analysis_summary`) example analytics aggregation
- Transactional workflows (evidence transfers, seeding)
- Composite / lookup indexes added via automation script

## 🔐 Roles (Conceptual)

| Role | Highlights |
|------|------------|
| Admin | Immediate transfers, approve/reject requests, close cases, analytics/logs |
| Lab Staff | Update evidence status to Under Analysis, upload lab reports |
| Investigator | View assigned cases & related evidence |
| Public (demo) | Limited create/list via `/public` endpoints |

## 🛠 Scripts Summary

| Script | Purpose |
|--------|---------|
| `npm run seed` | Base user/data seed |
| `npm run seed-history` | Generate historical transfer records |
| `npm run db:add-indexes` | Ensure indexes for performance |

## 🔄 Public vs Protected Endpoints

Public endpoints (e.g. `/api/cases/public`, `/api/transfers/public`, `/api/reports/public`) expose privacy-trimmed datasets or allow request-style creation for demos. Protected endpoints require JWT for full CRUD and administrative actions.

## 📥 File Handling

Reports upload store a server-side filename; listing returns `file_url` for direct download from `/uploads/<filename>`.

## 🧪 Testing & Next Steps

Planned enhancements:
1. Formal validation layer (jsonschema / zod)
2. Swagger / OpenAPI docs
3. Unit & integration tests + CI pipeline
4. Stronger RBAC enforcement & audit surfacing
5. Optional hash/integrity checks for evidence/report files

## 🤝 Contributing

Open issues/PRs welcomed. Use conventional commit prefixes (`feat:`, `fix:`, `docs:`). Keep changes scoped.

## 📜 License

MIT (if not present, add a `LICENSE` file).

---

See `decms_node/README.md` for deeper API documentation.
