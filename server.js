const express = require('express');
const path = require('path');
// Importação do módulo 'fs' é necessária para carregar e salvar o JSON
const fs = require('fs'); 

// Variáveis essenciais
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'participantes.json'); // Usando path.join para segurança

const app = express();

// Configuração do Middleware
app.use(express.json()); // Permite que o servidor leia payloads JSON (como o nome no /sortear)

// --- Módulos duplicados removidos: 'import path from "path";' e 'import { fileURLToPath } from "url";'

// 1. Lógica para servir arquivos estáticos da pasta 'public'
// Se estiver usando CommonJS (require), __dirname está disponível globalmente.
// Removemos as linhas: __filename = fileURLToPath... e __dirname = path.dirname...
// Removida a segunda chamada duplicada app.use(express.static...
app.use(express.static(path.join(__dirname, 'public')));


// --- Funções de Banco de Dados ---
// Carrega lista
function carregarParticipantes() {
    // Tratamento de erro básico caso o arquivo não exista ou esteja vazio.
    try {
        const data = fs.readFileSync(DB_FILE, "utf-8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Erro ao carregar participantes, retornando lista vazia:", error.message);
        return [];
    }
}

// Salva lista
function salvarParticipantes(lista) {
    fs.writeFileSync(DB_FILE, JSON.stringify(lista, null, 2), "utf-8");
}


// --- Rotas da API ---

// ➜ Rota de Root: Opcional, mas serve o index.html principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ➜ Sortear
app.post("/sortear", (req, res) => {
    // Lógica para garantir que 'participantes.json' exista antes de tentar ler/escrever.
    if (!fs.existsSync(DB_FILE)) {
        return res.status(500).json({ erro: "Arquivo de participantes não encontrado." });
    }

    const { nome } = req.body;

    if (!nome) {
        return res.status(400).json({ erro: "Informe seu nome" });
    }

    let participantes = carregarParticipantes();

    // Verificação se já houve sorteio (participantes deve ter menos que o total original)
    if (participantes.length === 0) {
        // Você pode querer recarregar a lista original aqui ou informar que o sorteio acabou.
        return res.status(400).json({ erro: "A lista de participantes está vazia, o sorteio pode ter acabado." });
    }
    
    // Filtra para remover o próprio nome do elegível e garantir que ele está na lista
    const participantePresente = participantes.some(p => p.toLowerCase() === nome.toLowerCase());

    if (!participantePresente) {
        return res.status(400).json({ erro: "Você não está na lista!" });
    }

    // Filtra quem não pode ser sorteado (o próprio nome)
    const elegiveis = participantes.filter(
        p => p.toLowerCase() !== nome.toLowerCase()
    );

    if (elegiveis.length === 0) {
        return res.status(400).json({ erro: "Não há mais participantes disponíveis para sortear." });
    }

    // Lógica de Sorteio
    const indice = Math.floor(Math.random() * elegiveis.length);
    const nomeSorteado = elegiveis[indice];

    // Remove o nome sorteado da lista de participantes para evitar repetição (se a intenção for essa)
    // Nota: Esta lógica é válida se a lista 'participantes.json' for sendo esvaziada a cada sorteio.
    participantes = participantes.filter(p => p.toLowerCase() !== nomeSorteado.toLowerCase()); 
    salvarParticipantes(participantes);

    res.json({
        mensagem: `🎉 ${nome}, seu amigo secreto é: ${nomeSorteado}`
    });
});

// --- Inicia servidor ---
// Apenas uma chamada para 'app.listen' é necessária.
app.listen(PORT, () => {
    console.log("Servidor rodando na porta " + PORT);
    console.log(`Acesse: http://localhost:${PORT}`);
});