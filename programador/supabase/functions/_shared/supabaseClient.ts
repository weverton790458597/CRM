// ============================================================================
// _shared/supabaseClient.ts
// Helpers compartilhados entre todas as edge functions:
//  - getAdminClient(): client com service role key
//  - checkAdminSecret(req): valida o header x-admin-secret (substitui getAuthUserId)
//  - json(data, status), redirect(url), handleOptions(), corsHeaders
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-admin-secret, x-client-info, apikey, content-type, x-supabase-auth-ticket",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

// Cliente admin (service role) — usado para ler/escrever conexoes_canais e scheduled_posts.
export function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Validação de acesso: em vez de decodificar JWT de usuário do Supabase Auth,
// usamos um segredo de admin simples compartilhado com o front-end.
export function checkAdminSecret(req: Request): boolean {
  const secret = req.headers.get("x-admin-secret");
  const expected = Deno.env.get("ADMIN_SECRET");
  if (!expected) return false;
  return secret === expected;
}

// Retorna 401 se o segredo não bater. Uso: const err = requireAdmin(req); if (err) return err;
export function requireAdmin(req: Request): Response | null {
  if (req.method === "OPTIONS") return handleOptions();
  if (!checkAdminSecret(req)) {
    return json({ error: "Acesso negado: ADMIN_SECRET inválido" }, 401);
  }
  return null;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: url },
  });
}

export function handleOptions(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}
