const inputNome = document.getElementById('digitando-nome');
const btnSortear = document.getElementById('btn-sortear');
const resultado = document.getElementById('resultado');

// Habilita / desabilita o botão
inputNome.addEventListener('input', () => {
    btnSortear.disabled = !inputNome.value.trim();
});

async function sortear() {
    const nome = inputNome.value.trim();

    if (!nome) return;

    try {
        const resposta = await fetch("/sortear", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome })
        });

        const dados = await resposta.json();

        if (dados.erro) {
            resultado.innerHTML = `❌ ${dados.erro}`;
        } else {
            resultado.innerHTML = `🎁 ${dados.mensagem}`;
        }

    } catch (erro) {
        resultado.innerHTML = "⚠ Erro ao conectar ao servidor.";
    }

    // Limpa campo e volta desabilitado
    inputNome.value = "";
    btnSortear.disabled = true;
}
