# /decms_backend/app/models.py

from app import db, bcrypt
from datetime import datetime

# --- Association Table for Many-to-Many (if needed, e.g., for permissions) ---
# (Not in the original schema, but good to know)

# --- Main Tables ---

class Role(db.Model):
    __tablename__ = 'roles'
    role_id = db.Column(db.Integer, primary_key=True)
    role_name = db.Column(db.String(50), unique=True, nullable=False)
    # Permissions
    can_manage_users = db.Column(db.Boolean, default=False)
    can_create_cases = db.Column(db.Boolean, default=False)
    can_transfer_evidence = db.Column(db.Boolean, default=False)
    # Relationship
    users = db.relationship('User', back_populates='role')

class User(db.Model):
    __tablename__ = 'users'
    user_id = db.Column(db.Integer, primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey('roles.role_id'), nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    badge_number = db.Column(db.String(50), unique=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.TIMESTAMP, default=datetime.utcnow)
    
    # Relationships
    role = db.relationship('Role', back_populates='users')
    created_cases = db.relationship('Case', back_populates='creator')
    current_evidence = db.relationship('EvidenceItem', back_populates='current_custodian')
    transfers_from = db.relationship('EvidenceTransfer', foreign_keys='EvidenceTransfer.from_user_id', back_populates='from_user')
    transfers_to = db.relationship('EvidenceTransfer', foreign_keys='EvidenceTransfer.to_user_id', back_populates='to_user')

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)

class Case(db.Model):
    __tablename__ = 'cases'
    case_id = db.Column(db.Integer, primary_key=True)
    case_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    case_name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.String(50), default='Open') # e.g., 'Open', 'Closed'
    created_by = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    created_at = db.Column(db.TIMESTAMP, default=datetime.utcnow)
    
    # Relationships
    creator = db.relationship('User', back_populates='created_cases')
    evidence_items = db.relationship('EvidenceItem', back_populates='case', cascade="all, delete-orphan")
    reports = db.relationship('Report', back_populates='case')

class EvidenceItem(db.Model):
    __tablename__ = 'evidence_items'
    evidence_id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.Integer, db.ForeignKey('cases.case_id'), nullable=False)
    item_name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    evidence_type = db.Column(db.String(100)) # e.g., 'Digital', 'Physical'
    acquired_at = db.Column(db.TIMESTAMP, default=datetime.utcnow)
    initial_hash = db.Column(db.String(255)) # e.g., SHA-256
    status = db.Column(db.String(50), default='Checked In')
    current_custodian_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    
    # Relationships
    case = db.relationship('Case', back_populates='evidence_items')
    current_custodian = db.relationship('User', back_populates='current_evidence')
    transfers = db.relationship('EvidenceTransfer', back_populates='evidence_item', cascade="all, delete-orphan", order_by='EvidenceTransfer.transfer_timestamp')

class EvidenceTransfer(db.Model):
    __tablename__ = 'evidence_transfers'
    transfer_id = db.Column(db.Integer, primary_key=True)
    evidence_id = db.Column(db.Integer, db.ForeignKey('evidence_items.evidence_id'), nullable=False)
    from_user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    to_user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    transfer_timestamp = db.Column(db.TIMESTAMP, default=datetime.utcnow)
    notes = db.Column(db.Text)
    transfer_hash = db.Column(db.String(255), nullable=False, unique=True) # The chain link
    
    # Relationships
    evidence_item = db.relationship('EvidenceItem', back_populates='transfers')
    from_user = db.relationship('User', foreign_keys=[from_user_id], back_populates='transfers_from')
    to_user = db.relationship('User', foreign_keys=[to_user_id], back_populates='transfers_to')

class Report(db.Model):
    __tablename__ = 'reports'
    report_id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.Integer, db.ForeignKey('cases.case_id'))
    report_type = db.Column(db.String(100))
    generated_by = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    generated_at = db.Column(db.TIMESTAMP, default=datetime.utcnow)
    report_data = db.Column(db.Text) # Could be JSON, HTML, or path to a file
    
    # Relationships
    case = db.relationship('Case', back_populates='reports')
    generator = db.relationship('User')

class AuditLog(db.Model):
    __tablename__ = 'audit_log'
    log_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'))
    action = db.Column(db.String(255), nullable=False) # e.g., 'LOGIN', 'VIEW_EVIDENCE'
    details = db.Column(db.Text)
    ip_address = db.Column(db.String(45))
    timestamp = db.Column(db.TIMESTAMP, default=datetime.utcnow)
    
    # Relationship
    user = db.relationship('User')

class SystemSetting(db.Model):
    __tablename__ = 'system_settings'
    setting_id = db.Column(db.Integer, primary_key=True)
    setting_key = db.Column(db.String(100), unique=True, nullable=False)
    setting_value = db.Column(db.String(255), nullable=False)
