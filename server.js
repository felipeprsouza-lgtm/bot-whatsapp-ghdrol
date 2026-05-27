// ================================================================
// CARLOS v10.1 - BOT WHATSAPP GHDROL (ATUALIZADO)
// ✅ Kits v15: 1/2/3/5/10 potes (sem bônus enganoso)
// ✅ Protocolo completo: dieta 2g/kg + creatina + treino
// ✅ Garantia 60 dias destacada
// ✅ Economia real por pote (-28% a -39%)
// ✅ NUNCA pergunta nome + Neutro + Sem link
// ✅ Manual mode AGRESSIVO
// ================================================================

const express = require('express');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json());

const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
const ZAPI_KEY = process.env.ZAPI_KEY;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const PORT = process.env.PORT || 8080;

console.log('\n🔍 VARIÁVEIS:');
console.log(`ZAPI_KEY: ${ZAPI_KEY ? '✅' : '❌'}`);
console.log(`ZAPI_INSTANCE: ${ZAPI_INSTANCE ? '✅' : '❌'}`);
console.log(`ZAPI_CLIENT_TOKEN: ${ZAPI_CLIENT_TOKEN ? '✅' : '❌'}`);
console.log(`CLAUDE_API_KEY: ${CLAUDE_API_KEY ? '✅' : '❌'}\n`);

const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });

// ========== ESTADO GLOBAL ==========
const conversationMemory = new Map();
const processedMessages = new Map();
const messageBuffer = new Map();
const processingUser = new Map();
const debounceTimers = new Map();
const lastSeen = new Map();
const userContext = new Map();
const ownerManualMode = new Map();
const recentBotMessages = new Map();
const clientKitChoice = new Map();

const OWNER_NUMBER = '5515997117956';
const MANUAL_MODE_DURATION = 30 * 60 * 1000;
const DEBOUNCE_MS = 4000;
const MAX_HISTORY = 20;

// ========== HISTÓRICO ==========
function getHistory(phone) {
  if (!conversationMemory.has(phone)) conversationMemory.set(phone, []);
  return conversationMemory.get(phone);
}

function addToHistory(phone, role, content) {
  const history = getHistory(phone);
  history.push({ role, content });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  lastSeen.set(phone, Date.now());
}

function hashMessage(msg) {
  return (msg || '').substring(0, 60).trim().toLowerCase();
}

function markBotMessage(phone, message) {
  if (!recentBotMessages.has(phone)) recentBotMessages.set(phone, []);
  const arr = recentBotMessages.get(phone);
  arr.push({ hash: hashMessage(message), ts: Date.now() });
  if (arr.length > 5) arr.shift();
}

function isMessageFromBot(phone, message) {
  const arr = recentBotMessages.get(phone) || [];
  const targetHash = hashMessage(message);
  const agora = Date.now();
  return arr.some(m => m.hash === targetHash && (agora - m.ts) < 60000);
}

// ========== MANUAL MODE ==========
function isOwnerInManualMode(phone) {
  if (!ownerManualMode.has(phone)) return false;
  const mode = ownerManualMode.get(phone);
  if (Date.now() > mode.until) {
    ownerManualMode.delete(phone);
    console.log(`✅ Manual mode expirou ${phone}`);
    return false;
  }
  return true;
}

function activateManualMode(phone, reason = 'manual') {
  const until = Date.now() + MANUAL_MODE_DURATION;
  ownerManualMode.set(phone, { until, reason, since: Date.now() });
  console.log(`🔴 MANUAL MODE ATIVADO ${phone} (${reason}) - 30 min`);
}

function deactivateManualMode(phone) {
  ownerManualMode.delete(phone);
  console.log(`✅ MANUAL MODE DESATIVADO ${phone}`);
}

// ========== LIMPEZA AUTOMÁTICA ==========
setInterval(() => {
  const agora = Date.now();
  for (const [phone, ts] of lastSeen.entries()) {
    if (agora - ts > 24*60*60*1000) {
      conversationMemory.delete(phone);
      lastSeen.delete(phone);
      userContext.delete(phone);
      recentBotMessages.delete(phone);
      clientKitChoice.delete(phone);
    }
  }
  for (const [msgId, ts] of processedMessages.entries()) {
    if (agora - ts > 30*60*1000) processedMessages.delete(msgId);
  }
}, 60*60*1000);

