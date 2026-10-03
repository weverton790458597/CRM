/**
 * Evrix Social — Guard de sessão
 * Incluir nas páginas internas do painel, DEPOIS de auth-client.js.
 *
 * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 * <script src="/auth/auth-client.js"></script>
 * <script src="/auth/auth-guard.js" data-login-url="/login.html"></script>
 */
(function () {
    const scriptTag = document.currentScript;
    const LOGIN_URL = (scriptTag && scriptTag.getAttribute('data-login-url')) || '/login.html';

    async function protegerPagina() {
        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (!session) {
                window.location.href = LOGIN_URL;
            }
        } catch (err) {
            console.error('❌ Erro ao verificar sessão:', err);
            window.location.href = LOGIN_URL;
        }
    }

    // Verifica assim que o script carrega
    protegerPagina();

    // Se a sessão cair (token expirado / logout em outra aba), redireciona
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
            window.location.href = LOGIN_URL;
        }
    });

    // Função global para o botão "Sair" do painel
    window.evrixLogout = async function () {
        await window.supabaseClient.auth.signOut();
        window.location.href = LOGIN_URL;
    };
})();
