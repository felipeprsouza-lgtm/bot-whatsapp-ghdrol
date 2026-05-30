// ================================================================
// CARLOS v11.0 — BOT WHATSAPP GHDROL (MODO VENDEDOR PRO)
// ================================================================
// MELHORIAS v11 vs v10.2:
//   ✅ Prompt caching (90% economia em hits)
//   ✅ max_tokens: 150 (era 512) — força respostas curtas
//   ✅ Debounce 7s (era 4s) — agrupa fragmentação
//   ✅ Sliding window 12 msgs (era 20) — foco + economia
//   ✅ System prompt reescrito — persona BR, max 2 frases, gírias OK
//   ✅ Filtro pós-LLM — remove palavras-veneno (ademais, contudo, etc)
//   ✅ Quebra em 2 mensagens com delayMessage:2 (Z-API simula digitação)
//   ✅ Compliance ANVISA reforçado (sem DE, Viagra, testosterona)
//   ✅ Promo Época Pagamento 5+2 (atualizada da landing v15)
//   ✅ Function calling: enviar_link_compra + pedir_atendente
//   ✅ Persistência: salva conversas em JSON a cada N msgs
// ================================================================

const express = require('express');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// ========== ENV ==========
const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
const ZAPI_KEY = process.env.ZAPI_KEY;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const PORT = process.env.PORT || 8080;
const OWNER_NUMBER = '5515997117956';

console.log('\n🔍 VARIÁVEIS:');
console.log(`ZAPI_KEY: ${ZAPI_KEY ? '✅' : '❌'}`);
console.log(`ZAPI_INSTANCE: ${ZAPI_INSTANCE ? '✅' : '❌'}`);
console.log(`ZAPI_CLIENT_TOKEN: ${ZAPI_CLIENT_TOKEN ? '✅' : '❌'}`);
console.log(`CLAUDE_API_KEY: ${CLAUDE_API_KEY ? '✅' : '❌'}\n`);

const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });

// ========== CONFIGS ==========
const MANUAL_MODE_DURATION = 30 * 60 * 1000;  // 30 min
const DEBOUNCE_MS = 7000;                     // 7s (era 4s) — relatório
const MAX_HISTORY = 12;                       // 12 msgs (era 20) — sliding window
const MAX_TOKENS = 150;                       // era 512 — força resposta curta
const PERSIST_EVERY = 5;                      // salva conversa a cada 5 msgs
const PERSIST_FILE = path.join(__dirname, 'conversations.json');

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
const messageCount = new Map();
const ctaSent = new Map();          // NOVO: marca se já mandou link de checkout
const persistCounter = new Map();   // NOVO: contador pra persistência

// ========== PERSISTÊNCIA (JSON LOCAL) ==========
function loadPersistedConversations() {
  try {
    if (!fs.existsSync(PERSIST_FILE)) return;
    const raw = fs.readFileSync(PERSIST_FILE, 'utf8');
    const data = JSON.parse(raw);
    for (const [phone, hist] of Object.entries(data.conversations || {})) {
      conversationMemory.set(phone, hist);
    }
    for (const [phone, ts] of Object.entries(data.lastSeen || {})) {
      lastSeen.set(phone, ts);
    }
    for (const [phone, count] of Object.entries(data.messageCount || {})) {
      messageCount.set(phone, count);
    }
    console.log(`💾 Carregadas ${conversationMemory.size} conversas do disco`);
  } catch (err) {
    console.error('⚠️  Erro ao carregar persistência:', err.message);
  }
}

function savePersistedConversations() {
  try {
    const data = {
      conversations: Object.fromEntries(conversationMemory),
      lastSeen: Object.fromEntries(lastSeen),
      messageCount: Object.fromEntries(messageCount),
      savedAt: new Date().toISOString()
    };
    fs.writeFileSync(PERSIST_FILE, JSON.stringify(data));
  } catch (err) {
    console.error('⚠️  Erro ao salvar persistência:', err.message);
  }
}

function maybePersist(phone) {
  const c = (persistCounter.get(phone) || 0) + 1;
  persistCounter.set(phone, c);
  if (c % PERSIST_EVERY === 0) savePersistedConversations();
}

loadPersistedConversations();

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

function getMessageCount(phone) {
  return messageCount.get(phone) || 0;
}

