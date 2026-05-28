require('dotenv').config();
const { Pool } = require('pg');

const sslDisabled = (process.env.DATABASE_URL || '').includes('sslmode=disable');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslDisabled ? false : undefined,
});

pool.on('error', (err) => console.error('Unexpected PostgreSQL error', err));

module.exports = pool;
