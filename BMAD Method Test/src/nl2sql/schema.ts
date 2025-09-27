export type TableSchema = {
  name: string;
  columns: string[];
};

export type DatabaseSchema = {
  tables: TableSchema[];
};

export const dbSchema: DatabaseSchema = {
  tables: [
    {
      name: 'customers',
      columns: ['id', 'name', 'city'],
    },
    {
      name: 'products',
      columns: ['id', 'name', 'category', 'price'],
    },
    {
      name: 'orders',
      columns: ['id', 'customer_id', 'order_date', 'total'],
    },
    {
      name: 'order_items',
      columns: ['id', 'order_id', 'product_id', 'quantity', 'unit_price'],
    },
  ],
};

export function allTables(): string[] {
  return dbSchema.tables.map((t) => t.name);
}

export function allColumns(table: string): string[] {
  const t = dbSchema.tables.find((x) => x.name === table);
  return t ? t.columns : [];
}

export function isAllowedTable(name: string): boolean {
  return dbSchema.tables.some((t) => t.name === name);
}

export function isAllowedColumn(table: string, column: string): boolean {
  const t = dbSchema.tables.find((x) => x.name === table);
  return !!t && t.columns.includes(column);
}
