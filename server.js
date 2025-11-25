const express = require('express');
const path = require('path');
const fs = require('fs'); 
// Acesso negado ao Shell do Render no plano gratuito.
// A rota /admin/pares abaixo é a solução de gerenciamento.

// Variáveis essenciais
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'participantes.json'); 

const app = express();

// --- Configuração do Middleware ---
app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public')));


// --- Funções de Banco de Dados (ATUALIZADAS para incluir 'pares') ---

// Carrega lista: Agora retorna um objeto com 'sorteadores', 'elegiveis' e 'pares'.
function carregarParticipantes() {
    try {
        const data = fs.readFileSync(DB_FILE, "utf-8");
        const parsedData = JSON.parse(data);
        
        // Garante que todas as três estruturas (incluindo 'pares') são retornadas
        return {
            sorteadores: parsedData.sorteadores || [],
            elegiveis: parsedData.elegiveis || [],
            pares: parsedData.pares || [] // <--- ADICIONADO PARES
        };
    } catch (error) {
        console.error("Erro ao carregar participantes, retornando estrutura vazia:", error.message);
        // Retorna a estrutura inicial com PARES vazia em caso de erro
        return { sorteadores: [], elegiveis: [], pares: [] }; // <--- ADICIONADO PARES
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

// ➜ ROTA DE ADMINISTRAÇÃO (APENAS PARA GERENCIAMENTO DE PARES)
// Expõe a lista completa de pares sorteados. Use com cautela!
app.get('/admin/pares', (req, res) => {
    // Carrega o estado atual para obter a lista de pares
    const { pares } = carregarParticipantes(); 
    
    if (pares.length === 0) {
        return res.json({ mensagem: "Nenhum par sorteado ainda." });
    }
    // Retorna todos os pares registrados
    res.json(pares);
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

    // Carrega a estrutura completa de três listas
    let { sorteadores, elegiveis, pares } = carregarParticipantes();
    
    // ... Lógica de Verificação (inalterada) ...

    if (sorteadores.length === 0) {
        return res.status(400).json({ erro: "O sorteio já foi concluído! Todos já sortearam." });
    }
    
    const podeSortear = sorteadores.some(p => p.toLowerCase() === nome.toLowerCase());

    if (!podeSortear) {
        return res.status(400).json({ erro: "Você já sorteou seu amigo secreto e não pode sortear novamente!" });
    }

    const elegiveisParaSorteio = elegiveis.filter(
        p => p.toLowerCase() !== nome.toLowerCase()
    );

    if (elegiveisParaSorteio.length === 0) {
        // ... Lógica de Erro de Ciclo (inalterada) ...
        if (sorteadores.length === 1 && elegiveis.length === 1) {
             return res.status(400).json({ erro: "Erro de ciclo: Você é a única pessoa que sobrou para sortear a si mesma. Por favor, reinicie o sorteio." });
        }
        return res.status(400).json({ erro: "Não há participantes disponíveis para você sortear." });
    }

    // 4. LÓGICA DE SORTEIO
    const indice = Math.floor(Math.random() * elegiveisParaSorteio.length);
    const nomeSorteado = elegiveisParaSorteio[indice];

    // 5. ATUALIZAÇÃO DO JOGO
    
    // A. NOVO: Registra o par para fins de gerenciamento
    pares.push({
        sorteador: nome,
        sorteado: nomeSorteado,
        data: new Date().toISOString() // Opcional: Adiciona carimbo de data/hora
    }); // <--- NOVO CÓDIGO

    // B. Remove QUEM SORTEOU ('nome') da lista de sorteadores
    sorteadores = sorteadores.filter(p => p.toLowerCase() !== nome.toLowerCase());
    
    // C. Remove QUEM FOI SORTEADO ('nomeSorteado') da lista de elegíveis
    elegiveis = elegiveis.filter(p => p.toLowerCase() !== nomeSorteado.toLowerCase()); 
    
    // Salva a nova estrutura de listas (AGORA COM 'pares' INCLUSO!)
    salvarParticipantes({ sorteadores, elegiveis, pares });

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