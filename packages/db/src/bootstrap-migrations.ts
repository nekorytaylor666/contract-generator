/**
 * Одноразовый скрипт: помечает миграции 0000–0003 как применённые в
 * `drizzle.__drizzle_migrations`, если БД была создана через `db:push` или
 * вручную, минуя `drizzle-kit migrate`.
 *
 * Запуск:
 *   pnpm dlx tsx packages/db/src/bootstrap-migrations.ts
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: join(__dirname, "../../../.env") });

const MIGRATIONS_DIR = join(__dirname, "migrations");
const JOURNAL_PATH = join(MIGRATIONS_DIR, "meta/_journal.json");

type JournalEntry = {
  idx: number;
  when: number;
  tag: string;
};

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as {
    entries: JournalEntry[];
  };

  const sqlFiles = new Set(readdirSync(MIGRATIONS_DIR));

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    const { rows: existing } = await client.query<{ hash: string }>(
      'SELECT hash FROM "drizzle"."__drizzle_migrations"'
    );
    const existingHashes = new Set(existing.map((r) => r.hash));

    for (const entry of journal.entries) {
      const file = `${entry.tag}.sql`;
      if (!sqlFiles.has(file)) {
        process.stderr.write(`skip ${entry.tag}: file not found\n`);
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");

      if (existingHashes.has(hash)) {
        process.stdout.write(`already marked: ${entry.tag}\n`);
        continue;
      }

      await client.query(
        'INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
        [hash, entry.when]
      );
      process.stdout.write(`marked: ${entry.tag}\n`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
