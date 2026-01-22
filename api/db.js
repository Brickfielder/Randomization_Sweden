import pg from "pg";

const { Pool } = pg;

const shouldUseSsl = (() => {
  const url = process.env.DATABASE_URL || "";
  if (url.includes("sslmode=require")) return true;
  if (process.env.PGSSLMODE === "require") return true;
  return process.env.NODE_ENV === "production";
})();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined
});

export default pool;
