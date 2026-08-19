// main.js - Versão Vanilla JS (Compatível com seu HTML)

const SUPABASE_URL = "https://abdliioyzkylccfylils.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_g6l6_QmwE4Tj85_KF_XHfQ_I4gFlY_n";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let activeTab = "tasks";
let tasks = [];
let intercurrences = [];

async function init() {
    await Promise.all([fetchTasks(), fetchIntercurrences()]);
}

async function fetchTasks() {
    const { data, error } = await supabaseClient.from("tasks").select("*");
    if (error) console.error("Erro Tasks:", error);
    else tasks = data || [];
    render();
}

async function fetchIntercurrences() {
    const { data, error } = await supabaseClient.from("intercurrences").select("*");
    if (error) console.error("Erro Intercurrences:", error);
    else intercurrences = data || [];
    render();
}

window.completeTask = async function(id) {
    await supabaseClient.from("tasks").update({ status: "done" }).eq("id", id);
    fetchTasks();
};

window.switchTab = function(tab) {
    activeTab = tab;
    render();
};

function render() {
    const content = document.getElementById("mainContent");
    if (!content) return;

    if (activeTab === "tasks") {
        content.innerHTML = tasks.map(t => `
            <div class="task-card">
                <div class="task-name">${t.task_name || 'Tarefa'}</div>
                <button onclick="completeTask('${t.id}')">Concluir</button>
            </div>
        `).join('');
    } else {
        content.innerHTML = intercurrences.map(i => `
            <div class="occurrence-card">
                <div>${i.description || 'Sem descrição'}</div>
            </div>
        `).join('');
    }
}

function closeModal(event) {
    if (event.target.id === 'modalOverlay') {
        setModalOpen(false);
    }
}

function setModalOpen(open) {
    const modal = document.getElementById("modalOverlay");
    if (modal) modal.style.display = open ? "flex" : "none";
}
// Iniciar
init();
