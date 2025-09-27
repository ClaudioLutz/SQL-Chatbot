/* Knex configuration (supports SQLite by default, Postgres via env) */
require('dotenv').config();

/** @type {import('knex').Knex.Config} */
function baseConfig() {
  const client = process.env.KNEX_CLIENT || 'sqlite3';

  const isSqlite = client === 'sqlite3';
  const connection = isSqlite
    ? { filename: './db.sqlite' }
    : (process.env.DATABASE_URL || 'postgres://localhost:5432/sql_chatbot');

  const cfg = {
    client,
    connection,
    migrations: {
      directory: 'src/db/migrations',
      loadExtensions: ['.js'],
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: 'src/db/seeds',
      loadExtensions: ['.js'],
    },
    pool: { min: 0, max: 5 },
    useNullAsDefault: isSqlite,
  };

  return cfg;
}

module.exports = {
  development: baseConfig(),
  test: baseConfig(),
  production: baseConfig(),
};
