CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  wa_id TEXT UNIQUE,
  family_id TEXT REFERENCES families(id),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('author', 'client')),
  display_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE members ALTER COLUMN wa_id DROP NOT NULL;

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS author_user_id TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipes_author_user_id_fkey') THEN
    ALTER TABLE recipes ADD CONSTRAINT recipes_author_user_id_fkey
      FOREIGN KEY (author_user_id) REFERENCES users(id);
  END IF;
END $$;
