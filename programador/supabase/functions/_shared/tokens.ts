// ============================================================================
// _shared/tokens.ts
// Operações sobre a tabela conexoes_canais no FORMATO LONGO
// (1 linha por canal_id + provider).
// ============================================================================

export interface Credential {
  id?: string;
  canal_id: string | null;
  provider: "youtube" | "instagram" | "tiktok";
  access_token?: string | null;
  refresh_token?: string | null;
  client_id?: string | null;
  client_secret?: string | null;
  expires_at?: string | null;
  extra_data?: Record<string, unknown> | null;
}

// Busca a credencial de um canal + provider. canal_id pode ser null (global).
export async function getCredential(
  supabase: any,
  canalId: string | null,
  provider: string,
): Promise<Credential | null> {
  let query = supabase
    .from("conexoes_canais")
    .select("*")
    .eq("provider", provider);

  if (canalId == null) {
    query = query.is("canal_id", null);
  } else {
    query = query.eq("canal_id", canalId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`getCredential: ${error.message}`);
  return (data as Credential) ?? null;
}

// Insere ou atualiza (upsert) usando a restrição unique(canal_id, provider).
export async function upsertCredential(
  supabase: any,
  dados: Credential,
): Promise<void> {
  const { error } = await supabase
    .from("conexoes_canais")
    .upsert(
      {
        canal_id: dados.canal_id ?? null,
        provider: dados.provider,
        access_token: dados.access_token ?? null,
        refresh_token: dados.refresh_token ?? null,
        client_id: dados.client_id ?? null,
        client_secret: dados.client_secret ?? null,
        expires_at: dados.expires_at ?? null,
        extra_data: dados.extra_data ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "canal_id,provider" },
    );
  if (error) throw new Error(`upsertCredential: ${error.message}`);
}

// Verifica se o token já expirou (com margem de 5 minutos).
export function isExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false; // sem expires_at => consideramos válido
  const exp = new Date(expiresAt).getTime();
  if (Number.isNaN(exp)) return false;
  return Date.now() >= exp - 5 * 60 * 1000;
}

// Calcula expires_at a partir de agora + expiresIn (segundos).
export function expiresAtFromNow(expiresIn?: string | number): string {
  const secs = typeof expiresIn === "string"
    ? parseInt(expiresIn, 10)
    : (expiresIn ?? 3600);
  const ms = (Number.isNaN(secs) ? 3600 : secs) * 1000;
  return new Date(Date.now() + ms).toISOString();
}
