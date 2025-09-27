/**
 * Initial schema for SQL Chatbot v0
 * Tables:
 *  - customers(id, name, city)
 *  - products(id, name, category, price)
 *  - orders(id, customer_id, order_date, total)
 *  - order_items(id, order_id, product_id, quantity, unit_price)
 */

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  // Enable FKs in SQLite (no-op in pg)
  if (knex.client.config.client === 'sqlite3') {
    await knex.raw('PRAGMA foreign_keys = ON');
  }

  await knex.schema.createTable('customers', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable().index();
    t.string('city').notNullable().index();
  });

  await knex.schema.createTable('products', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable().index();
    t.string('category').notNullable().index();
    t.decimal('price', 10, 2).notNullable().index();
  });

  await knex.schema.createTable('orders', (t) => {
    t.increments('id').primary();
    t
      .integer('customer_id')
      .notNullable()
      .references('id')
      .inTable('customers')
      .onDelete('CASCADE')
      .index();
    t.date('order_date').notNullable().index();
    t.decimal('total', 12, 2).notNullable().defaultTo(0);
  });

  await knex.schema.createTable('order_items', (t) => {
    t.increments('id').primary();
    t
      .integer('order_id')
      .notNullable()
      .references('id')
      .inTable('orders')
      .onDelete('CASCADE')
      .index();
    t
      .integer('product_id')
      .notNullable()
      .references('id')
      .inTable('products')
      .onDelete('RESTRICT')
      .index();
    t.integer('quantity').notNullable();
    t.decimal('unit_price', 10, 2).notNullable();
  });

  // Helpful indexes
  await knex.schema.alterTable('order_items', (t) => {
    t.index(['order_id', 'product_id']);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('order_items');
  await knex.schema.dropTableIfExists('orders');
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('customers');
};
