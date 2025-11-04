# /decms_backend/app/routes/auth_routes.py

from flask import Blueprint, request, jsonify
from app import db
from app.models import User, Role, AuditLog
from app.middleware import log_audit
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

auth_bp = Blueprint('auth_bp', __name__)

@auth_bp.route('/register', methods=['POST'])
# This route should be protected by an admin-only middleware in a real app
# For now, we'll leave it open for initial user creation.
def register():
    """
    Register a new user.
    """
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    role_name = data.get('role_name', 'Forensic Analyst') # Default role

    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "Email already exists"}), 400

    # Find the role
    role = Role.query.filter_by(role_name=role_name).first()
    if not role:
        # In a real app, you'd have a script to pre-populate roles
        return jsonify({"msg": f"Role '{role_name}' not found"}), 400

    new_user = User(
        email=email,
        first_name=first_name,
        last_name=last_name,
        role_id=role.role_id
    )
    new_user.set_password(password)
    
    try:
        db.session.add(new_user)
        # We pass commit_now=True because this is a self-contained action
        log_audit(action="REGISTER_USER", details=f"New user {email} registered.", commit_now=True)
        return jsonify({"msg": "User created successfully"}), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Could not create user", "error": str(e)}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Logs in a user and returns a JWT access token.
    """
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"msg": "Email and password are required"}), 400

    user = User.query.filter_by(email=email).first()

    if user and user.check_password(password):
        if not user.is_active:
            log_audit(action="LOGIN_FAILED_INACTIVE", details=f"Inactive user {email} attempt.", commit_now=True)
            return jsonify({"msg": "User account is inactive"}), 401
            
        # Create the access token
        access_token = create_access_token(identity=user.user_id)
        
        log_audit(action="LOGIN_SUCCESS", details=f"User {email} logged in.", commit_now=True)
        
        return jsonify(
            access_token=access_token,
            user={
                "user_id": user.user_id,
                "email": user.email,
                "first_name": user.first_name,
                "role": user.role.role_name
            }
        ), 200
    
    log_audit(action="LOGIN_FAILED_CREDENTIALS", details=f"Failed login attempt for {email}.", commit_now=True)
    return jsonify({"msg": "Bad email or password"}), 401


@auth_bp.route('/me', methods=['GET'])
@jwt_required() # Protects this route, user must be logged in
def get_me():
    """
    Gets the profile of the currently logged-in user.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({"msg": "User not found"}), 404
        
    return jsonify(
        user_id=user.user_id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role.role_name,
        permissions={
            "can_manage_users": user.role.can_manage_users,
            "can_create_cases": user.role.can_create_cases,
            "can_transfer_evidence": user.role.can_transfer_evidence
        }
    ), 200
