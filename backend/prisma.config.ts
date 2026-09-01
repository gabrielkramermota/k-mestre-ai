import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const isPostgres = (process.env.DATABASE_URL || '').startsWith('postgres');

export default defineConfig({
  schema: isPostgres ? 'prisma/schema.postgres.prisma' : 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || 'file:./data/app.db',
  },
});