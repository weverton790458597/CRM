// ============================================================================
// auth-instagram/index.ts
// 1) Gera a URL de autorização Meta/Facebook (login)
// 2) Recebe o callback OAuth, troca o code pelo token de longa duração e salva
//    na tabela conexoes_canais.
// Autenticação via ADMIN_SECRET.
// ============================================================================
import { getAdminClient, json, redirect, handleOptions, checkAdminSecret } from "../_shared/supabaseClient.ts";
import { upsertCredential, expiresAtFromNow } from "../_shared/tokens.ts";

const FB_AUTH_URL = "https://www.facebook.com/v19.0/dialog/oauth";
const FB_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token";
const IG_GRAPH_URL = "https://graph.facebook.com/v19.0";
const SCOPES = "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,instagram_manage_insights";

const CLIENT_ID = Deno.env.get("FACEBOOK_APP_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("FACEBOOK_APP_SECRET") ?? "";
const REDIRECT_BASE = Deno.env.get("REDIRECT_BASE") ?? "https://evrix.shop";
const REDIRECT_URI = `${REDIRECT_BASE}/functions/v1/auth-instagram/callback`;

function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    response_type: "code",
    state,
  });
  return `${FB_AUTH_URL}?${params.toString()}`;
}

async function exchangeShortLived(code: string): Promise<Record<string, unknown>> {
  const url = new URL(FB_TOKEN_URL);
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("client_secret", CLIENT_SECRET);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("code", code);
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new Error(`FB token error ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function exchangeLongLived(shortToken: string): Promise<Record<string, unknown>> {
  const url = new URL(FB_TOKEN_URL);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("client_secret", CLIENT_SECRET);
  url.searchParams.set("fb_exchange_token", shortToken);
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new Error(`FB long-lived error ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function getIgUser(shortToken: string): Promise<{ pageId: string; igUserId: string }> {
  const pagesUrl = new URL(`${IG_GRAPH_URL}/me/accounts`);
  pagesUrl.searchParams.set("access_token", shortToken);
  pagesUrl.searchParams.set("fields", "id,instagram_business_account");
  const res = await fetch(pagesUrl.toString());
  if (!res.ok) throw new Error(`IG pages error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const page = (data.data ?? [])[0];
  if (!page || !page.instagram_business_account) {
    throw new Error("Nenhuma página com conta Instagram Business vinculada");
  }
  return { pageId: page.id, igUserId: page.instagram_business_account.id };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();

  const url = new URL(req.url);
  
  // Extrai a subrota independente do prefixo (/functions/v1/auth-instagram ou /auth-instagram)
  const functionName = "auth-instagram";
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

      const shortToken = await exchangeShortLived(code);
      const longLived = await exchangeLongLived(shortToken.access_token as string);
      const { pageId, igUserId } = await getIgUser(shortToken.access_token as string);
      const expiresAt = expiresAtFromNow(longLived.expires_in as string);

      const supabase = getAdminClient();
      await upsertCredential(supabase, {
        canal_id: channelId,
        provider: "instagram",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        access_token: longLived.access_token as string,
        refresh_token: longLived.access_token as string,
        expires_at: expiresAt,
        extra_data: { page_id: pageId, ig_user_id: igUserId, ...longLived },
      });

      return redirect(`${REDIRECT_BASE}/programador/?auth=instagram_ok`);
    }

    return json({ error: `Rota não encontrada: ${path}` }, 404);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
