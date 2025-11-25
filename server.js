const express = require('express');
const path = require('path');
const fs = require('fs'); 

// Variáveis essenciais
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'participantes.json'); 

const app = express();

// --- Configuração do Middleware ---
app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public')));


// --- Funções de Banco de Dados (Refatoradas) ---

// Carrega lista: Agora retorna um objeto com 'sorteadores' e 'elegiveis'.
function carregarParticipantes() {
    try {
        const data = fs.readFileSync(DB_FILE, "utf-8");
        const parsedData = JSON.parse(data);
        
        // Garante que a estrutura esperada é retornada
        return {
            sorteadores: parsedData.sorteadores || [],
            elegiveis: parsedData.elegiveis || []
        };
    } catch (error) {
        // Retorna a estrutura inicial para evitar quebrar o código
        console.error("Erro ao carregar participantes, retornando estrutura vazia:", error.message);
        return { sorteadores: [], elegiveis: [] };
    }
}

// Salva lista: Recebe e salva o objeto completo
function salvarParticipantes(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}


// --- Rotas da API ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ➜ Sortear
app.post("/sortear", (req, res) => {
    
    if (!fs.existsSync(DB_FILE)) {
        return res.status(500).json({ erro: "Erro: Arquivo de participantes não encontrado." });
    }

    const { nome } = req.body;

    if (!nome) {
        return res.status(400).json({ erro: "Informe seu nome" });
    }

    // Carrega a estrutura de duas listas
    let { sorteadores, elegiveis } = carregarParticipantes();
    
    // 1. VERIFICAÇÃO DO JOGO
    if (sorteadores.length === 0) {
        // Verifica se o jogo realmente acabou (todos sortearam)
        return res.status(400).json({ erro: "O sorteio já foi concluído! Todos já sortearam." });
    }
    
    // 2. VERIFICAÇÃO SE O USUÁRIO PODE SORTEAR
    // Verifica se o nome ainda está na lista de quem pode sortear
    const podeSortear = sorteadores.some(p => p.toLowerCase() === nome.toLowerCase());

    if (!podeSortear) {
        return res.status(400).json({ erro: "Você já sorteou seu amigo secreto e não pode sortear novamente!" });
    }

    // 3. FILTRO DE ELEGÍVEIS
    // Filtra quem não pode ser sorteado (o próprio nome) da lista de elegíveis
    const elegiveisParaSorteio = elegiveis.filter(
        p => p.toLowerCase() !== nome.toLowerCase()
    );

    if (elegiveisParaSorteio.length === 0) {
         // Esta é a condição do último sorteio, onde só resta uma pessoa para sortear a primeira (ciclo)
        if (sorteadores.length === 1 && elegiveis.length === 1) {
             // Se o último sorteador só tem uma opção (ele mesmo),
             // significa que a primeira pessoa sorteada deve ser sorteada pelo último.
             // Como seu `participantes.json` tem o mesmo número de pessoas nas duas listas,
             // o último sorteador sempre será capaz de sortear o último elegível.
             // Para o escopo deste projeto, assumimos que esta condição não será atingida.
             return res.status(400).json({ erro: "Erro de ciclo: Você é a única pessoa que sobrou para sortear a si mesma. Por favor, reinicie o sorteio." });
        }
        
        return res.status(400).json({ erro: "Não há participantes disponíveis para você sortear." });
    }

    // 4. LÓGICA DE SORTEIO
    const indice = Math.floor(Math.random() * elegiveisParaSorteio.length);
    const nomeSorteado = elegiveisParaSorteio[indice];

    // 5. ATUALIZAÇÃO DO JOGO
    
    // A. Remove QUEM SORTEOU ('nome') da lista de sorteadores
    sorteadores = sorteadores.filter(p => p.toLowerCase() !== nome.toLowerCase());
    
    // B. Remove QUEM FOI SORTEADO ('nomeSorteado') da lista de elegíveis
    elegiveis = elegiveis.filter(p => p.toLowerCase() !== nomeSorteado.toLowerCase()); 
    
    // Salva a nova estrutura de listas
    salvarParticipantes({ sorteadores, elegiveis });

    // 6. RESPOSTA AO CLIENTE
    res.json({
        sorteado: `${nomeSorteado}`
    });
});

// --- Inicia servidor ---
app.listen(PORT, () => {
    console.log("Servidor rodando na porta " + PORT);
    console.log(`Acesse: http://localhost:${PORT}`);
});