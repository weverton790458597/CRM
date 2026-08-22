/**
 * Evrix Social — Cliente Supabase compartilhado (Auth)
 * Carregar DEPOIS do script https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
 */
const EVRIX_SUPABASE_URL = 'https://abdliioyzkylccfylils.supabase.co';
const EVRIX_SUPABASE_KEY = 'sb_publishable_g6l6_QmwE4Tj85_KF_XHfQ_I4gFlY_n';

window.supabaseClient = supabase.createClient(EVRIX_SUPABASE_URL, EVRIX_SUPABASE_KEY, {
    auth: {
        // Necessário para ler o token que vem no link do e-mail (recuperação/confirmação)
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true
    }
});

/**
 * Traduz os erros mais comuns do Supabase Auth para mensagens em PT-BR.
 */
window.traduzirErroAuth = function (mensagem = '') {
    const m = mensagem.toLowerCase();

    if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.';
    if (m.includes('user already registered') || m.includes('already registered')) return 'Este e-mail já possui uma conta. Tente entrar ou recuperar a senha.';
    if (m.includes('password should be at least')) return 'A senha precisa ter no mínimo 6 caracteres.';
    if (m.includes('unable to validate email address') || m.includes('invalid email')) return 'Digite um e-mail válido.';
    if (m.includes('rate limit') || m.includes('too many requests')) return 'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.';
    if (m.includes('same_password') || m.includes('new password should be different')) return 'A nova senha precisa ser diferente da atual.';
    if (m.includes('token has expired') || m.includes('invalid or expired')) return 'Este link expirou ou já foi usado. Solicite um novo.';

    return 'Não foi possível concluir a ação. Tente novamente em instantes.';
};
