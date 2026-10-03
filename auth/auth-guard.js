/**
 * Evrix Social — Guard de sessão
 * Incluir nas páginas internas do painel, DEPOIS de auth-client.js.
 *
 * <script src="/auth/auth-client.js"></script>
 * <script src="/auth/auth-guard.js" data-login-url="/auth/login.html"></script>
 *
 * Ao redirecionar para o login, guarda a página de origem em ?next=,
 * para o login devolver a pessoa ao lugar que ela tentou abrir.
 */
(function () {
    const scriptTag = document.currentScript;
    const LOGIN_URL = (scriptTag && scriptTag.getAttribute('data-login-url')) || '/auth/login.html';

    function irParaLogin(comDestino) {
        if (comDestino) {
            const destino = window.location.pathname + window.location.search;
            window.location.href = LOGIN_URL + '?next=' + encodeURIComponent(destino);
        } else {
            window.location.href = LOGIN_URL;
        }
    }

    async function protegerPagina() {
        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (!session) irParaLogin(true);
        } catch (err) {
            console.error('❌ Erro ao verificar sessão:', err);
            irParaLogin(true);
        }
    }

    protegerPagina();

    // Sessão caiu (token expirado / logout em outra aba)
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) irParaLogin(event !== 'SIGNED_OUT');
    });

    // Botão "Sair" do painel
    window.evrixLogout = async function () {
        await window.supabaseClient.auth.signOut();
        window.location.href = LOGIN_URL;
    };
})();
