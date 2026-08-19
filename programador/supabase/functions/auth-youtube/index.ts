// ============================================================================
// auth-youtube/index.ts
// OAuth do Google/YouTube Data API
// ============================================================================
import { getAdminClient, json, redirect, handleOptions, checkAdminSecret } from "../_shared/supabaseClient.ts";
import { upsertCredential, expiresAtFromNow } from "../_shared/tokens.ts";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/youtube.upload";

const CLIENT_ID = Deno.env.get("YOUTUBE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("YOUTUBE_CLIENT_SECRET") ?? "";
const REDIRECT_BASE = Deno.env.get("REDIRECT_BASE") ?? "https://evrix.shop";
const REDIRECT_URI = `${REDIRECT_BASE}/functions/v1/auth-youtube/callback`;

function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function tokenRequest(grantType: string, fields: Record<string, string>): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: grantType,
    ...fields,
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Google token error ${res.status}: ${await res.text()}`);
  return await res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();

  const url = new URL(req.url);
  
  // Extrai a subrota independente do prefixo (/functions/v1/auth-youtube ou /auth-youtube)
  const functionName = "auth-youtube";
  const funcIndex = url.pathname.indexOf(functionName);
  let path = funcIndex !== -1 ? url.pathname.slice(funcIndex + functionName.length) : url.pathname;

  if (path.endsWith("/") && path.length > 1) {
    path = path.slice(0, -1);
  }

  // Validação do Admin Secret (exceto no callback público)
  if (path !== "/callback" && !checkAdminSecret(req)) {
    return json({ error: "Acesso negado: ADMIN_SECRET inválido" }, 401);
  }

  try {
    // Aceita chamadas na raiz "", "/" ou "/login"
    if (path === "" || path === "/" || path === "/login") {
      let channelId = url.searchParams.get("channel_id") ?? "";

      if (req.method === "POST") {
        try {
          const bodyJson = await req.json();
          if (bodyJson.channel_id) channelId = bodyJson.channel_id;
        } catch {
          // ignora payload vazio
        }
      }

      const state = btoa(JSON.stringify({ channel_id: channelId }));
      const authUrl = buildAuthorizeUrl(state);

      if (req.method === "POST") {
        return json({ url: authUrl });
      }

      return redirect(authUrl);
    }

    // Callback OAuth
    if (path === "/callback" && req.method === "GET") {
      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code") ?? "";
      const stateRaw = url.searchParams.get("state") ?? "{}";
      
      if (error) return json({ error }, 400);
      if (!code) return json({ error: "code ausente" }, 400);

      let channelId = null;
      try {
        const state = JSON.parse(atob(stateRaw));
        channelId = state.channel_id || null;
      } catch {
        // falha na decodificação do state
      }

      const data = await tokenRequest("authorization_code", {
        code,
        redirect_uri: REDIRECT_URI,
      });
      const expiresAt = expiresAtFromNow(data.expires_in as string);

      const supabase = getAdminClient();
      await upsertCredential(supabase, {
        canal_id: channelId,
        provider: "youtube",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        access_token: data.access_token as string,
        refresh_token: data.refresh_token as string,
        expires_at: expiresAt,
        extra_data: data,
      });
      return redirect(`${REDIRECT_BASE}/programador/?auth=youtube_ok`);
    }

    // Refresh Token
    if (path === "/refresh" && req.method === "POST") {
      const body = await req.json();
      const refreshToken = body.refresh_token ?? "";
      const data = await tokenRequest("refresh_token", { refresh_token: refreshToken });
      const expiresAt = expiresAtFromNow(data.expires_in as string);
      
      const supabase = getAdminClient();
      await upsertCredential(supabase, {
        canal_id: body.channel_id ?? null,
        provider: "youtube",
        access_token: data.access_token as string,
        expires_at: expiresAt,
        extra_data: data,
      });
      return json({ ok: true, expires_at: expiresAt });
    }

    return json({ error: `Rota não encontrada: ${path}` }, 404);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
