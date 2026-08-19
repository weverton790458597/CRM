// ============================================================================
// upload-video/index.ts
// Recebe um vídeo (multipart/form-data ou base64 JSON) e grava no bucket
// público `videos-programador`, retornando a URL pública.
// Autenticação via ADMIN_SECRET.
// ============================================================================
import { getAdminClient, json, handleOptions, corsHeaders, checkAdminSecret } from "../_shared/supabaseClient.ts";

const BUCKET = "videos-programador";

function publicUrl(canalId: string, fileName: string): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${canalId}/${fileName}`;
}

async function handleMultipart(req: Request): Promise<{ canalId: string; fileName: string; bytes: Uint8Array } | { error: string; status: number }> {
  const form = await req.formData();
  const file = form.get("file");
  const canalId = (form.get("canal_id") as string) || "global";
  if (!file || typeof file === "string") {
    return { error: "campo 'file' ausente", status: 400 };
  }
  const blob = file as Blob;
  const originalName = (file as File).name || "video.mp4";
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { canalId, fileName: safeName, bytes };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (!checkAdminSecret(req)) return json({ error: "Acesso negado: ADMIN_SECRET inválido" }, 401);

  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const parsed = await handleMultipart(req);
      if ("error" in parsed) return json({ error: parsed.error }, parsed.status);
      const supabase = getAdminClient();
      const path = `${parsed.canalId}/${parsed.fileName}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, parsed.bytes, { contentType: "video/mp4", upsert: true });
      if (error) return json({ error: `upload: ${error.message}` }, 500);
      return json({ ok: true, url: publicUrl(parsed.canalId, parsed.fileName), path });
    }

    // Fallback: JSON com { canal_id, file_name, content_base64 }
    const body = await req.json();
    const canalId = body.canal_id || "global";
    const fileName = (body.file_name || "video.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");
    const b64 = body.content_base64 || "";
    if (!b64) return json({ error: "content_base64 ausente" }, 400);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const supabase = getAdminClient();
    const path = `${canalId}/${fileName}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "video/mp4", upsert: true });
    if (error) return json({ error: `upload: ${error.message}` }, 500);
    return json({ ok: true, url: publicUrl(canalId, fileName), path });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
