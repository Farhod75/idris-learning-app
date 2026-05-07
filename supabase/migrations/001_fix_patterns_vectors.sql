-- Enable pgvector extension
create extension if not exists vector;

-- FIX_PATTERNS vector store
create table if not exists fix_patterns_vectors (
  id           uuid default gen_random_uuid() primary key,
  pattern_id   text not null unique,        -- e.g. "FP-039"
  title        text not null,
  content      text not null,               -- full pattern text
  embedding    vector(1024),                -- voyage-ai dimension
  category     text,                        -- "css"|"powershell"|"typescript"|"playwright"
  severity     text,                        -- "high"|"medium"|"low"
  file_targets text[],                      -- ["index.html", "*.ts"]
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Index for fast similarity search
create index if not exists fix_patterns_embedding_idx
  on fix_patterns_vectors
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

-- Search function — call this from rag-agent
create or replace function search_fix_patterns(
  query_embedding vector(1024),
  match_threshold float default 0.7,
  match_count     int default 3
)
returns table (
  pattern_id text,
  title      text,
  content    text,
  category   text,
  similarity float
)
language sql stable as $$
  select
    pattern_id,
    title,
    content,
    category,
    1 - (embedding <=> query_embedding) as similarity
  from fix_patterns_vectors
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Disable RLS (same pattern as hadith-verifier FP-001)
alter table fix_patterns_vectors disable row level security;
grant all on fix_patterns_vectors to service_role;
grant all on fix_patterns_vectors to anon;