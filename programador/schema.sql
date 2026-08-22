-- ============================================================================
-- Programador de Vídeos — Schema SQL
-- Execute este script no SQL Editor do Supabase (ou via `supabase db push`).
-- ============================================================================

-- Tabela de conexões por canal + plataforma (formato longo: 1 linha por canal_id+provider)
create table if not exists conexoes_canais (
  id uuid primary key default gen_random_uuid(),
  canal_id text not null,
  provider text not null check (provider in ('youtube', 'instagram', 'tiktok')),
  access_token text,
  refresh_token text,
  client_id text,
  client_secret text,
  expires_at timestamptz,
  extra_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canal_id, provider)
);

-- Índice auxiliar para buscas por canal
create index if not exists idx_conexoes_canal_id on conexoes_canais (canal_id);

-- Fila/histórico de publicações disparadas
create table if not exists scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  channel_id text,
  platform text not null check (platform in ('youtube', 'instagram', 'tiktok')),
  video_url text,
  title text,
  caption text,
  scheduled_at timestamptz not null default now(),
  status text not null default 'pendente' check (status in ('pendente', 'processando', 'publicado', 'falhou')),
  resultado jsonb,
  erro_msg text,
  tentativas int not null default 0,
  created_at timestamptz not null default now()
);

-- Trigger simples para manter updated_at em dia
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_conexoes_updated_at on conexoes_canais;
create trigger trg_conexoes_updated_at
before update on conexoes_canais
for each row execute function set_updated_at();

-- RLS: como o acesso é feito pela service role key dentro das edge functions,
-- habilite RLS e não crie policies para "anon" — só a service role (que ignora RLS) deve escrever.
alter table conexoes_canais enable row level security;
alter table scheduled_posts enable row level security;

-- O front-end NÃO lê conexoes_canais diretamente (a tabela guarda tokens).
-- Em vez disso, expõe-se uma view sem colunas sensíveis.
drop policy if exists "leitura publica conexoes_canais" on conexoes_canais;

create or replace view conexoes_canais_status as
  select canal_id, provider, (access_token is not null) as conectado,
         expires_at
  from conexoes_canais;

grant select on conexoes_canais_status to anon;

-- RLS continua ativo em conexoes_canais, sem policy de select para anon:
-- só a service role (usada nas edge functions via getAdminClient()) lê os tokens.

-- ============================================================================
-- BUCKET DE STORAGE: videos-programador  (público para leitura)
-- ============================================================================
-- Crie o bucket pelo painel (Storage > New Bucket) marcando "Public bucket",
-- OU execute via SQL/CLI. Não é possível criar bucket apenas com SQL padrão;
-- use o comando abaixo no supabase CLI ou crie manualmente no painel:
--   supabase storage buckets create videos-programador --public
--
-- Policy de leitura pública para os objetos do bucket (já público, mas garante acesso):
insert into storage.buckets (id, name, public)
values ('videos-programador', 'videos-programador', true)
on conflict (id) do update set public = true;
