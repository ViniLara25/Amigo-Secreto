const express = require('express');
const path = require('path');
import path from "path";
import { fileURLToPath } from "url";
const port = process.env.PORT || 3000;



const app = express();
app.use(express.json());

// 1. Lógica para servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));



// Para servir arquivos da pasta public
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

const DB_FILE = "./participantes.json";

// Carrega lista
function carregarParticipantes() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

// Salva lista
function salvarParticipantes(lista) {
  fs.writeFileSync(DB_FILE, JSON.stringify(lista, null, 2), "utf-8");
}

// ➜ Sortear
app.post("/sortear", (req, res) => {
  const { nome } = req.body;

  if (!nome) {
    return res.status(400).json({ erro: "Informe seu nome" });
  }

  let participantes = carregarParticipantes();

  if (!participantes.some(p => p.toLowerCase() === nome.toLowerCase())) {
    return res.status(400).json({ erro: "Você não está na lista!" });
  }

  const elegiveis = participantes.filter(
    p => p.toLowerCase() !== nome.toLowerCase()
  );

  if (elegiveis.length === 0) {
    return res.status(400).json({ erro: "Não há mais participantes disponíveis." });
  }

  const indice = Math.floor(Math.random() * elegiveis.length);
  const nomeSorteado = elegiveis[indice];

  participantes = participantes.filter(p => p !== nomeSorteado);
  salvarParticipantes(participantes);

  res.json({
    mensagem: `🎉 ${nome}, seu amigo secreto é: ${nomeSorteado}`
  });
});

// Inicia servidor
app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Rodando na porta " + PORT));
