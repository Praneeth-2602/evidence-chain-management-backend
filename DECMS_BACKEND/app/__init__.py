# /decms_backend/app/__init__.py

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from config import Config

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
bcrypt = Bcrypt()

def create_app(config_class=Config):
    """
    Application factory function.
    """
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions with the app
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    bcrypt.init_app(app)

    # Import models so they are registered with SQLAlchemy
    with app.app_context():
        from . import models  # noqa: F401

        # Register Blueprints (routes)
        from .routes.auth_routes import auth_bp
        from .routes.case_routes import case_bp
        from .routes.evidence_routes import evidence_bp
        from .routes.admin_routes import admin_bp
        
        app.register_blueprint(auth_bp, url_prefix='/api/auth')
        app.register_blueprint(case_bp, url_prefix='/api/cases')
        app.register_blueprint(evidence_bp, url_prefix='/api/evidence')
        app.register_blueprint(admin_bp, url_prefix='/api/admin')

        return app
