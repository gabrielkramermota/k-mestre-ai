import { execSync } from 'child_process';
import * as path from 'path';

const databaseUrl = process.env.DATABASE_URL || 'file:./data/app.db';
const isPostgres = databaseUrl.startsWith('postgres');

const { PrismaClient } = isPostgres ? require('../generated/postgres') : require('@prisma/client');

let prisma: any;

if (isPostgres) {
  const { PrismaPg } = require('@prisma/adapter-pg');
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
} else {
  const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
}

export { prisma };

export async function migrate(): Promise<void> {
  const backendRoot = path.resolve(__dirname, '..');
  const schema = isPostgres ? 'prisma/schema.postgres.prisma' : 'prisma/schema.prisma';
  execSync(`npx prisma db push --schema ${schema}`, { cwd: backendRoot, stdio: 'inherit' });
}