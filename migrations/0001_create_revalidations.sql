-- OpenNext for Cloudflare: D1 tag cache schema
-- Used by @opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache

CREATE TABLE IF NOT EXISTS revalidations (
  tag           TEXT    NOT NULL,
  revalidatedAt INTEGER NOT NULL,
  stale         INTEGER,
  expire        INTEGER
);

CREATE INDEX IF NOT EXISTS revalidations_tag_idx ON revalidations(tag);
