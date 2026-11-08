const mysql = require("mysql2");

const isLocal = process.env.DB_MODE === "local";

const connectionConfig = isLocal
  ? {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    }
  : {
      uri: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
    };

const db = mysql.createPool({
  ...connectionConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

db.getConnection((err, connection) => {
  if (err) {
    console.log("DB接続失敗", err);
    return;
  }
  console.log("DB接続成功");
  connection.release();
});

module.exports = db;