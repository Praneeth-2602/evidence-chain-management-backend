# /decms_backend/app/middleware.py

from functools import wraps
from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from .models import User, AuditLog
from . import db

def get_current_user():
    """Helper function to get the current user object from JWT."""
    user_id = get_jwt_identity()
    if not user_id:
        return None
    return User.query.get(user_id)

def permission_required(permission_name):
    """
    This is the main decorator for checking user permissions.
    It checks the 'roles' table for boolean flags like 'can_manage_users'.
    
    Usage:
    @app.route('/admin-stuff')
    @permission_required("can_manage_users")
    def some_admin_route():
        return "You are an admin."
    """
    def decorator(fn):
        @wraps(fn)
        @jwt_required()  # Ensures the user is logged in first
        def wrapper(*args, **kwargs):
            current_user = get_current_user()
            
            if not current_user:
                return jsonify({"msg": "User not found"}), 401

            # Check the role for the specific permission
            if not getattr(current_user.role, permission_name, False):
                return jsonify({"msg": "You do not have permission for this action"}), 403
            
            # If permission is granted, run the original route function
            return fn(*args, **kwargs)
        return wrapper
    return decorator

def log_audit(action, details="", commit_now=False):
    """
    Helper function to create an audit log entry from anywhere in the app.
    The route function that calls this is responsible for the db.session.commit()
    unless commit_now is set to True.
    """
    try:
        user = get_current_user()
        user_id = user.user_id if user else None
        
        new_log = AuditLog(
            user_id=user_id,
            action=action,
            details=details,
            ip_address=request.remote_addr
        )
        db.session.add(new_log)
        
        if commit_now:
            db.session.commit()
            
    except Exception as e:
        # Don't let a logging failure crash the main request
        print(f"Error logging audit: {e}")
        db.session.rollback()