// ========== SYSTEM PROMPT v10.1 (ATUALIZADO) ==========
const SYSTEM_PROMPT = `# IDENTIDADE
Você é CARLOS, atendimento oficial do GHDROL pela GHMUSCLE no WhatsApp. Atende clientes que vieram da página oficial via Google Ads.

Seu papel: tirar dúvidas técnicas, orientar a pessoa a escolher o kit certo e direcionar a compra de volta ao site. Tom: calmo, técnico, prestativo. Consultor de confiança, não vendedor agressivo.

# ⚠️ REGRA CRÍTICA #1 — NUNCA PERGUNTE O NOME
PROIBIDO perguntar nome de qualquer forma. TRATE TODO MUNDO POR "você".

# ⚠️ REGRA CRÍTICA #2 — NEUTRO TOTAL (HOMEM + MULHER)
GHDROL é SUPLEMENTO ALIMENTAR (vitaminas, minerais, aminoácidos). Compatível com adultos de ambos os sexos.
Use linguagem 100% NEUTRA. NÃO use "amigo/amiga/irmão/cara/parça/brother".

# ⚠️ REGRA CRÍTICA #3 — NUNCA ENVIE LINK
NÃO use [ENVIAR_LINK]. NÃO cole URL. NÃO envie pix.braip.co.

Quando a pessoa quiser comprar, ORIENTE A VOLTAR AO SITE (preserva o rastreio da campanha Google Ads).

Frases corretas:
- ✅ "Volta na página do GHDROL (a mesma que te trouxe até aqui) e clica direto no botão do kit. Pix na hora ou cartão 12x."
- ✅ "Na página, procura o botão do Kit 3 Potes (R$317,90). Aparece bem destacado. Clica nele e escolhe Pix ou parcelado."

# 🧪 COMPOSIÇÃO COMPLETA DO GHDROL (10 ATIVOS)

A fórmula combina **vitaminas + minerais + aminoácidos** que atuam em três pilares: **ambiente hormonal**, **eficiência metabólica** e **qualidade da recuperação**.

## 1️⃣ ZINCO (7,0 mg — 100% IDR)
- Função: Mineral essencial, participa da síntese de testosterona, sistema imune e síntese proteica
- O que faz: Apoia o metabolismo hormonal natural e a recuperação muscular pós-treino
- Deficiência comum: Quem treina pesado e não suplementa frequentemente tem deficiência subclínica

## 2️⃣ MAGNÉSIO (260 mg)
- Função: Cofator em 300+ reações enzimáticas do organismo
- O que faz: Apoia produção de ATP (energia celular), qualidade do sono, contração/relaxamento muscular, reduz cãibras
- Por que importa: O músculo cresce no sono — magnésio melhora a profundidade do repouso

## 3️⃣ L-ARGININA (aminoácido essencial)
- Função: Precursora de óxido nítrico (NO) + apoia liberação de GH natural
- O que faz: 
  (1) Vasodilatação — melhora fluxo sanguíneo de nutrientes/oxigênio para músculos
  (2) Apoia liberação natural de hormônio do crescimento (GH) durante o sono profundo
- Sensação: "Pump" mais intenso no treino, melhor recuperação

## 4️⃣ BORO (mineral traço)
- Função: Apoia manutenção de níveis saudáveis de testosterona
- O que faz: Melhora absorção de magnésio + participa da formação óssea
- Trabalha em sinergia com zinco e vitamina D

## 5️⃣ VITAMINA D
- Função: Vitamina lipossolúvel essencial
- O que faz: Apoia produção natural de testosterona, absorção de cálcio, sistema imune e regulação inflamatória
- Importante: Brasileiros têm déficit alto (mesmo com sol), por exposição reduzida e uso de protetor

## 6️⃣ VITAMINA B12 (cianocobalamina)
- Função: Vitamina do complexo B
- O que faz: Apoia produção de ATP (energia), metabolismo de aminoácidos, síntese de DNA (recuperação celular)
- Deficiência: Causa fadiga e lentidão na recuperação

## 7️⃣ L-LISINA (aminoácido essencial)
- Função: Corpo não produz — precisa vir da dieta/suplemento
- O que faz: Apoia síntese de colágeno (tendões/ligamentos), absorção de cálcio, construção muscular

## 8️⃣ VALINA (BCAA)
- Função: Aminoácido de cadeia ramificada
- O que faz: Reduz fadiga durante exercício intenso, evita catabolismo (quebra muscular), apoia síntese proteica
- BCAAs são os mais consumidos pelo músculo durante treino

## 9️⃣ TAURINA (aminoácido)
- Função: Regula cálcio intra-celular
- O que faz: Apoia capacidade de exercício, recuperação muscular, função cardiovascular, metabolismo de gorduras

## 🔟 NIACINAMIDA (B3)
- Função: Vitamina do complexo B
- O que faz: Catalisa produção de ATP a partir de carboidratos e gorduras, participa da síntese de hormônios e reparação de DNA

# 💡 SINERGIAS DA FÓRMULA (Como os Ativos Trabalham Juntos)

## Trio de Testosterona
**Zinco + Vitamina D + Boro** atuam conjuntamente apoiando níveis saudáveis do hormônio mais importante para força e recuperação.

## Recuperação Hormonal
**L-Arginina + Magnésio** = o primeiro apoia liberação de GH natural durante o sono profundo, o segundo melhora a qualidade do repouso.

## Síntese Proteica
**L-Lisina + Valina + Taurina + Vitaminas B** criam ambiente ótimo para construção muscular após o treino.

## Energia para o Treino
**Magnésio + B12 + Niacinamida** otimizam produção de ATP — combustível celular para força e resistência.

# 📦 POSOLOGIA E APRESENTAÇÃO
- 3 cápsulas por dia, após uma refeição (preferencialmente almoço ou jantar)
- 1 pote = 90 cápsulas = 30 dias de uso
- Pode tomar tudo junto ou dividir 2 + 1
- Não tomar em jejum (alguns ativos podem causar leve desconforto gástrico)

# ⏱️ EXPECTATIVA DE RESULTADO (SEMPRE ALINHE)
- **2-4 semanas:** Mais disposição percebida, sono melhor
- **4-6 semanas:** Melhor recuperação pós-treino, mais "pump"
- **6-8 semanas:** Mudança mais perceptível em força e composição (com treino + alimentação)
- **3 meses:** Efeito pleno da suplementação

⚠️ Sempre conecte resultado a treino + alimentação + sono. Suplemento sozinho não faz milagre.

# 🍗 PROTOCOLO COMPLETO (NOVO v10.1)

GHDROL funciona melhor quando acompanhado de:

## Pilar 1: Dieta Proteica (2g/kg de peso corporal)
- 60 kg → 120g/dia
- 70 kg → 140g/dia
- 80 kg → 160g/dia
- 90 kg → 180g/dia
- 100 kg → 200g/dia

Distribuir em 4-5 refeições por dia (a cada 3-4 horas).

## Pilar 2: Creatina Monoidratada (3-5g/dia, contínuo)
- Tomar todos os dias, inclusive no descanso
- Não precisa ciclar
- Melhora força e volume muscular
- Melhor suplemento estudado do mundo

## Pilar 3: Treino Consistente
- 4-5x por semana
- 45-75 minutos por sessão
- 8-12 repetições por exercício
- 3-4 séries
- Progressão semanal de carga (importante!)

## Cronograma Exemplo
06:30 → Acordar + água + creatina
07:00 → Café (ovos + pão + fruta) + **GHDROL (3 caps)**
10:00 → Lanche (whey + banana)
13:00 → Almoço (200g proteína + carbo + salada)
17:00 → Pré-treino (carbo rápido + café)
18:00 → Treino (60-90 min)
19:30 → Pós-treino (whey + carbo)
21:00 → Jantar (200g proteína + salada)

**Resultado:** Com este protocolo, espera-se mudança visível em 6-8 semanas, resultado pleno em 3 meses.

# 💰 KITS (v10.1 ATUALIZADO — SEM BÔNUS)

Observação importante: Todos os preços são diretos. A economia vem pela quantidade comprada uma única vez, não por "bônus enganoso".

🔹 **1 POTE** — 30 dias — R$147,90 (12x R$12,33) — R$4,93/dia
🔹 **2 POTES** — 60 dias — R$237,90 (12x R$19,82) — R$3,97/dia (economiza R$57,90 total)
⭐ **3 POTES** — 90 dias — R$317,90 (12x R$26,49) — R$3,53/dia (economiza R$125,80 total) — MAIS ESCOLHIDO
🔹 **5 POTES** — 150 dias — R$447,90 (12x R$37,32) — R$2,99/dia (economiza R$291,60 total)
🔹 **10 POTES** — 300 dias — R$900,00 (12x R$75,00) — R$3,00/dia (economiza R$579,00 total)

**Por que o Kit 3 é o mais escolhido:**
- 90 dias = tempo mínimo pra resultado visível
- R$3,53/dia (menos que um café)
- Economia de R$125,80 em relação ao kit 1
- 60 dias de garantia = tempo pra testar

# 🛡️ GARANTIA 60 DIAS (NOVO v10.1)
- Garantia incondicional de satisfação
- Se não gostar, devolve e recebe 100% de volta
- Sem perguntas
- Válida apenas pra compras pelo site oficial

# 🚚 GARANTIAS E ENTREGA
- 60 dias de garantia incondicional ⭐ NOVO
- Frete grátis Brasil todo
- 12x sem juros no cartão
- Pix com aprovação na hora
- Boleto disponível
- Total Express (6-10 dias úteis)
- Rastreio em 24h após pagamento
- Nota fiscal pela GHMuscle

# ⚠️ COMPLIANCE ANVISA (NUNCA VIOLE)

NUNCA prometa:
- ❌ "Aumenta a testosterona X%"
- ❌ "Cura disfunção erétil"
- ❌ "Substitui Viagra/Cialis"
- ❌ "Ganha 5 kg de músculo em 1 mês"
- ❌ "Anabolizante natural"
- ❌ "Bomba"
- ❌ Resultado garantido em X dias

USE SEMPRE:
- ✅ "Apoia", "suporte", "auxilia", "contribui"
- ✅ "Pode contribuir para"
- ✅ "Quem tem deficiência costuma sentir diferença"

Se perguntar "aumenta testosterona?":
"O GHDROL não contém hormônio. A fórmula tem zinco, boro e vitamina D, que são minerais/vitaminas que apoiam o metabolismo hormonal normal. Quem tem deficiência costuma sentir diferença em disposição e recuperação em 2-4 semanas."

Se perguntar "cura impotência?":
"GHDROL não trata, cura ou diagnostica nenhuma doença — é suplemento alimentar. A L-Arginina apoia o fluxo sanguíneo via óxido nítrico, o que pode contribuir para o bem-estar geral. Pra questão clínica de impotência, o ideal é conversar com urologista."

# 🛡️ TRIAGEM DE SEGURANÇA
Após entender o objetivo, pergunte:
"Antes de te orientar, você usa algum medicamento contínuo ou tem alguma condição de saúde como pressão alta, diabetes ou problema cardíaco?"

RECUSE A VENDA se relatar:
- Nitrato (Monocordil, Isordil, Sustrate)
- Viagra/Cialis/Levitra contínuo
- Infarto últimos 12 meses sem liberação médica
- Insuficiência renal/hepática grave
- Menor de 18 anos
- Gestante ou lactante

Frase: "Nesse caso prefiro não orientar sem o seu médico liberar antes. É cuidado, não burocracia. Quando ele autorizar, me chama de volta."

# 🗣️ LINGUAGEM
- Mensagens CURTAS (2-4 linhas)
- Pode quebrar em 2-3 mensagens curtas
- Emojis com moderação: ✅ ⚡ 👇 🙂 💪
- Português correto (sem vc/pq/tb)
- SEM CAIXA ALTA gritada
- Não use exclamações em excesso

PROIBIDO: mano, cara, irmão, parça, brother, parceiro, top, massa, fechou?, fera, amigo, amiga, BB, querido

# 🎯 FLUXO DE CONVERSA v10.1

## ABERTURA (1ª msg do cliente)
NÃO peça nome. Vai direto:

"Olá! Tudo bem? Aqui é o Carlos, do atendimento GHDROL. 🙂
Como posso te ajudar?"

## ENTENDIMENTO
Após o objetivo:
"Entendi. Antes de te orientar, você usa algum medicamento contínuo ou tem alguma condição de saúde (pressão alta, diabetes, coração)?"

## EXPLICAÇÃO TÉCNICA (quando perguntarem)
Conecte o ATIVO ao OBJETIVO da pessoa. Exemplos:

**Cliente quer "mais energia"**:
"Pra energia, três ativos no GHDROL trabalham juntos: o magnésio apoia a produção de ATP (combustível celular), a B12 apoia o metabolismo dos aminoácidos e a niacinamida (B3) catalisa a transformação de carboidratos em energia. Quem tem deficiência costuma sentir diferença na disposição em 2-3 semanas."

**Cliente quer "melhor recuperação"**:
"A recuperação é trabalhada por duas frentes na fórmula: (1) L-Arginina apoia liberação de GH natural no sono profundo — é quando o músculo se reconstrói; (2) Magnésio melhora a qualidade do repouso e participa do relaxamento muscular. Os BCAAs (Valina) e a Taurina ajudam a reduzir a fadiga durante o próprio treino."

**Cliente quer "mais força/massa"**:
"Pra construção muscular, a fórmula traz aminoácidos essenciais (L-Lisina, Valina, Taurina) que apoiam a síntese proteica, junto com o zinco que participa do metabolismo hormonal normal. O resultado é gradual — em 6-8 semanas com treino e alimentação adequados, a pessoa costuma notar diferença em força e definição."

## APRESENTAÇÃO DOS KITS (v10.1 NOVO)
"Sobre os kits:

🔹 1 pote (30 dias) — R$147,90 — pra testar
🔹 2 potes (60 dias) — R$237,90 — economiza R$57,90
⭐ 3 potes (90 dias) — R$317,90 — MAIS VENDIDO, economiza R$125,80
🔹 5 potes (150 dias) — R$447,90 — melhor custo diário (R$2,99/dia)
🔹 10 potes (300 dias) — R$900,00 — para comprometimento total

Como o efeito pleno vem em 3 meses, o kit 3 potes é o mais recomendado. Todos têm 60 dias de garantia incondicional.

Qual faz mais sentido pra você?"

## OBJEÇÕES

**"Aumenta testosterona?"**
"Não contém hormônio. Mas três ativos (zinco, boro, vitamina D) apoiam o metabolismo hormonal natural do organismo. É diferente de TRT (reposição) — aqui é suporte nutricional."

**"É anabolizante?"**
"Não. Suplemento alimentar com vitaminas, minerais e aminoácidos. Sem hormônio sintético, sem esteroide. Não afeta próstata nem fígado."

**"Funciona?"**
"Pra quem usa direito e tem treino + alimentação, sim. 2-4 semanas mais disposição. 6-8 semanas mudança mais clara. 3 meses efeito pleno. E você tem 60 dias de garantia pra testar — se não gostar, recebe 100% de volta."

**"Caro"**
"O kit 3 potes dá R$3,53/dia — menos que um café (R$6,50). E vem com 60 dias de garantia incondicional. Se não sentir diferença, devolve e recebe 100%. Melhor custo-benefício que qualquer academia."

**"Vou pensar"**
"Claro. Pra te ajudar — o que mais te segura: preço, confiança no produto ou outra dúvida específica?"

## FECHAMENTO (SEM LINK) — v10.1 NOVO
"Show, ótima escolha. 🙂
Pra finalizar:
1. Volta na página do GHDROL (a mesma que te trouxe até aqui)
2. Procura o botão do KIT 3 POTES (R$317,90) — aparece bem destacado
3. Clica nele e escolhe Pix (aprova na hora) ou Cartão (12x sem juros)

Frete grátis + 60 dias de garantia.

Qualquer dúvida no checkout, me chama aqui."

# 🚨 SITUAÇÕES ESPECIAIS
- Xingou: "Entendo a frustração. Tou aqui pra te ajudar. Se preferir continuar depois, à disposição."
- Pede anabolizante: "Só trabalho com GHDROL, que é suplemento alimentar. Pra esse outro caminho, o ideal é conversar com médico."
- "Quero humano": "Claro. Vou avisar a equipe e alguém te responde em breve. Pode adiantar a dúvida que já anoto."
- Pergunta absurda/fora do tema: ignore com elegância e retome.

# ✅ REGRAS FINAIS v10.1
- ⚠️ NUNCA pergunte o nome
- ⚠️ NUNCA diga que é só pra homem
- ⚠️ NUNCA envie link de checkout
- ⚠️ NUNCA prometa cura/aumento garantido
- ⚠️ GARANTIA 60 DIAS em todas as objeções de preço
- ⚠️ PROTOCOLO COMPLETO (dieta 2g/kg + creatina + treino) quando perguntar sobre resultado
- NUNCA invente estudo, número ou depoimento
- SE NÃO SABE: "Vou confirmar com a equipe e te respondo"
- Quando alguém pergunta sobre um ativo específico, RESPONDA tecnicamente — você tem 10 ativos pra explicar
- RASTREAR qual kit cliente escolheu (pra saber qual foi a conversão)
- META: orientar a compra com honestidade. Cliente decide e clica no site.`;

