import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Neon (and pooled Postgres generally) can drop idle connections at any time.
// Without this listener, that error is unhandled and crashes the whole process.
pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('parent', 'child')),
      parent_id INTEGER REFERENCES users(id)
    );

    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
    CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('school', 'sport', 'routine', 'leisure', 'study', 'other')),
      recurrence TEXT NOT NULL CHECK (recurrence IN ('none', 'daily', 'weekly')),
      days_of_week TEXT,
      date TEXT,
      start_time TEXT,
      end_time TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      starts_on TEXT,
      ends_on TEXT
    );

    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_check;
    ALTER TABLE tasks ADD CONSTRAINT tasks_category_check
      CHECK (category IN ('school', 'sport', 'routine', 'leisure', 'study', 'other'));

    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS starts_on TEXT;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ends_on TEXT;
    UPDATE tasks SET starts_on = TO_CHAR(NOW(), 'YYYY-MM-DD'), ends_on = TO_CHAR(NOW() + INTERVAL '3 months', 'YYYY-MM-DD')
      WHERE recurrence != 'none' AND starts_on IS NULL;

    CREATE TABLE IF NOT EXISTS task_completions (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('done', 'not_done', 'skipped')),
      completed_at TEXT,
      homework_assigned BOOLEAN NOT NULL DEFAULT false,
      homework_due BOOLEAN NOT NULL DEFAULT false,
      homework_done BOOLEAN NOT NULL DEFAULT false,
      UNIQUE(task_id, date)
    );

    ALTER TABLE task_completions DROP CONSTRAINT IF EXISTS task_completions_status_check;
    ALTER TABLE task_completions ADD CONSTRAINT task_completions_status_check
      CHECK (status IN ('done', 'not_done', 'skipped'));

    ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS homework_assigned BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS homework_due BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS homework_done BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS note TEXT;
    ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS override_start_time TEXT;
    ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS override_end_time TEXT;
    ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS override_title TEXT;
    ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS override_category TEXT;
  `);
}
