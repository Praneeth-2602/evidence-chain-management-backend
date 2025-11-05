#!/usr/bin/env python3
"""
Seed script to post mock data to the local DECMS Node API.

Usage:
  python post_mock_data.py [--base-url BASE_URL] [--dry-run]

Default BASE_URL: http://localhost:5000

This script posts users, cases, evidence, transfers and reports using the public POST endpoints
eg: /api/auth/register, /api/cases/public, /api/evidence/public, /api/transfers/public, /api/reports/public

It maps the logical mock IDs (CS-001, EV-001, etc) to the numeric IDs returned by the database.
"""
import requests
import argparse
import sys


MOCK_USERS = [
    {"name": "Admin User", "email": "admin@example.com", "password": "password123", "role": "Admin"},
    {"name": "John Doe", "email": "john.doe@example.com", "password": "password123", "role": "Investigator"},
    {"name": "Jane Smith", "email": "jane.smith@example.com", "password": "password123", "role": "Investigator"},
    {"name": "Mike Johnson", "email": "mike.johnson@example.com", "password": "password123", "role": "Investigator"},
    {"name": "Sarah Williams", "email": "sarah.williams@example.com", "password": "password123", "role": "Investigator"},
    {"name": "Lab Staff A", "email": "labstaff.a@example.com", "password": "password123", "role": "Lab Staff"},
    {"name": "Lab Staff B", "email": "labstaff.b@example.com", "password": "password123", "role": "Lab Staff"},
]

MOCK_CASES = [
  { "id": 'CS-001', "title": 'Ransomware Attack Investigation', "assignedTo": 'John Doe', "status": 'Open', "createdOn": '2025-01-15' },
  { "id": 'CS-002', "title": 'Data Breach Analysis', "assignedTo": 'Jane Smith', "status": 'In Progress', "createdOn": '2025-01-20' },
  { "id": 'CS-003', "title": 'Phishing Campaign Trace', "assignedTo": 'Mike Johnson', "status": 'Open', "createdOn": '2025-02-01' },
  { "id": 'CS-004', "title": 'Insider Threat Investigation', "assignedTo": 'Sarah Williams', "status": 'Closed', "createdOn": '2024-12-10' },
  { "id": 'CS-005', "title": 'Malware Distribution Network', "assignedTo": 'John Doe', "status": 'In Progress', "createdOn": '2025-01-28' },
]

MOCK_EVIDENCE = [
  { "id": 'EV-001', "caseId": 'CS-001', "type": 'Hard Drive', "status": 'Analyzed', "collectedBy": 'John Doe', "storedAt": 'Lab A', "date": '2025-01-16' },
  { "id": 'EV-002', "caseId": 'CS-001', "type": 'Network Logs', "status": 'Pending', "collectedBy": 'Jane Smith', "storedAt": 'Server Room', "date": '2025-01-17' },
  { "id": 'EV-003', "caseId": 'CS-002', "type": 'Email Archive', "status": 'Analyzed', "collectedBy": 'Mike Johnson', "storedAt": 'Lab B', "date": '2025-01-21' },
  { "id": 'EV-004', "caseId": 'CS-003', "type": 'Mobile Device', "status": 'In Storage', "collectedBy": 'Sarah Williams', "storedAt": 'Evidence Locker', "date": '2025-02-02' },
  { "id": 'EV-005', "caseId": 'CS-005', "type": 'Memory Dump', "status": 'Pending', "collectedBy": 'John Doe', "storedAt": 'Lab A', "date": '2025-01-29' },
]

MOCK_TRANSFERS = [
  { "id": 'TR-001', "evidenceId": 'EV-001', "fromUser": 'John Doe', "toUser": 'Lab Staff A', "date": '2025-01-18', "remarks": 'For forensic analysis' },
  { "id": 'TR-002', "evidenceId": 'EV-003', "fromUser": 'Jane Smith', "toUser": 'Lab Staff B', "date": '2025-01-22', "remarks": 'Email extraction needed' },
  { "id": 'TR-003', "evidenceId": 'EV-002', "fromUser": 'Mike Johnson', "toUser": 'Jane Smith', "date": '2025-01-19', "remarks": 'Secondary review' },
]

MOCK_REPORTS = [
  { "id": 'RP-001', "evidenceId": 'EV-001', "analyst": 'Lab Staff A', "date": '2025-01-20', "title": 'Forensic Analysis Report', "status": 'Completed', "findings": 'Disk image and file carving completed. Key artifacts recovered.' },
  { "id": 'RP-002', "evidenceId": 'EV-003', "analyst": 'Lab Staff B', "date": '2025-01-25', "title": 'Email Analysis Report', "status": 'Completed', "findings": 'Email headers indicate exfiltration timeline.' },
  { "id": 'RP-003', "evidenceId": 'EV-004', "analyst": 'Lab Staff A', "date": '2025-02-03', "title": 'Mobile Device Extraction', "status": 'In Progress', "findings": 'Extraction in progress.' },
]