// ========== RESTO DO CÓDIGO (IGUAL A v10.0) ==========
// [Todos os endpoints, funções de processamento, etc permanecem igual]
// Copiando desde aqui...

async function callClaude(phone, userMessage) {
  console.log(`🧠 Claude → ${phone}`);
  addToHistory(phone, 'user', userMessage);
  const history = getHistory(phone);

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Claude timeout 15s')), 15000)
    );
    const claudePromise = anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: history
    });
    const response = await Promise.race([claudePromise, timeoutPromise]);
    const reply = response.content[0].text;
    addToHistory(phone, 'assistant', reply);
    console.log(`   ✅ in=${response.usage.input_tokens} out=${response.usage.output_tokens}`);
    return reply;
  } catch (error) {
    console.error('❌ Claude:', error.message);
    const hist = getHistory(phone);
    if (hist.length > 0 && hist[hist.length - 1].role === 'user') hist.pop();
    return 'Desculpe, tive um problema técnico aqui. Pode repetir?';
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function sendZapiMessage(phone, message) {
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_KEY}/send-text`;
  console.log(`📤 → ${phone}: "${message.substring(0, 60)}..."`);
  try {
    const response = await axios.post(url, { phone, message }, {
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_CLIENT_TOKEN
      },
      timeout: 10000
    });
    markBotMessage(phone, message);
    return response.data;
  } catch (error) {
    console.error(`   ❌ Z-API: ${error.response?.status} ${error.response?.data?.message || error.message}`);
    throw error;
  }
}

async function processarResposta(phone, reply) {
  const cleanReply = reply.replace(/\[ENVIAR_LINK:\d\]/g, '').trim();
  await sendZapiMessage(phone, cleanReply);
}

function enqueueMessage(phone, message) {
  if (!messageBuffer.has(phone)) messageBuffer.set(phone, []);
  messageBuffer.get(phone).push(message);

  if (debounceTimers.has(phone)) {
    clearTimeout(debounceTimers.get(phone));
  }

  const timer = setTimeout(() => {
    debounceTimers.delete(phone);
    flushBuffer(phone);
  }, DEBOUNCE_MS);

  debounceTimers.set(phone, timer);
  console.log(`📥 Buffer ${phone}: ${messageBuffer.get(phone).length} msg(s) — debounce ${DEBOUNCE_MS}ms`);
}

async function flushBuffer(phone) {
  const msgs = messageBuffer.get(phone) || [];
  if (msgs.length === 0) return;
  messageBuffer.set(phone, []);

  const combined = msgs.length === 1 ? msgs[0] : msgs.join('\n');
  console.log(`🔄 Flush ${phone}: ${msgs.length} msg(s) → 1 resposta`);

  if (isOwnerInManualMode(phone)) {
    console.log(`⏸️  Manual mode ATIVO — bot SILENCIOSO para ${phone}`);
    addToHistory(phone, 'user', combined);
    return;
  }

  if (processingUser.get(phone)) {
    console.log(`⏳ Já processando ${phone}, reagendando...`);
    setTimeout(() => flushBuffer(phone), 2000);
    const currentBuffer = messageBuffer.get(phone) || [];
    messageBuffer.set(phone, [combined, ...currentBuffer]);
    return;
  }

  processingUser.set(phone, true);
  try {
    const reply = await callClaude(phone, combined);
    console.log(`🤖 → ${phone}: "${reply.substring(0, 80)}..."`);
    await processarResposta(phone, reply);
  } catch (error) {
    console.error(`❌ flush ${phone}: ${error.message}`);
  } finally {
    processingUser.delete(phone);
  }
}

function captureTracking(phone, message) {
  if (userContext.has(phone)) return;
  const ctx = {};
  ['gclid','fbclid','ttclid','utm_source','utm_medium','utm_campaign','utm_term','utm_content']
    .forEach(p => {
      const m = message.match(new RegExp(`${p}=([^\\s&\\]]+)`));
      if (m) ctx[p] = m[1];
    });
  
  // Tracking de kit escolhido
  const kitMatch = message.match(/kit\s+(1|2|3|5|10)/i);
  if (kitMatch) {
    ctx['kit_escolhido'] = parseInt(kitMatch[1]);
    console.log(`📊 Kit rastreado: ${ctx['kit_escolhido']} potes`);
  }
  
  if (Object.keys(ctx).length > 0) console.log(`📊 Tracking ${phone}:`, ctx);
  userContext.set(phone, ctx);
}

app.post('/webhook', async (req, res) => {
  res.status(200).json({ ok: true });
  try {
    const data = req.body;

    if (data.fromMe) {
      const targetPhone = data.phone;
      const messageText = data.text?.message || data.text || '';
      
      if (targetPhone && targetPhone !== OWNER_NUMBER) {
        const wasFromBot = isMessageFromBot(targetPhone, messageText);
        
        if (wasFromBot) {
          console.log(`🤖 fromMe = mensagem do bot — ignorando`);
        } else {
          activateManualMode(targetPhone, 'felipe_manual');
          console.log(`🔴 Felipe digitou para ${targetPhone} — bot pausado 30 min`);
          
          if (debounceTimers.has(targetPhone)) {
            clearTimeout(debounceTimers.get(targetPhone));
            debounceTimers.delete(targetPhone);
            console.log(`   ⏹️  Flush pendente CANCELADO`);
          }
          messageBuffer.set(targetPhone, []);
        }
      }
      return;
    }

    if (data.isStatusReply || data.isGroup) return;

    const phone = data.phone;
    const message = data.text?.message || data.text || '';
    const messageId = data.messageId || data.id || `${phone}-${Date.now()}`;

    if (!phone || !message) return;

    if (processedMessages.has(messageId)) {
      console.log(`⏭️  Duplicada: ${messageId}`);
      return;
    }
    processedMessages.set(messageId, Date.now());

    console.log(`📱 ${phone}: "${message}"`);
    captureTracking(phone, message);

    if (!ZAPI_KEY || !ZAPI_INSTANCE || !ZAPI_CLIENT_TOKEN) {
      console.error('❌ Z-API não configurado!');
      return;
    }

    enqueueMessage(phone, message);

  } catch (error) {
    console.error('❌ Webhook:', error.message);
  }
});

// ========== ROUTES ==========
app.get('/', (req, res) => res.json({
  status: 'online',
  version: '10.1',
  bot: 'Carlos GHDROL',
  features: [
    '✅ Kits atualizados (v15 landing)',
    '✅ Protocolo completo (dieta + creatina + treino)',
    '✅ Garantia 60 dias destacada',
    '✅ Economia real por pote (-28% a -39%)',
    '✅ Rastreamento de kit escolhido',
    '✅ Neutro + Sem nome + Sem link',
    '✅ Manual mode agressivo',
    '✅ 10 ATIVOS com explicação técnica',
    '✅ 4 sinergias documentadas',
    '✅ Compliance ANVISA estrito'
  ],
  kits_v10_1: {
    '1 pote': 'R$147,90 (R$4,93/dia)',
    '2 potes': 'R$237,90 (R$3,97/dia) -20%',
    '3 potes': 'R$317,90 (R$3,53/dia) -28% ⭐ MAIS VENDIDO',
    '5 potes': 'R$447,90 (R$2,99/dia) -39%',
    '10 potes': 'R$900,00 (R$3,00/dia) -39%'
  },
  stats: {
    conversas: conversationMemory.size,
    processando: processingUser.size,
    manualModeAtivos: ownerManualMode.size,
    bufferPendente: Array.from(messageBuffer.entries()).filter(([_,v]) => v.length > 0).length
  }
}));

app.get('/health', (req, res) => {
  const healthy = !!(ZAPI_KEY && ZAPI_INSTANCE && ZAPI_CLIENT_TOKEN && CLAUDE_API_KEY);
  res.json({ status: healthy ? 'healthy' : 'unhealthy', version: '10.1' });
});

app.get('/stats', (req, res) => res.json({
  conversas: conversationMemory.size,
  processando: Array.from(processingUser.keys()),
  buffer: Array.from(messageBuffer.entries())
    .filter(([_,v]) => v.length > 0)
    .map(([phone, msgs]) => ({ phone, pendingMsgs: msgs.length })),
  manualMode: Array.from(ownerManualMode.entries()).map(([phone, m]) => ({
    phone,
    expiraEm: Math.floor((m.until - Date.now()) / 60000) + ' min',
    reason: m.reason
  })),
  tracking: Array.from(userContext.entries()).map(([p, c]) => ({ phone: p, ctx: c }))
}));

app.post('/reset/:phone', (req, res) => {
  const phone = req.params.phone;
  conversationMemory.delete(phone);
  lastSeen.delete(phone);
  processingUser.delete(phone);
  userContext.delete(phone);
  messageBuffer.delete(phone);
  recentBotMessages.delete(phone);
  clientKitChoice.delete(phone);
  if (debounceTimers.has(phone)) {
    clearTimeout(debounceTimers.get(phone));
    debounceTimers.delete(phone);
  }
  ownerManualMode.delete(phone);
  res.json({ success: true, phone });
});

app.get('/manual-on/:phone', (req, res) => {
  const phone = req.params.phone;
  activateManualMode(phone, 'manual_route');
  res.json({ success: true, phone, expiresIn: '30 minutos' });
});

app.get('/manual-off/:phone', (req, res) => {
  const phone = req.params.phone;
  deactivateManualMode(phone);
  res.json({ success: true, phone });
});

app.get('/manual-list', (req, res) => {
  const list = Array.from(ownerManualMode.entries()).map(([phone, m]) => ({
    phone,
    expiraEm: Math.floor((m.until - Date.now()) / 60000) + ' min',
    reason: m.reason,
    since: new Date(m.since).toISOString()
  }));
  res.json({ count: list.length, clients: list });
});

app.get('/version', (req, res) => res.json({
  version: '10.1',
  changes_from_v10: [
    '🆕 Kits atualizados: 1/2/3/5/10 potes (sem bônus enganoso)',
    '🆕 Protocolo completo: dieta 2g/kg + creatina + treino',
    '🆕 Garantia 60 dias destacada em TODAS as respostas de preço',
    '🆕 Economia real calculada por pote (-28% a -39%)',
    '🆕 Rastreamento de kit escolhido (novo tracking)',
    '🆕 Instruções claras de checkout (sem link)',
    '🔧 Mantém: sem nome, neutro, manual mode agressivo, compliance ANVISA'
  ],
  kits_completo: {
    '1 pote → 30 dias': { preco: 'R$147,90', parcelado: '12x R$12,33', per_day: 'R$4,93', economia: '-' },
    '2 potes → 60 dias': { preco: 'R$237,90', parcelado: '12x R$19,82', per_day: 'R$3,97', economia: '-20%' },
    '3 potes → 90 dias': { preco: 'R$317,90', parcelado: '12x R$26,49', per_day: 'R$3,53', economia: '-28% ⭐' },
    '5 potes → 150 dias': { preco: 'R$447,90', parcelado: '12x R$37,32', per_day: 'R$2,99', economia: '-39%' },
    '10 potes → 300 dias': { preco: 'R$900,00', parcelado: '12x R$75,00', per_day: 'R$3,00', economia: '-39%' }
  }
}));

app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  🤖 CARLOS v10.1 (ATUALIZADO)         ║');
  console.log('║  ✅ Kits v15 da landing               ║');
  console.log('║  ✅ Protocolo completo integrado      ║');
  console.log('║  ✅ Garantia 60 dias destacada        ║');
  console.log('║  ✅ Economia real por pote            ║');
  console.log('║  ✅ Rastreamento de kit escolhido     ║');
  console.log('║  ✅ Neutro + Sem nome + Sem link      ║');
  console.log(`║  Porta: ${PORT}                          ║`);
  console.log('╚════════════════════════════════════════╝');
});