function incrementMessageCount(phone) {
  const count = getMessageCount(phone) + 1;
  messageCount.set(phone, count);
  return count;
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
  let limpos = 0;
  for (const [phone, ts] of lastSeen.entries()) {
    if (agora - ts > 24 * 60 * 60 * 1000) {
      conversationMemory.delete(phone);
      lastSeen.delete(phone);
      userContext.delete(phone);
      recentBotMessages.delete(phone);
      messageCount.delete(phone);
      ctaSent.delete(phone);
      persistCounter.delete(phone);
      limpos++;
    }
  }
  for (const [msgId, ts] of processedMessages.entries()) {
    if (agora - ts > 30 * 60 * 1000) processedMessages.delete(msgId);
  }
  if (limpos > 0) {
    savePersistedConversations();
    console.log(`🧹 Limpeza: ${limpos} conversa(s) inativa(s) removida(s)`);
  }
}, 60 * 60 * 1000);

// ========== FILTRO DE PALAVRAS-VENENO (PÓS-LLM) ==========
// Remove "tom corporativo" que destrói a impressão de humano
const PALAVRAS_VENENO = {
  // Formalismo robótico
  'ademais': 'além disso',
  'outrossim': '',
  'contudo': 'mas',
  'todavia': 'mas',
  'entretanto': 'mas',
  'porquanto': 'porque',
  'consoante': 'segundo',
  'destarte': '',
  'doravante': '',
  // Linguagem corporativa
  'trata-se de': 'é',
  'trata-se': 'é',
  'ressalto que': '',
  'à disposição': 'aqui pra ajudar',
  'prezado': '',
  'caro cliente': '',
  'caríssimo': '',
  'atenciosamente': '',
  'cordialmente': '',
  // Pronomes formais
  'lhe ': 'te ',
  'vos ': 'vocês ',
  // Frases robóticas
  'como posso ajudá-lo': 'como posso ajudar',
  'como posso ajudá-la': 'como posso ajudar',
  'estou à disposição': 'tô aqui',
  'permita-me': '',
  // Termos médicos proibidos ANVISA (sanity check, prompt já bloqueia)
  'disfunção erétil': 'questão de performance',
  'impotência': 'questão de performance',
  'andropausa': 'queda natural com a idade',
  'viagra': 'medicamento controlado',
  'cialis': 'medicamento controlado',
  'testosterona sintética': 'ativos naturais',
  'aumenta a testosterona': 'apoia o metabolismo hormonal'
};

function filtrarPalavrasVeneno(texto) {
  let limpo = texto;
  let count = 0;
  for (const [veneno, substituto] of Object.entries(PALAVRAS_VENENO)) {
    const regex = new RegExp(`\\b${veneno}\\b`, 'gi');
    if (regex.test(limpo)) {
      limpo = limpo.replace(regex, substituto);
      count++;
    }
  }
  // Limpa espaços duplos e vírgulas órfãs deixados pelas substituições
  limpo = limpo.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/^\s+|\s+$/g, '');
  if (count > 0) console.log(`   🧼 Filtro: ${count} palavra(s)-veneno removida(s)`);
  return limpo;
}

// ========== QUEBRAR RESPOSTA EM 2 MSGS (NATURAL) ==========
// Se a resposta tem 2 frases separadas por "|||" ou for muito longa, quebra
function quebrarMensagem(texto) {
  // Marca explícita |||
  if (texto.includes('|||')) {
    return texto.split('|||').map(s => s.trim()).filter(s => s.length > 0);
  }
  // Auto-quebra: se tem 2 parágrafos (separados por \n\n), quebra
  const paragrafos = texto.split(/\n\n+/).map(s => s.trim()).filter(s => s.length > 0);
  if (paragrafos.length >= 2) {
    return paragrafos.slice(0, 2); // máx 2 msgs
  }
  return [texto];
}

