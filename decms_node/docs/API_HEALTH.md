# Health and Version Endpoints

These endpoints help operations and integration checks.

## GET /health

Returns `{ ok: true }` with a DB ping result when healthy.

Example response:

```json
{ "ok": true, "db": { "ok": 1 } }
```

On failure, returns status 500 and an error string.

## GET /version

Returns name, version, and description from `package.json`:

```json
{ "name": "decms_node", "version": "1.0.0", "description": "..." }
```