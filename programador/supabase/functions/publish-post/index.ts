// ============================================================================
// publish-post/index.ts
// Recebe { video_url, caption, platform, channel_id, scheduled_at?, title, ... }
// e dispara o upload nas APIs oficiais (Instagram Reels, TikTok Creator API,
// YouTube Data API). Pode publicar imediatamente ou agendar.
// Autenticação via ADMIN_SECRET (substitui getAuthUserId).
// ============================================================================
import { getAdminClient, json, handleOptions, corsHeaders, checkAdminSecret } from "../_shared/supabaseClient.ts";
import { getCredential, upsertCredential, isExpired, expiresAtFromNow } from "../_shared/tokens.ts";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------
interface PublishRequest {
  video_url?: string;
  caption?: string;
  platform: "youtube" | "instagram" | "tiktok";
  channel_id?: string | null;
  scheduled_at?: string | null;      // ISO; se ausente => publica já
  title?: string;
  description?: string;
  tags?: string[];
  privacy_status?: "private" | "public" | "unlisted";
}

// ---------------------------------------------------------------------------
// Helpers de token
// ---------------------------------------------------------------------------
async function getValidToken(supabase: any, provider: string, channelId?: string | null) {
  const cred = await getCredential(supabase, channelId, provider);
  if (!cred) throw new Error(`Sem credenciais para ${provider} no canal ${channelId ?? "global"}`);
  if (cred.access_token && !isExpired(cred.expires_at)) return cred;

  if (cred.refresh_token) {
    // Renova conforme o provider
    if (provider === "youtube") {
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: cred.client_id ?? Deno.env.get("YOUTUBE_CLIENT_ID") ?? "",
          client_secret: cred.client_secret ?? Deno.env.get("YOUTUBE_CLIENT_SECRET") ?? "",
          refresh_token: cred.refresh_token,
          grant_type: "refresh_token",
        }).toString(),
      });
      const d = await r.json();
      const expiresAt = expiresAtFromNow(d.expires_in);
      await upsertCredential(supabase, { ...cred, access_token: d.access_token, expires_at: expiresAt });
      return { ...cred, access_token: d.access_token };
    }
    if (provider === "tiktok") {
      const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: cred.client_id ?? Deno.env.get("TIKTOK_CLIENT_KEY") ?? "",
          client_secret: cred.client_secret ?? Deno.env.get("TIKTOK_CLIENT_SECRET") ?? "",
          refresh_token: cred.refresh_token,
          grant_type: "refresh_token",
        }).toString(),
      });
      const d = await r.json();
      const expiresAt = expiresAtFromNow(d.expires_in);
      await upsertCredential(supabase, { ...cred, access_token: d.access_token, refresh_token: d.refresh_token ?? cred.refresh_token, expires_at: expiresAt });
      return { ...cred, access_token: d.access_token };
    }
  }
  return cred;
}

// ---------------------------------------------------------------------------
// Instagram Reels (Graph API)
// ---------------------------------------------------------------------------
async function postToInstagram(token: string, igUserId: string, videoUrl: string, caption: string) {
  const create = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_url: videoUrl, caption, media_type: "REELS", access_token: token }),
  });
  const created = await create.json();
  if (created.error) throw new Error(`IG media: ${created.error.message}`);
  const creationId = created.id;

  for (let i = 0; i < 20; i++) {
    const status = await (await fetch(`https://graph.facebook.com/v19.0/${creationId}?fields=status_code&access_token=${token}`)).json();
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR") throw new Error("IG processamento do vídeo falhou");
    await new Promise((r) => setTimeout(r, 3000));
  }

  const publish = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: token }),
  });
  const result = await publish.json();
  if (result.error) throw new Error(`IG publish: ${result.error.message}`);
  return result;
}