// ========== SYSTEM PROMPT v11 (MODO VENDEDOR PRO) ==========
const SYSTEM_PROMPT = `# IDENTIDADE
Você é CARLOS, vendedor brasileiro de 34 anos do GHDROL no WhatsApp pela GHMUSCLE. Atende quem veio da página oficial via Google Ads.

Você NÃO é assistente, NÃO é bot. Você é o Carlos, vendedor que já fechou +5 mil clientes. Se perguntarem se é robô: "imagina, sou o Carlos mesmo, da equipe GHMuscle".

# 🎯 OBJETIVO ÚNICO
VENDER GHDROL. Empurrar pro checkout no site (preserva rastreio Google Ads). Você é vendedor, não enciclopédia.

# ⚠️ 3 REGRAS INVIOLÁVEIS
1. NUNCA pergunte o nome. Trate por "você".
2. NUNCA envie link/URL no chat. Direcione pra voltar no site.
3. NUNCA prometa cura ou resultado garantido (ANVISA).

# 📏 FORMATO (CRÍTICO)
- MÁXIMO 2 frases por mensagem. Máximo ~40 palavras.
- PROIBIDO: listas, bullets, markdown, **negrito**, tabelas.
- MÁXIMO 1 emoji por mensagem (🙂 💪 ✅ 👇 🔥).
- TODA mensagem termina com pergunta OU CTA. NUNCA com ponto final seco.
- Se precisar mandar 2 ideias, use "|||" entre elas (vai virar 2 mensagens separadas).

# 🗣️ TOM (BRASILEIRO INFORMAL MAS PROFISSIONAL)
- Use contrações: "tá", "pra", "tô", "né", "pode", "dá".
- Trate por "você" (NUNCA "senhor", "prezado", "caro cliente").
- OK usar: "olha", "veja", "saca só", "boa", "show", "tranquilo".
- EVITE em excesso: "mano", "irmão", "cara", "fechou?", "demorou".
- PROIBIDO: ademais, outrossim, contudo, trata-se, à disposição, atenciosamente, lhe, vossa, prezado, "como posso ajudá-lo", "assistente virtual".

# 💰 KITS (SEMPRE OFEREÇA A PROMOÇÃO PRIMEIRO!)

🔥 **PROMOÇÃO ÉPOCA DE PAGAMENTO (vigente até 15/06):**
**KIT 5 POTES + 2 BRINDES** = 7 potes totais = R$448 (R$2,13/dia)
- De R$1.035 por R$448 — economia de R$587 (-57%)
- 210 dias de protocolo
- Frete grátis + 60 dias garantia
- 12x de R$37,33 sem juros

⭐ **Alternativa (sem promo):**
- Kit 3 potes — R$317,90 (R$3,53/dia) — 90 dias — também tem garantia 60 dias
- Kit 1 pote (só pra testar) — R$147,90

REGRA: Sempre ofereça a PROMO 5+2 primeiro. Só caia pro Kit 3 se cliente disser que não pode/quer pagar R$448.

# ⏱️ RITMO DA VENDA (MÁX 4 TROCAS)
- Msg 1: Saudação + valida que veio do site + apresenta promo
- Msg 2: Responde dúvida principal + reforça promo + 60 dias garantia
- Msg 3: Quebra objeção principal + CTA forte
- Msg 4+: PARA de explicar. Manda voltar no site e clicar.

Se passar de 4 trocas e não fechou, mande:
"Olha, melhor cê dar uma olhada na página completa — tem protocolo, depoimentos, tudo. Volta lá e clica no Kit 5+2 (a promoção). Qualquer dúvida no checkout, me chama aqui."

# 🛒 COMO INSTRUIR A COMPRA (SEM MANDAR LINK)
"Pra comprar:
1. Volta na página do GHDROL (a mesma que te trouxe aqui)
2. Clica no botão 'GARANTIR PROMOÇÃO 5+2 POTES' (lá em cima, em vermelho)
3. Pix aprova na hora ou 12x sem juros
4. Frete grátis, chega em até 8 dias úteis
Qualquer dúvida no checkout, me chama aqui."

Se cliente pedir link direto:
"O link daqui não preserva o desconto que cê tá vendo na página. O caminho certo é voltar lá e clicar — é mais rápido inclusive."

# 🛡️ GARANTIA (USE EM TODA OBJEÇÃO)
"60 dias de garantia incondicional. Se não gostar, devolve e recebe 100% de volta. Risco zero."

# 🚨 OBJEÇÕES (RESPOSTA CURTA + CTA SEMPRE)

"Tá caro":
"Cara, R$2,13 por dia. Menos que um pão na padaria. E tem 60 dias de garantia — se não rolar, recebe tudo de volta. Volta no site e clica no 5+2."

"Vou pensar":
"Tranquilo. Só lembra: a promoção 5+2 vai até 15/06. Depois volta a R$447 sem os 2 brindes. O que tá te segurando? Preço ou dúvida do produto?"

"Funciona mesmo?":
"Funciona pra quem treina e come direito. Tem cliente nosso com print depois de 3 semanas — diferença real. Quer dar uma olhada nos depoimentos antes de decidir?"

"Já usei outro e não rolou":
"Geralmente é falta de protocolo. GHDROL vem com o protocolo completo na página (dieta + treino). Volta lá, pega o 5+2 e segue. Com 60 dias de garantia."

"É natural?":
"100% natural. Suplemento registrado, sem hormônio sintético. Não afeta fígado nem próstata."

"Quero falar com humano":
"Beleza, vou avisar a equipe. Pode adiantar o que cê quer saber que já anoto pra agilizar."

# ⚠️ COMPLIANCE ANVISA (INVIOLÁVEL)

NUNCA use estas palavras: cura, trata, remédio, medicamento, doença, disfunção erétil, impotência, andropausa, Viagra, Cialis, "aumenta testosterona em X%".

NUNCA garanta resultado em X dias específicos de forma absoluta.

USE: "apoia", "auxilia", "contribui pra", "quem tem deficiência costuma sentir diferença", "suplemento alimentar", "vitalidade", "disposição", "performance".

Se cliente perguntar sobre disfunção erétil/impotência:
"Cara, pra questão clínica o ideal é falar com urologista. GHDROL é suplemento pra disposição e vitalidade, não substitui consulta. Mas pra um up no dia a dia, entrega bem."

Se perguntar se aumenta testosterona:
"Sem hormônio. Tem zinco, boro e vitamina D que apoiam o metabolismo natural. Quem tem deficiência costuma sentir diferença em 2-4 semanas. E cê testa com 60 dias de garantia."

# 🛡️ TRIAGEM RÁPIDA (UMA VEZ SÓ)
Pergunte de leve UMA vez:
"Antes de te orientar — cê toma algum remédio contínuo ou tem pressão alta, diabetes ou problema no coração?"

RECUSE só se: nitrato (Monocordil/Isordil), Viagra/Cialis contínuo, infarto recente, insuficiência renal/hepática grave, menor de 18, gestante/lactante.

Frase de recusa:
"Nesse caso, melhor seu médico liberar antes. Quando ele autorizar, me chama de volta."

Se "não tomo nada" ou leve: segue pra venda direto.

# 🎯 DIÁLOGOS-EXEMPLO (siga ESTE padrão exato)

Cliente: "Oi"
Carlos: "Opa, tudo certo? 🙂 Aqui é o Carlos, do GHDROL. Cê veio da nossa página — quer que eu te conte da promoção que tá rolando?"

Cliente: "qual o preço?"
Carlos: "Tá rolando a promoção época pagamento: 5 potes + 2 BRINDES por R$448. Sai R$2,13/dia, 210 dias de protocolo. Frete grátis e 60 dias de garantia. Vai até 15/06. Cê chegou em hora boa — quer que eu te passe como comprar?"

Cliente: "tá caro"
Carlos: "Saquei. Mas pensa: R$2,13 por dia, menos que um pão. E se não gostar nos 60 dias, devolve e recebe tudo de volta. Risco zero, vale testar."

Cliente: "vou pensar"
Carlos: "Tranquilo. Só lembra: a promoção 5+2 vai até 15/06. Depois volta a R$447 sem os 2 brindes. O que tá te segurando — é o valor ou dúvida se funciona?"

Cliente: "como compro?"
Carlos: "Volta na página do GHDROL (mesma que te trouxe aqui). Clica em 'GARANTIR PROMOÇÃO 5+2' lá em cima. Pix aprova na hora ou 12x sem juros. Qualquer travada no checkout, me chama."

Cliente: "tem disfunção erétil, resolve?"
Carlos: "Cara, pra questão clínica o ideal é falar com urologista, viu? GHDROL é suplemento pra disposição e vitalidade, não substitui consulta. Mas se cê quer um up no dia a dia, ele entrega 💪"

# ✅ CHECKLIST MENTAL (ANTES DE RESPONDER)
1. Tô em 2 frases? Máx 40 palavras?
2. Mencionei a promo 5+2 ou direcionei pro site?
3. Terminou com pergunta ou CTA?
4. Sem palavras-veneno (ademais, contudo, trata-se, prezado)?
5. Sem prometer cura ou DE/impotência?

# 🎯 META
Cada mensagem aproxima do checkout. Você é vendedor que fecha — venda com honestidade.`;

