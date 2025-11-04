# /decms_backend/app/services.py

import hashlib
import json
from datetime import datetime
from . import db
from .models import EvidenceItem, EvidenceTransfer, User, AuditLog
from .middleware import log_audit

def _calculate_hash(data_string):
    """Helper function to calculate a SHA-256 hash."""
    return hashlib.sha256(data_string.encode('utf-8')).hexdigest()

def create_initial_evidence_entry(case, item_name, description, evidence_type, initial_hash, custodian_id, creator_id):
    """
    Creates a new evidence item AND its "genesis" (first) transfer record.
    This is a single, atomic transaction.
    """
    try:
        # 1. Create the Evidence Item
        new_evidence = EvidenceItem(
            case_id=case.case_id,
            item_name=item_name,
            description=description,
            evidence_type=evidence_type,
            initial_hash=initial_hash,
            status="Checked In",
            current_custodian_id=custodian_id
        )
        db.session.add(new_evidence)
        # We need the ID for the transfer, so we flush (not commit)
        db.session.flush() 

        # 2. Create the Genesis Transfer (the "first link" in the chain)
        # The first transfer is from the creator to the initial custodian
        
        # The data for the first hash is the initial_hash + new item details
        hash_data = (
            f"{initial_hash},"
            f"{new_evidence.evidence_id},"
            f"{creator_id},"
            f"{custodian_id}"
        )
        genesis_hash = _calculate_hash(hash_data)

        genesis_transfer = EvidenceTransfer(
            evidence_id=new_evidence.evidence_id,
            from_user_id=creator_id, # Person logging the evidence
            to_user_id=custodian_id,   # Person receiving it
            notes=f"Initial check-in. Original hash: {initial_hash}",
            transfer_hash=genesis_hash # This is the first link
        )
        db.session.add(genesis_transfer)

        # 3. Log this action
        log_audit(
            action="CREATE_EVIDENCE",
            details=f"New evidence '{item_name}' (ID: {new_evidence.evidence_id}) created for Case '{case.case_number}'."
        )

        db.session.commit()
        return new_evidence

    except Exception as e:
        db.session.rollback()
        print(f"Error creating initial evidence entry: {e}")
        return None

def create_evidence_transfer(evidence_id, from_user_id, to_user_id, notes=""):
    """
    Atomically creates a new evidence transfer and updates the evidence item.
    This is the core "chain of custody" logic.
    
    """
    
    # 1. Get the evidence item
    evidence_item = EvidenceItem.query.get(evidence_id)
    if not evidence_item:
        raise ValueError("Evidence item not found.")
    
    # 2. Verify the 'from_user' is the current custodian
    if evidence_item.current_custodian_id != from_user_id:
        raise PermissionError("User is not the current custodian of this item.")

    # 3. Get the most recent transfer to find the "previous hash"
    last_transfer = db.session.query(EvidenceTransfer).filter(
        EvidenceTransfer.evidence_id == evidence_id
    ).order_by(EvidenceTransfer.transfer_timestamp.desc()).first()

    if not last_transfer:
        # This should not happen if create_initial_evidence_entry was used
        raise LookupError("Genesis transfer record not found for this item.")
        
    previous_hash = last_transfer.transfer_hash

    # 4. Construct the data string for the new hash
    # We combine the previous hash with all critical new transfer details
    new_timestamp = datetime.utcnow()
    hash_data_string = (
        f"{previous_hash},"
        f"{evidence_id},"
        f"{from_user_id},"
        f"{to_user_id},"
        f"{new_timestamp.isoformat()},"
        f"{notes}"
    )
    
    # 5. Calculate the new hash
    new_transfer_hash = _calculate_hash(hash_data_string)

    try:
        # 6. Create the new transfer log
        new_transfer = EvidenceTransfer(
            evidence_id=evidence_id,
            from_user_id=from_user_id,
            to_user_id=to_user_id,
            transfer_timestamp=new_timestamp,
            notes=notes,
            transfer_hash=new_transfer_hash # The new link in the chain
        )
        db.session.add(new_transfer)

        # 7. Update the evidence item itself
        evidence_item.current_custodian_id = to_user_id
        evidence_item.status = "Transferred"
        db.session.add(evidence_item)
        
        # 8. Log the audit
        log_audit(
            action="TRANSFER_EVIDENCE",
            details=f"Evidence ID {evidence_id} transferred from user {from_user_id} to user {to_user_id}."
        )
        
        # 9. Commit the transaction
        db.session.commit()
        return new_transfer
        
    except Exception as e:
        db.session.rollback()
        print(f"Error during evidence transfer: {e}")
        return None
