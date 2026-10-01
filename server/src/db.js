require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'epresensi',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // DATE/TIMESTAMP sebagai string, hindari geser timezone
});

module.exports = pool;
