const sql = require('mssql');

const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  server: process.env.DB_SERVER,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

async function getConnection() {
  try {
    const pool = await sql.connect(sqlConfig);
    return pool;
  } catch (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
    throw err;
  }
}

async function executeQuery(query) {
  let pool;
  try {
    pool = await getConnection();
    const result = await pool.request().query(query);
    return result.recordset;
  } catch (err) {
    console.error('Erro ao executar query:', err);
    throw err;
  } finally {
    if (pool) {
      pool.close();
    }
  }
}

module.exports = {
  getConnection,
  executeQuery
};