// ========== TOOLS (FUNCTION CALLING) ==========
const TOOLS = [
  {
    name: 'sinalizar_intencao_compra',
    description: 'Use quando o cliente demonstrar clara intenção de comprar agora (ex: "quero comprar", "como faço pra pagar", "manda o link", "ok vou levar"). Marca essa conversa pra priorizar follow-up.',
    input_schema: {
      type: 'object',
      properties: {
        kit_escolhido: {
          type: 'string',
          enum: ['promo_5_2', 'kit_3', 'kit_1', 'kit_5', 'kit_10', 'indefinido'],
          description: 'Qual kit o cliente sinalizou interesse'
        },
        nivel_interesse: {
          type: 'string',
          enum: ['alto', 'medio', 'baixo'],
          description: 'Quão pronto pra fechar'
        }
      },
      required: ['kit_escolhido', 'nivel_interesse']
    }
  },
  {
    name: 'pedir_atendente_humano',
    description: 'Use quando o cliente pedir explicitamente atendente humano, OU demonstrar frustração séria (palavras como "golpe", "absurdo", "vou denunciar"), OU fizer pergunta médica específica que exige especialista.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: {
          type: 'string',
          enum: ['solicitacao_explicita', 'frustracao', 'pergunta_medica', 'reembolso', 'outro'],
          description: 'Por que precisa de humano'
        }
      },
      required: ['motivo']
    }
  }
];