// ---------------------------------------------------------------------------
// TikTok Creator API (upload direto de vídeo por URL)
// ---------------------------------------------------------------------------
async function postToTiktok(token: string, videoUrl: string, caption: string, title: string) {
  const init = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      post_info: { title: title || caption, description: caption, privacy_level: "SELF_ONLY", disable_duet: false, disable_comment: false, disable_stitch: false },
      source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
    }),
  });
  const initData = await init.json();
  if (initData.error?.code !== "ok") throw new Error(`TT init: ${JSON.stringify(initData.error)}`);
  const publishId = initData.data.publish_id;
  return { publish_id: publishId };
}

// ---------------------------------------------------------------------------
// YouTube Data API (resumable upload)
// ---------------------------------------------------------------------------
async function postToYoutube(token: string, videoUrl: string, title: string, description: string, tags: string[], privacy: string) {
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`Falha ao baixar vídeo: ${videoRes.status}`);
  const videoBytes = await videoRes.arrayBuffer();

  const metadata = {
    snippet: { title: title || "Sem título", description, tags, categoryId: "22" },
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
  };

  const initRes = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(videoBytes.byteLength),
    },
    body: JSON.stringify(metadata),
  });
  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube não retornou upload URL");

  const upRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(videoBytes.byteLength) },
    body: videoBytes,
  });
  if (!upRes.ok) throw new Error(`YouTube upload error ${upRes.status}: ${await upRes.text()}`);
  return await upRes.json();
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------
async function executePublish(supabase: any, req: PublishRequest) {
  const { platform, video_url, caption, channel_id } = req;
  if (!video_url) throw new Error("video_url obrigatório");

  const cred = await getValidToken(supabase, platform, channel_id);
  const token = cred.access_token as string;

  if (platform === "instagram") {
    const extra = (cred.extra_data as any) || {};
    const igUserId = extra.ig_user_id;
    if (!igUserId) throw new Error("Falta ig_user_id no extra_data do Instagram");
    return await postToInstagram(token, igUserId, video_url, caption ?? "");
  }
  if (platform === "tiktok") {
    return await postToTiktok(token, video_url, caption ?? "", req.title ?? "");
  }
  if (platform === "youtube") {
    return await postToYoutube(token, video_url, req.title ?? "", req.description ?? caption ?? "", req.tags ?? [], req.privacy_status ?? "private");
  }
  throw new Error(`Plataforma desconhecida: ${platform}`);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (!checkAdminSecret(req)) return json({ error: "Acesso negado: ADMIN_SECRET inválido" }, 401);

  try {
    const payload: PublishRequest = await req.json();
    if (!["youtube", "instagram", "tiktok"].includes(payload.platform)) {
      return json({ error: "platform inválida" }, 400);
    }

    const supabase = getAdminClient();

    // Se scheduled_at está no futuro, apenas agenda no banco
    if (payload.scheduled_at && new Date(payload.scheduled_at).getTime() > Date.now()) {
      const { data, error } = await supabase.from("scheduled_posts").insert({
        channel_id: payload.channel_id ?? null,
        video_url: payload.video_url,
        caption: payload.caption,
        title: payload.title ?? null,
        platform: payload.platform,
        scheduled_at: payload.scheduled_at,
        status: "pendente",
      }).select().single();
      if (error) throw error;
      return json({ ok: true, scheduled: true, post: data }, 201);
    }

    // Publicação imediata — registra na fila como "processando"
    const { data: inserted, error: insErr } = await supabase.from("scheduled_posts").insert({
      channel_id: payload.channel_id ?? null,
      video_url: payload.video_url,
      caption: payload.caption,
      title: payload.title ?? null,
      platform: payload.platform,
      scheduled_at: new Date().toISOString(),
      status: "processando",
    }).select("id").single();
    if (insErr) throw insErr;
    const postId = inserted?.id;

    try {
      const result = await executePublish(supabase, payload);
      await supabase.from("scheduled_posts").update({ status: "publicado", resultado: result, tentativas: 1 })
        .eq("id", postId);
      return json({ ok: true, result });
    } catch (e) {
      await supabase.from("scheduled_posts").update({ status: "falhou", erro_msg: (e as Error).message, tentativas: 1 })
        .eq("id", postId);
      return json({ ok: false, error: (e as Error).message }, 500);
    }
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
