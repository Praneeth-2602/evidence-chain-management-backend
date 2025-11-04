# /decms_backend/run.py

from app import create_app

app = create_app()

if __name__ == '__main__':
    # You'll need to create your database first in your MySQL/PostgreSQL console
    # e.g., "CREATE DATABASE decms_db;"
    #
    # Then run:
    # 1. flask db init (only once)
    # 2. flask db migrate -m "Initial migration"
    # 3. flask db upgrade
    #
    # To run the app:
    # flask run --debug
    
    app.run(debug=True)