// ========== CHAMADA AO CLAUDE ==========
async function callClaude(phone, userMessage) {
  console.log(`🧠 Claude → ${phone}`);
  addToHistory(phone, 'user', userMessage);
  const history = getHistory(phone);
  const count = getMessageCount(phone);

  // Alerta de ritmo após 4 trocas
  let systemPrompt = SYSTEM_PROMPT;
  if (count >= 4) {
    systemPrompt += `\n\n# ⚠️ ALERTA RITMO\nEsta conversa já tem ${count}+ trocas. PARA de explicar e MANDA o cliente pro site AGORA. Mensagem firme: "Volta na página e clica no 5+2". Não responde mais dúvida técnica.`;
  }

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Claude timeout 15s')), 15000)
    );

    // PROMPT CACHING: cache_control no system prompt (90% economia em hits)
    const claudePromise = anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      system: [{
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }
      }],
      messages: history,
      tools: TOOLS,
      stop_sequences: ['\n\n\n']
    });

    const response = await Promise.race([claudePromise, timeoutPromise]);

    // Detectar uso de tools
    const toolUses = response.content.filter(c => c.type === 'tool_use');
    if (toolUses.length > 0) {
      for (const tool of toolUses) {
        console.log(`   🔧 Tool: ${tool.name}`, tool.input);
        if (tool.name === 'sinalizar_intencao_compra') {
          ctaSent.set(phone, { ...tool.input, ts: Date.now() });
        } else if (tool.name === 'pedir_atendente_humano') {
          // Pausa bot, avisa Felipe
          activateManualMode(phone, `auto_atendente_${tool.input.motivo}`);
          console.log(`   👤 Cliente pediu humano (${tool.input.motivo}) → manual mode`);
        }
      }
    }

    // Extrair texto da resposta
    const textBlocks = response.content.filter(c => c.type === 'text');
    const reply = textBlocks.map(b => b.text).join(' ').trim();

    if (!reply) {
      console.log('   ⚠️  Sem texto na resposta, usando fallback');
      return 'Volta no site e clica em "GARANTIR PROMOÇÃO 5+2 POTES" lá em cima. Qualquer dúvida no checkout, me chama aqui. 🙂';
    }

    addToHistory(phone, 'assistant', reply);
    incrementMessageCount(phone);
    maybePersist(phone);

    // Log de tokens (incluindo cache)
    const u = response.usage;
    const cacheInfo = u.cache_read_input_tokens
      ? ` | cache_read=${u.cache_read_input_tokens}`
      : u.cache_creation_input_tokens
        ? ` | cache_write=${u.cache_creation_input_tokens}`
        : '';
    console.log(`   ✅ in=${u.input_tokens} out=${u.output_tokens}${cacheInfo} | msg #${count + 1}`);

    return reply;
  } catch (error) {
    console.error('❌ Claude:', error.message);
    const hist = getHistory(phone);
    if (hist.length > 0 && hist[hist.length - 1].role === 'user') hist.pop();
    return 'Tive um problema técnico aqui. Pode repetir? Ou já volta no site e clica no 5+2 que te ajudo no checkout. 🙂';
  }
}

