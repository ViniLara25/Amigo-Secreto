const express = require('express');
const path = require('path');
const mongoose = require('mongoose'); // Importa o Mongoose
const fs = require('fs'); // Manter o FS apenas para a verificação inicial do DB_FILE

// Variáveis essenciais
const PORT = process.env.PORT || 3000;
// Removida a constante DB_FILE, pois usaremos o MongoDB

const app = express();

// --- Variável de Conexão com o Banco de Dados ---
// O Render armazena essa URL na Variável de Ambiente.
const MONGO_URI = process.env.MONGO_URI; 

// --- SCHEMA DO MONGODB (Modelagem dos seus dados) ---
// O modelo agora armazena o estado de UM grupo, identificado pelo 'groupId'.
const GrupoSchema = new mongoose.Schema({
    groupId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    sorteadores: [String],
    elegiveis: [String],
    pares: [
        {
            sorteador: String,
            sorteado: String,
            data: { type: Date, default: Date.now }
        }
    ]
});

const Grupo = mongoose.model('Grupo', GrupoSchema);


// --- Conexão com o MongoDB ---
async function conectarDB() {
    try {
        if (!MONGO_URI) {
            console.error("ERRO: MONGO_URI não está definida nas variáveis de ambiente!");
            // Se MONGO_URI não está definida, o servidor não deve iniciar a DB.
            return; 
        }

        await mongoose.connect(MONGO_URI);
        console.log("Conectado ao MongoDB Atlas com sucesso!");
    } catch (error) {
        console.error("Falha ao conectar ao MongoDB:", error.message);
        // O servidor pode continuar, mas as rotas precisarão de tratamento de erro.
    }
}

// --- Funções de CRUD (Substituem carregar/salvarParticipantes) ---

// 1. Obtém o estado de um Grupo (CREATE se não existir)
async function getGrupo(groupId) {
    // Tenta encontrar o grupo no banco
    let grupo = await Grupo.findOne({ groupId });

    if (!grupo) {
        // Se o grupo não existe, cria um novo a partir do seu JSON inicial
        // Esta é a parte que preenche o DB na primeira vez.
        const dadosIniciais = require('./participantes.json'); // Carrega o estado inicial do JSON
        
        grupo = await Grupo.create({
            groupId,
            sorteadores: dadosIniciais.sorteadores,
            elegiveis: dadosIniciais.elegiveis,
            pares: []
        });
        console.log(`Novo grupo '${groupId}' criado no MongoDB.`);
    }

    // Retorna a estrutura de dados esperada
    return {
        sorteadores: grupo.sorteadores,
        elegiveis: grupo.elegiveis,
        pares: grupo.pares,
        // Retornamos o objeto mongoose inteiro para facilitar o salvamento no updateGrupo
        _id: grupo._id 
    };
}

// 2. Atualiza o estado do Grupo no banco
async function updateGrupo(groupId, newData) {
    // Usa findOneAndUpdate para atualizar o documento existente no DB
    await Grupo.findOneAndUpdate(
        { groupId },
        { 
            sorteadores: newData.sorteadores, 
            elegiveis: newData.elegiveis, 
            pares: newData.pares 
        },
        { new: true, upsert: false } // 'new: true' retorna o documento atualizado
    );
}

// --- Configuração do Middleware ---
app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public')));


// --- Rotas da API ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ➜ ROTA DE ADMINISTRAÇÃO para ver PARES (Agora usa MongoDB)
// ATENÇÃO: Temporariamente usa um ID fixo, será ajustado para Múltiplos Grupos depois.
app.get('/admin/pares', async (req, res) => {
    try {
        // ID temporário fixo para o primeiro grupo
        const TEMPORARY_GROUP_ID = "grupo_principal"; 
        
        const { pares } = await getGrupo(TEMPORARY_GROUP_ID); 
        
        if (pares.length === 0) {
            return res.json({ mensagem: "Nenhum par sorteado ainda." });
        }
        res.json(pares);
    } catch (error) {
        console.error("Erro ao carregar pares:", error.message);
        res.status(500).json({ erro: "Erro interno do servidor ao buscar dados." });
    }
});


// ➜ Sortear (AGORA É ASYNC e usa MongoDB)
app.post("/sortear", async (req, res) => {
    
    // ⚠️ ATENÇÃO: Para esta versão inicial, usamos um ID fixo.
    // O próximo passo será ler este ID do frontend.
    const TEMPORARY_GROUP_ID = "grupo_principal"; 

    const { nome } = req.body;

    if (!nome) {
        return res.status(400).json({ erro: "Informe seu nome" });
    }
    
    // Carrega a estrutura completa do MongoDB (Função Assíncrona)
    let { sorteadores, elegiveis, pares } = await getGrupo(TEMPORARY_GROUP_ID); 
    
    // Se o banco falhar ao carregar, as listas estarão vazias, 
    // mas a getGrupo já trata a falha.
    if (!sorteadores || !elegiveis) {
         return res.status(500).json({ erro: "Falha ao carregar listas do banco de dados." });
    }

    // 1. VERIFICAÇÃO DO JOGO
    if (sorteadores.length === 0) {
        return res.status(400).json({ erro: "O sorteio já foi concluído! Todos já sortearam." });
    }
    
    // 2. VERIFICAÇÃO SE O USUÁRIO PODE SORTEAR
    const podeSortear = sorteadores.some(p => p.toLowerCase() === nome.toLowerCase());

    if (!podeSortear) {
        return res.status(400).json({ erro: "Você já sorteou seu amigo secreto e não pode sortear novamente!" });
    }

    // 3. FILTRO DE ELEGÍVEIS
    const elegiveisParaSorteio = elegiveis.filter(
        p => p.toLowerCase() !== nome.toLowerCase()
    );

    if (elegiveisParaSorteio.length === 0) {
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
        sorteado: nomeSorteado
    }); 

    // B. Remove QUEM SORTEOU ('nome') da lista de sorteadores
    sorteadores = sorteadores.filter(p => p.toLowerCase() !== nome.toLowerCase());
    
    // C. Remove QUEM FOI SORTEADO ('nomeSorteado') da lista de elegíveis
    elegiveis = elegiveis.filter(p => p.toLowerCase() !== nomeSorteado.toLowerCase()); 
    
    // Salva a nova estrutura de listas no MongoDB (Função Assíncrona)
    await updateGrupo(TEMPORARY_GROUP_ID, { sorteadores, elegiveis, pares });

    // 6. RESPOSTA AO CLIENTE
    res.json({
        sorteado: `${nomeSorteado}`
    });
});

// --- Inicia servidor ---
// A conexão com o DB ocorre antes de iniciar o servidor
conectarDB().then(() => {
    app.listen(PORT, () => {
        console.log("Servidor rodando na porta " + PORT);
        console.log(`Acesse: http://localhost:${PORT}`);
    });
});