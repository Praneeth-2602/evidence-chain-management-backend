// test-db.js
const mysql = require('mysql2/promise');

(async () => {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'praneeth',
            database: process.env.DB_NAME || 'decms',
            waitForConnections: true,
            connectionLimit: 5,
            queueLimit: 0,
        });

        const [rows] = await pool.query('SELECT 1 AS ok');
        console.log('DB query result:', rows);
        await pool.end();
    } catch (err) {
        console.error('DB test failed:', err.message || err);
        process.exit(1);
    }
})();