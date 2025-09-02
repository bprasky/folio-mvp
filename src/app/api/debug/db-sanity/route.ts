import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logDbEnv } from '@/lib/dbEnv';

export async function GET() {
  logDbEnv('db-sanity');

  // Check table + columns + last migration
  const [cols, migs] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE lower(table_name) IN ('project', 'projects')
      ORDER BY table_name, column_name;
    `),
    prisma.$queryRawUnsafe<any[]>(`
      SELECT migration_name, finished_at
      FROM "_prisma_migrations"
      ORDER BY finished_at DESC
      LIMIT 5;
    `).catch(() => []),
  ]);

  return NextResponse.json({ columns: cols, recentMigrations: migs }, { status: 200 });
}