def post(base, path, payload, dry_run=False):
    url = base.rstrip('/') + path
    print(f"POST {url} -> {payload}")
    if dry_run:
        return {"status_code": 0, "json": lambda: {}}
    r = requests.post(url, json=payload)
    try:
        data = r.json()
    except Exception:
        data = r.text
    print(f"  -> {r.status_code} {data}")
    return {"status_code": r.status_code, "json": lambda: data}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://localhost:5000', help='Base URL of API (default http://localhost:5000)')
    parser.add_argument('--dry-run', action='store_true', help='Do not actually POST, just print what would be sent')
    args = parser.parse_args()

    base = args.base_url
    dry = args.dry_run

    # 1) create users
    email_by_name = {}
    print('\n== Creating users ==')
    for u in MOCK_USERS:
        payload = {"name": u['name'], "email": u['email'], "password": u['password'], "role": u['role']}
        res = post(base, '/api/auth/register', payload, dry_run=dry)
        if res['status_code'] in (201, 200, 0):
            email_by_name[u['name']] = u['email']
        else:
            print(f"Warning: creating user {u['email']} returned {res['status_code']}")

    # 2) create cases
    print('\n== Creating cases ==')
    case_id_map = {}  # map mock id -> numeric id
    for c in MOCK_CASES:
        payload = {"case_title": c['title'], "description": c.get('title'), "assigned_to_name": c['assignedTo']}
        res = post(base, '/api/cases/public', payload, dry_run=dry)
        data = res['json']()
        if res['status_code'] in (201, 200, 0):
            # expect { case_id: numeric }
            cid = None
            if isinstance(data, dict) and data.get('case_id'):
                cid = data['case_id']
            elif isinstance(data, dict) and data.get('id'):
                cid = data['id']
            else:
                # sometimes API returns the created row; attempt to find case by title
                # we'll leave cid as None and try to print message
                pass
            case_id_map[c['id']] = cid
        else:
            print(f"Failed to create case {c['title']} -> {res['status_code']}")

    # 3) create evidence
    print('\n== Creating evidence ==')
    evidence_id_map = {}
    for e in MOCK_EVIDENCE:
        mock_case = e['caseId']
        numeric_case = case_id_map.get(mock_case)
        if not numeric_case:
            print(f"Skipping evidence {e['id']} because case {mock_case} not created")
            continue
        payload = {"case_id": numeric_case, "evidence_type": e['type'], "description": e.get('type'), "storage_location": e.get('storedAt'), "collected_by_name": e.get('collectedBy')}
        res = post(base, '/api/evidence/public', payload, dry_run=dry)
        data = res['json']()
        if res['status_code'] in (201, 200, 0):
            eid = None
            if isinstance(data, dict) and data.get('evidence_id'):
                eid = data['evidence_id']
            evidence_id_map[e['id']] = eid
        else:
            print(f"Failed to create evidence {e['id']} -> {res['status_code']}")

    # 4) create transfers
    print('\n== Creating transfers ==')
    for t in MOCK_TRANSFERS:
        ev = t['evidenceId']
        numeric_evidence = evidence_id_map.get(ev)
        if not numeric_evidence:
            print(f"Skipping transfer {t['id']} because evidence {ev} not created")
            continue
        payload = {"evidence_id": numeric_evidence, "from_name": t['fromUser'], "to_name": t['toUser'], "remarks": t.get('remarks')}
        res = post(base, '/api/transfers/public', payload, dry_run=dry)
        if res['status_code'] not in (201, 200, 0):
            print(f"Failed to create transfer {t['id']} -> {res['status_code']}")

    # 5) create reports
    print('\n== Creating reports ==')
    for r in MOCK_REPORTS:
        ev = r['evidenceId']
        numeric_evidence = evidence_id_map.get(ev)
        if not numeric_evidence:
            print(f"Skipping report {r['id']} because evidence {ev} not created")
            continue
        # try to map analyst to email if present in email_by_name
        analyst_email = None
        if r.get('analyst') and r['analyst'] in email_by_name:
            analyst_email = email_by_name[r['analyst']]
        payload = {"evidence_id": numeric_evidence, "findings": r.get('findings'), "analyst_email": analyst_email}
        res = post(base, '/api/reports/public', payload, dry_run=dry)
        if res['status_code'] not in (201, 200, 0):
            print(f"Failed to create report {r['id']} -> {res['status_code']}")

    print('\nDone. Note: If the API returned numeric IDs as null, please run a GET /api/cases or inspect the DB to map created records.')


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\nAborted by user')
        sys.exit(1)