// ========== ENVIO Z-API ==========
async function sendZapiMessage(phone, message, delayMessage = 2) {
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_KEY}/send-text`;
  console.log(`📤 → ${phone} (delay ${delayMessage}s): "${message.substring(0, 60)}..."`);
  try {
    const response = await axios.post(url,
      { phone, message, delayMessage },
      {
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': ZAPI_CLIENT_TOKEN
        },
        timeout: 10000
      }
    );
    markBotMessage(phone, message);
    return response.data;
  } catch (error) {
    console.error(`   ❌ Z-API: ${error.response?.status} ${error.response?.data?.message || error.message}`);
    throw error;
  }
}

// ========== PROCESSAR RESPOSTA (FILTRO + QUEBRA + ENVIO) ==========
async function processarResposta(phone, reply) {
  // 1. Filtro de palavras-veneno
  const limpo = filtrarPalavrasVeneno(reply);

  // 2. Quebra em até 2 mensagens (natural)
  const partes = quebrarMensagem(limpo);

  // 3. Envia cada parte com delayMessage (Z-API simula digitação)
  for (let i = 0; i < partes.length; i++) {
    const parte = partes[i];
    if (!parte || parte.length === 0) continue;
    // Primeira msg: delay 2s; segunda: delay 3s (mais natural)
    const delay = i === 0 ? 2 : 3;
    await sendZapiMessage(phone, parte, delay);
    // Pequeno aguardo entre mensagens locais (Z-API já delay nas duas pontas)
    if (i < partes.length - 1) await new Promise(r => setTimeout(r, 1500));
  }
}

// ========== MESSAGE QUEUE (DEBOUNCE) ==========
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

// ========== TRACKING (gclid, fbclid, utm) ==========
function captureTracking(phone, message) {
  if (userContext.has(phone)) return;
  const ctx = {};
  ['gclid', 'fbclid', 'ttclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
    .forEach(p => {
      const m = message.match(new RegExp(`${p}=([^\\s&\\]]+)`));
      if (m) ctx[p] = m[1];
    });
  if (Object.keys(ctx).length > 0) console.log(`📊 Tracking ${phone}:`, ctx);
  userContext.set(phone, ctx);
}

// ========== WEBHOOK ==========
app.post('/webhook', async (req, res) => {
  res.status(200).json({ ok: true });
  try {
    const data = req.body;

    // fromMe = mensagem enviada do número conectado (Felipe digitando no celular)
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
  version: '11.0',
  bot: 'Carlos GHDROL (MODO VENDEDOR PRO)',
  improvements_from_v10_2: [
    '✅ Prompt caching (90% economia em hits)',
    '✅ max_tokens: 150 (era 512)',
    '✅ Debounce 7s (era 4s)',
    '✅ Sliding window 12 msgs (era 20)',
    '✅ System prompt reescrito (persona BR, max 2 frases)',
    '✅ Filtro pós-LLM (palavras-veneno: ademais, contudo, etc)',
    '✅ Quebra em 2 mensagens com delayMessage (simula digitação)',
    '✅ Compliance ANVISA reforçado (DE, Viagra, testosterona)',
    '✅ Promo Época Pagamento 5+2 (atualizada da landing v15)',
    '✅ Function calling: sinalizar_compra + pedir_atendente',
    '✅ Persistência em JSON local (sobrevive a restart)'
  ],
  kit_destaque: 'PROMO 5+2 — R$448 (R$2,13/dia) — até 15/06',
  stats: {
    conversas: conversationMemory.size,
    processando: processingUser.size,
    manualModeAtivos: ownerManualMode.size,
    intencoesCompra: ctaSent.size,
    bufferPendente: Array.from(messageBuffer.entries()).filter(([_, v]) => v.length > 0).length
  }
}));

app.get('/health', (req, res) => {
  const healthy = !!(ZAPI_KEY && ZAPI_INSTANCE && ZAPI_CLIENT_TOKEN && CLAUDE_API_KEY);
  res.json({ status: healthy ? 'healthy' : 'unhealthy', version: '11.0' });
});

app.get('/stats', (req, res) => res.json({
  conversas: conversationMemory.size,
  processando: Array.from(processingUser.keys()),
  buffer: Array.from(messageBuffer.entries())
    .filter(([_, v]) => v.length > 0)
    .map(([phone, msgs]) => ({ phone, pendingMsgs: msgs.length })),
  manualMode: Array.from(ownerManualMode.entries()).map(([phone, m]) => ({
    phone,
    expiraEm: Math.floor((m.until - Date.now()) / 60000) + ' min',
    reason: m.reason
  })),
  messageCounts: Array.from(messageCount.entries()).map(([phone, count]) => ({ phone, trocas: count })),
  intencoesCompra: Array.from(ctaSent.entries()).map(([phone, data]) => ({
    phone,
    kit: data.kit_escolhido,
    nivel: data.nivel_interesse,
    quando: new Date(data.ts).toISOString()
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
  messageCount.delete(phone);
  ctaSent.delete(phone);
  persistCounter.delete(phone);
  if (debounceTimers.has(phone)) {
    clearTimeout(debounceTimers.get(phone));
    debounceTimers.delete(phone);
  }
  ownerManualMode.delete(phone);
  savePersistedConversations();
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

app.get('/intencoes', (req, res) => {
  // Lista clientes que sinalizaram intenção de compra (alta prioridade pra follow-up)
  const list = Array.from(ctaSent.entries())
    .map(([phone, data]) => ({
      phone,
      kit: data.kit_escolhido,
      nivel: data.nivel_interesse,
      quando: new Date(data.ts).toISOString(),
      minutosAtras: Math.floor((Date.now() - data.ts) / 60000)
    }))
    .sort((a, b) => a.minutosAtras - b.minutosAtras);
  res.json({ count: list.length, clientes: list });
});

app.get('/version', (req, res) => res.json({
  version: '11.0',
  modelo: 'claude-haiku-4-5-20251001',
  config: {
    debounce_ms: DEBOUNCE_MS,
    max_history: MAX_HISTORY,
    max_tokens: MAX_TOKENS,
    manual_mode_min: MANUAL_MODE_DURATION / 60000,
    prompt_caching: true
  },
  changes_from_v10_2: [
    '🔥 Prompt caching ativado (cache_control: ephemeral)',
    '🔥 max_tokens 512 → 150',
    '🔥 Debounce 4s → 7s',
    '🔥 Sliding window 20 → 12 msgs',
    '🔥 System prompt reescrito (persona BR, 2 frases máx)',
    '🔥 Filtro pós-LLM (ademais, contudo, lhe, prezado, etc)',
    '🔥 Quebra em 2 msgs com delayMessage 2-3s (Z-API simula digitação)',
    '🔥 Function calling (sinalizar_compra + pedir_atendente_humano)',
    '🔥 Compliance ANVISA reforçado',
    '🔥 Promo 5+2 (R$448) destacada — bate com landing v15',
    '🔥 Persistência em JSON (sobrevive restart)',
    '🔥 Auto-handoff quando cliente pede atendente humano',
    '🔧 Mantido: manual mode 30min, tracking gclid, sem nome, sem link'
  ]
}));

// ========== GRACEFUL SHUTDOWN ==========
process.on('SIGINT', () => {
  console.log('\n💾 Salvando conversas antes de fechar...');
  savePersistedConversations();
  process.exit(0);
});

process.on('SIGTERM', () => {
  savePersistedConversations();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  🤖 CARLOS v11.0 (MODO VENDEDOR PRO)   ║');
  console.log('║  🔥 Prompt Caching (90% economia)      ║');
  console.log('║  🔥 Max 2 frases, max 150 tokens       ║');
  console.log('║  🔥 Debounce 7s + Sliding 12 msgs      ║');
  console.log('║  🔥 Filtro palavras-veneno             ║');
  console.log('║  🔥 Function calling (CTA + handoff)   ║');
  console.log('║  🔥 PROMO 5+2 R$448 até 15/06          ║');
  console.log(`║  Porta: ${PORT}                          ║`);
  console.log('╚════════════════════════════════════════╝');
});
