# Programador de Vídeos

Painel que agenda e publica vídeos em YouTube, Instagram e TikTok para 11 canais,
usando Supabase (Postgres + Edge Functions + Storage) como backend.

## Estrutura

```
programador/
├── index.html
├── style.css
├── app.js
├── sql/
│   └── schema.sql
└── edge-functions/
    ├── _shared/
    │   ├── supabaseClient.ts
    │   └── tokens.ts
    ├── auth-youtube/
    │   └── index.ts
    ├── auth-instagram/
    │   └── index.ts
    ├── auth-tiktok/
    │   └── index.ts
    ├── publish-post/
    │   └── index.ts
    └── upload-video/
        └── index.ts
```

## Deploy das Edge Functions

```bash
supabase functions deploy auth-youtube
supabase functions deploy auth-instagram
supabase functions deploy auth-tiktok
supabase functions deploy publish-post
supabase functions deploy upload-video
```

## Variáveis de Ambiente (Supabase → Edge Functions / Project Settings)

- `ADMIN_SECRET` — segredo compartilhado entre o front-end (header `x-admin-secret`) e as edge functions.
- `SUPABASE_URL` — usado internamente se necessário.
- `SUPABASE_SERVICE_ROLE_KEY` — chave de service role para o client admin dentro das funções.
- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` — OAuth do Google/YouTube Data API.
- `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` — OAuth do TikTok Creator API.
- `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` — OAuth do Meta/Instagram Graph API.
- `REDIRECT_BASE` — domínio base dos callbacks (ex.: https://evrix.shop).

## Setup

1. Rode `sql/schema.sql` no SQL Editor do Supabase.
2. Crie o bucket `videos-programador` como público (Storage).
3. Configure as variáveis de ambiente acima no Supabase.
4. Faça o deploy das edge functions.
5. Abra `index.html`, preencha Supabase URL/Key e o Admin Secret no toolbar, e clique em "Testar Conexão".
6. Conecte cada plataforma pelos botões YT/IG/TK (popup OAuth) e arraste os vídeos nos cards.
7. Clique em "Disparar Programação".

## Segurança dos tokens (RLS)

- `conexoes_canais_status` é a **fonte de leitura pública** (anon key): view
  com `canal_id`, `provider`, `conectado` (booleano) e `expires_at` — sem
  tokens nem client secrets. É o que o `app.js` consulta em
  `testarConexaoSupabase()` e `dispararProgramacao()`.
- `conexoes_canais` (tabela real, com `access_token`, `refresh_token`,
  `client_id`, `client_secret`) tem RLS ativo e **nenhuma policy de select
  para anon**. Só é acessível via **service role**, dentro das edge functions,
  pelo `getAdminClient()` em `edge-functions/_shared/supabaseClient.ts`.
