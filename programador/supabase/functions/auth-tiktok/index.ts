// ============================================================================
// auth-tiktok/index.ts
// Fluxo OAuth do TikTok + troca do refresh_token.
// Autenticação via ADMIN_SECRET.
// ============================================================================
import { getAdminClient, json, redirect, handleOptions, checkAdminSecret } from "../_shared/supabaseClient.ts";
import { upsertCredential, expiresAtFromNow } from "../_shared/tokens.ts";

const TT_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TT_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const SCOPES = "video.upload";

const CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY") ?? "";
const CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET") ?? "";
const REDIRECT_BASE = Deno.env.get("REDIRECT_BASE") ?? "https://evrix.shop";
const REDIRECT_URI = `${REDIRECT_BASE}/functions/v1/auth-tiktok/callback`;

function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_key: CLIENT_KEY,
    response_type: "code",
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
  });
  return `${TT_AUTH_URL}?${params.toString()}`;
}

function buildTokenBody(grantType: string, codeOrRefresh: string): URLSearchParams {
  const body = new URLSearchParams();
  body.set("client_key", CLIENT_KEY);
  body.set("client_secret", CLIENT_SECRET);
  body.set("grant_type", grantType);
  if (grantType === "authorization_code") {
    body.set("code", codeOrRefresh);
    body.set("redirect_uri", REDIRECT_URI);
  } else {
    body.set("refresh_token", codeOrRefresh);
  }
  return body;
}

async function tokenRequest(grantType: string, codeOrRefresh: string): Promise<Record<string, unknown>> {
  const res = await fetch(TT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildTokenBody(grantType, codeOrRefresh).toString(),
  });
  if (!res.ok) throw new Error(`TikTok token error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(`TikTok: ${data.error_description || data.error}`);
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();

  const url = new URL(req.url);
  
  // Extrai a subrota independente do prefixo (/functions/v1/auth-tiktok ou /auth-tiktok)
  const functionName = "auth-tiktok";
  const funcIndex = url.pathname.indexOf(functionName);
  let path = funcIndex !== -1 ? url.pathname.slice(funcIndex + functionName.length) : url.pathname;

  if (path.endsWith("/") && path.length > 1) {
    path = path.slice(0, -1);
  }

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
          // ignora se o body estiver vazio
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
        // falha ao decodificar state
      }

      const data = await tokenRequest("authorization_code", code);
      const expiresAt = expiresAtFromNow(data.expires_in as string);

      const supabase = getAdminClient();
      await upsertCredential(supabase, {
        canal_id: channelId,
        provider: "tiktok",
        client_id: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
        access_token: data.access_token as string,
        refresh_token: data.refresh_token as string,
        expires_at: expiresAt,
        extra_data: data,
      });
      return redirect(`${REDIRECT_BASE}/programador/?auth=tiktok_ok`);
    }

    // Renovação manual de refresh_token via POST
    if (path === "/refresh" && req.method === "POST") {
      const body = await req.json();
      const prevRefresh = body.refresh_token ?? "";
      const data = await tokenRequest("refresh_token", prevRefresh);
      const expiresAt = expiresAtFromNow(data.expires_in as string);
      const supabase = getAdminClient();
      await upsertCredential(supabase, {
        canal_id: body.channel_id ?? null,
        provider: "tiktok",
        access_token: data.access_token as string,
        refresh_token: data.refresh_token as string,
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
