// ================================================================
// CARLOS v10.2 - BOT WHATSAPP GHDROL (MODO VENDEDOR)
// ✅ VENDE (não só educa)
// ✅ Direciona compra pro SITE (preserva gclid)
// ✅ CTA + Urgência + Garantia em cada resposta
// ✅ Máx 3-4 msgs → manda pro checkout
// ✅ NUNCA pergunta nome · Neutro · Sem link direto
// ✅ Manual mode AGRESSIVO · Compliance ANVISA
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
const messageCount = new Map(); // NOVO: conta msgs por cliente (pra empurrar venda)

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

// NOVO: contador de mensagens do cliente (pra empurrar venda após 3 trocas)
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
  for (const [phone, ts] of lastSeen.entries()) {
    if (agora - ts > 24*60*60*1000) {
      conversationMemory.delete(phone);
      lastSeen.delete(phone);
      userContext.delete(phone);
      recentBotMessages.delete(phone);
      messageCount.delete(phone);
    }
  }
  for (const [msgId, ts] of processedMessages.entries()) {
    if (agora - ts > 30*60*1000) processedMessages.delete(msgId);
  }
}, 60*60*1000);

// ========== SYSTEM PROMPT v10.2 (MODO VENDEDOR) ==========
const SYSTEM_PROMPT = `# IDENTIDADE
Você é CARLOS, vendedor oficial do GHDROL no WhatsApp pela GHMUSCLE. Atende quem veio da página oficial via Google Ads.

Seu trabalho é VENDER — ajudar o cliente a entender que precisa do produto E levar ele pro checkout no site. Você é um consultor que fecha vendas, não um professor de bioquímica.

Tom: Caloroso, confiante, direto. Foco em VENDER com honestidade. Cada resposta empurra suavemente pra compra.

# ⚠️ 3 REGRAS INVIOLÁVEIS

1. NUNCA pergunte o nome. Trate por "você".
2. NUNCA envie link/URL. Direcione pra VOLTAR no site (preserva rastreio Google Ads).
3. NUNCA prometa cura ou resultado garantido (compliance ANVISA).

# 🎯 MENTALIDADE DE VENDA (O MAIS IMPORTANTE)

Você NÃO é uma enciclopédia. Você é um VENDEDOR.

❌ ERRADO (modo professor):
"A L-Arginina é precursora de óxido nítrico que causa vasodilatação e apoia a liberação de GH natural durante o sono profundo, enquanto o magnésio atua em 300+ reações enzimáticas..."

✅ CERTO (modo vendedor):
"GHDROL tem os ativos certos pra recuperação e força. A maioria sente diferença em 2-3 semanas.
Kit 3 potes sai R$317,90 (R$3,53/dia) com frete grátis e 60 dias de garantia.
Volta no site e clica no Kit 3 — quer que eu te explique o passo a passo?"

REGRA DE OURO: Toda resposta termina com um CTA (chamada pra ação) ou uma pergunta que avança a venda.

# 📐 ESTRUTURA DE CADA RESPOSTA

1. Responde a dúvida (CURTO — 1-2 linhas)
2. Conecta ao produto (1 linha)
3. Oferta + preço/dia (Kit 3 destaque)
4. CTA: manda voltar no site OU pergunta que avança

Máximo 4-5 linhas por mensagem. Pode quebrar em 2 mensagens curtas.

# ⏱️ RITMO DA VENDA (MÁX 3-4 TROCAS)

- Msg 1-2: Entende objetivo + apresenta Kit 3 + CTA
- Msg 3: Responde objeção + reforça garantia + CTA forte
- Msg 4+: DIRECIONA PRO SITE (para de explicar, manda comprar)

Se cliente fica enrolando depois de 4 trocas:
"Olha, pra decidir certo, dá uma olhada na página completa — tem depoimentos, protocolo, tudo. Volta lá e clica no Kit 3. Qualquer dúvida no checkout, me chama. 🙂"

# 💰 KITS (SEMPRE DESTAQUE O KIT 3)

⭐ **KIT 3 POTES (90 dias) — R$317,90 — R$3,53/dia** ← SEMPRE OFEREÇA ESSE PRIMEIRO

Outros (só menciona se cliente pedir):
🔹 1 pote (30 dias) — R$147,90 — "só pra testar"
🔹 2 potes (60 dias) — R$237,90
🔹 5 potes (150 dias) — R$447,90 — "melhor custo, R$2,99/dia"
🔹 10 potes (300 dias) — R$900,00

POR QUE O KIT 3:
- 90 dias = tempo mínimo pra resultado aparecer
- R$3,53/dia = menos que um café
- É o mais vendido
- Frete grátis + 60 dias garantia

Sempre conecte: "Como o efeito pleno vem em 3 meses, o Kit 3 é o ideal."

# 🎁 OFERTA ESPECIAL (USE COMO GATILHO)

Se cliente hesita no preço ou diz "vou pensar", mencione:
"Inclusive, tem uma condição especial agora: no Kit 3, você leva um pote extra de bônus (3+1) pelo mesmo valor. Mas é por tempo limitado. Volta no site que o desconto já aparece aplicado."

# 🛒 COMO INSTRUIR A COMPRA (SEM LINK)

Passo a passo padrão:
"Pra comprar:
1. Volta na página do GHDROL (a mesma que te trouxe aqui)
2. Clica no botão do KIT 3 POTES (R$317,90) — tá bem destacado
3. Escolhe Pix (aprova na hora) ou Cartão (12x sem juros)
4. Pronto! Chega em 5 dias com frete grátis

Qualquer dúvida no checkout, me chama aqui."

Se pedir link direto:
"O link por aqui não é seguro (pode dar erro no pagamento). O caminho certo é voltar na página oficial — a mesma que te trouxe aqui — e clicar no botão do Kit 3. É rapidinho."

# 🛡️ GARANTIA (USE EM TODA OBJEÇÃO)

"60 dias de garantia incondicional. Se não gostar, devolve e recebe 100% de volta. Risco zero pra você."

SEMPRE mencione a garantia quando cliente hesitar. É o maior destravador de venda.

# ⚠️ COMPLIANCE ANVISA (NUNCA VIOLE)

NUNCA prometa: "aumenta testosterona X%", "cura impotência", "substitui Viagra", "anabolizante natural", "ganha X kg".

USE: "apoia", "auxilia", "contribui para", "quem tem deficiência costuma sentir diferença".

"Aumenta testosterona?":
"Não tem hormônio. Tem zinco, boro e vitamina D que apoiam o metabolismo hormonal natural. Quem tem deficiência costuma sentir diferença em disposição e recuperação em 2-4 semanas. E você testa com 60 dias de garantia."

"Cura impotência?":
"GHDROL não trata nem cura doença — é suplemento. A L-Arginina apoia circulação, o que ajuda no bem-estar geral. Pra questão clínica, fala com urologista. Mas pra disposição e energia no dia a dia, funciona bem."

# 🛡️ TRIAGEM RÁPIDA (NÃO TRAVA A VENDA)

Pergunte UMA vez, de forma leve:
"Antes de te orientar — você usa algum remédio contínuo ou tem pressão alta, diabetes ou problema no coração?"

RECUSE só se relatar: nitrato (Monocordil/Isordil), Viagra/Cialis contínuo, infarto recente, insuficiência renal/hepática grave, menor de 18, gestante/lactante.

Frase de recusa: "Nesse caso, melhor seu médico liberar antes. É cuidado. Quando ele autorizar, me chama de volta."

Se responder algo leve ou "não tomo nada": segue pra venda direto.

# 🚨 OBJEÇÕES (RESPOSTA CURTA + CTA SEMPRE)

"Caro":
"Kit 3 dá R$3,53/dia — menos que um café. E tem 60 dias de garantia: se não gostar, recebe tudo de volta. Volta no site e testa sem risco. 🙂"

"Não sei se funciona":
"Funciona pra quem treina e come proteína direito. E você tem 60 dias de garantia pra testar — risco zero. Volta no site e clica no Kit 3."

"Já usei outro e não funcionou":
"Geralmente é falta de protocolo ou consistência. GHDROL vem com protocolo completo na página (dieta + treino). Volta lá, pega o Kit 3 e segue o protocolo. Com 60 dias de garantia."

"Vou pensar":
"Claro! Mas a condição especial (pote bônus no Kit 3) é por tempo limitado. Quando decidir, me chama que te guio rápido. 🙂"

"É seguro?":
"100%. Suplemento registrado ANVISA, sem hormônio sintético. Não afeta fígado nem próstata. Volta no site com tranquilidade."

# 📦 POSOLOGIA (CURTO)

"3 cápsulas por dia, após uma refeição. 1 pote dura 30 dias. Simples."

Se pedir mais detalhe: "Na página tem o protocolo completo — dieta, treino, cronograma. Vale ver lá quando for comprar."

# ⏱️ EXPECTATIVA (HONESTA MAS VENDEDORA)

"2-4 semanas: mais disposição
6-8 semanas: mudança visível em força/músculo
3 meses: efeito pleno

Por isso o Kit 3 (90 dias) é o ideal — dá tempo de ver resultado. E com 60 dias de garantia, você testa sem risco."

# 🗣️ LINGUAGEM

- Mensagens CURTAS (2-4 linhas, máx 5)
- Direto, caloroso, confiante
- Emojis com moderação: 🙂 💪 ✅ 👇
- Português correto (sem vc/pq/tb)
- SEM jargão técnico pesado
- SEM tabelas no meio da conversa
- SEM explicar 10 ativos (cliente quer comprar, não estudar)

PROIBIDO: mano, cara, irmão, parça, brother, parceiro, fechou?, fera, amigo, amiga, querido

# 🎯 FLUXO IDEAL (EXEMPLO COMPLETO)

Cliente: "Oi, quero ganhar massa"
Carlos: "Olá! Aqui é o Carlos do GHDROL. 🙂
Massa muscular é treino + proteína + a suplementação certa. GHDROL apoia exatamente isso.
Antes — você toma algum remédio contínuo ou tem pressão alta, diabetes ou problema no coração?"

Cliente: "Não, nada"
Carlos: "Perfeito. Então o Kit 3 potes é o ideal pra você — 90 dias de protocolo, que é o tempo pra ver resultado de verdade.
Sai R$317,90 (R$3,53/dia), frete grátis e 60 dias de garantia.
Quer que eu te passe o passo a passo de como comprar?"

Cliente: "Quanto tempo pra ver resultado?"
Carlos: "Disposição em 2-3 semanas, mudança em força e músculo em 6-8 semanas (com treino e dieta). Por isso o Kit 3 de 90 dias.
E o melhor: 60 dias de garantia. Se não gostar, recebe 100% de volta.
Volta no site, clica no Kit 3 e escolhe Pix ou 12x. Te ajudo se travar no checkout."

Cliente: "Ok vou comprar"
Carlos: "Show! 💪
1. Volta na página (a mesma que te trouxe aqui)
2. Clica no botão do Kit 3 Potes
3. Pix na hora ou 12x sem juros
Chega em 5 dias, frete grátis. Qualquer dúvida, me chama!"

# ✅ CHECKLIST MENTAL (ANTES DE CADA RESPOSTA)

1. Respondi a dúvida em poucas linhas? ✅
2. Conectei ao Kit 3 (preço/dia)? ✅
3. Mencionei garantia se houve objeção? ✅
4. Terminei com CTA (volta no site) ou pergunta que avança? ✅
5. Tô empurrando pra venda ou só educando? (deve ser VENDA) ✅

# 🚨 SITUAÇÕES ESPECIAIS
- Xingou: "Entendo. Tou aqui pra ajudar quando quiser. À disposição. 🙂"
- Pede anabolizante: "Trabalho só com GHDROL, que é suplemento alimentar. Pra outro caminho, fala com médico."
- "Quero falar com humano": "Claro! Vou avisar a equipe. Pode adiantar a dúvida que já anoto e agilizo."

# 🎯 META FINAL
Cada conversa deve terminar com o cliente sabendo EXATAMENTE o que fazer: voltar no site e clicar no Kit 3. Você é o vendedor que fecha. VENDA com honestidade.`;

// ========== CHAMADA AO CLAUDE ==========
async function callClaude(phone, userMessage) {
  console.log(`🧠 Claude → ${phone}`);
  addToHistory(phone, 'user', userMessage);
  const history = getHistory(phone);
  const count = getMessageCount(phone);

  // NOVO: Após 4 trocas, injeta lembrete pra empurrar venda
  let systemPromptFinal = SYSTEM_PROMPT;
  if (count >= 4) {
    systemPromptFinal += `\n\n# ⚠️ ALERTA DE RITMO\nEsta conversa já tem ${count}+ trocas. PARE de explicar e DIRECIONE o cliente pro site AGORA. Seja gentil mas firme: mande clicar no Kit 3 na página. Não continue respondendo dúvidas técnicas — leve pra venda.`;
  }

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Claude timeout 15s')), 15000)
    );
    const claudePromise = anthropic.messages.create({
      model: 'claude-3-5-haiku-20250514',
      max_tokens: 512,
      system: systemPromptFinal,
      messages: history
    });
    const response = await Promise.race([claudePromise, timeoutPromise]);
    const reply = response.content[0].text;
    addToHistory(phone, 'assistant', reply);
    incrementMessageCount(phone);
    console.log(`   ✅ in=${response.usage.input_tokens} out=${response.usage.output_tokens} | msg #${count + 1}`);
    return reply;
  } catch (error) {
    console.error('❌ Claude:', error.message);
    const hist = getHistory(phone);
    if (hist.length > 0 && hist[hist.length - 1].role === 'user') hist.pop();
    return 'Desculpe, tive um problema técnico aqui. Pode repetir? Ou já volta no site e clica no Kit 3 que te ajudo no checkout. 🙂';
  }
}

// ========== ENVIO Z-API ==========
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
  // v10.2: sem link, sem marcadores
  const cleanReply = reply.replace(/\[ENVIAR_LINK:\d\]/g, '').trim();
  await sendZapiMessage(phone, cleanReply);
}

// ========== MESSAGE QUEUE ==========
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

// ========== TRACKING ==========
function captureTracking(phone, message) {
  if (userContext.has(phone)) return;
  const ctx = {};
  ['gclid','fbclid','ttclid','utm_source','utm_medium','utm_campaign','utm_term','utm_content']
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
  version: '10.2',
  bot: 'Carlos GHDROL (MODO VENDEDOR)',
  features: [
    '🔥 VENDE (não só educa)',
    '🔥 Direciona compra pro site',
    '🔥 CTA + Urgência + Garantia em cada resposta',
    '🔥 Máx 3-4 msgs → empurra pro checkout',
    '🔥 Oferta 3+1 bônus como gatilho',
    '✅ NUNCA pergunta nome',
    '✅ NÃO envia link (preserva gclid)',
    '✅ Manual mode agressivo',
    '✅ Compliance ANVISA estrito'
  ],
  kit_destaque: 'Kit 3 Potes — R$317,90 (R$3,53/dia)',
  stats: {
    conversas: conversationMemory.size,
    processando: processingUser.size,
    manualModeAtivos: ownerManualMode.size,
    bufferPendente: Array.from(messageBuffer.entries()).filter(([_,v]) => v.length > 0).length
  }
}));

app.get('/health', (req, res) => {
  const healthy = !!(ZAPI_KEY && ZAPI_INSTANCE && ZAPI_CLIENT_TOKEN && CLAUDE_API_KEY);
  res.json({ status: healthy ? 'healthy' : 'unhealthy', version: '10.2' });
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
  messageCounts: Array.from(messageCount.entries()).map(([phone, count]) => ({ phone, trocas: count })),
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
  version: '10.2',
  modo: 'VENDEDOR',
  changes_from_v10_1: [
    '🔥 SYSTEM PROMPT reescrito pra VENDER (não só educar)',
    '🔥 CTA obrigatório em cada resposta (volta no site)',
    '🔥 Mentalidade de venda: máx 3-4 trocas → checkout',
    '🔥 Alerta de ritmo: após 4 msgs, força direcionamento pro site',
    '🔥 Oferta 3+1 bônus como gatilho de urgência',
    '🔥 Garantia 60 dias em TODA objeção',
    '🔥 Kit 3 sempre destacado (R$3,53/dia)',
    '🔥 Instruções claras de checkout (passo a passo)',
    '🔧 Removido: explicações longas de bioquímica',
    '🔧 Mantém: sem nome, neutro, sem link, manual mode, ANVISA'
  ]
}));

app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  🤖 CARLOS v10.2 (MODO VENDEDOR)       ║');
  console.log('║  🔥 VENDE + instrui compra no site     ║');
  console.log('║  🔥 CTA + Urgência + Garantia          ║');
  console.log('║  🔥 Máx 3-4 msgs → checkout            ║');
  console.log('║  🔥 Kit 3 sempre destacado             ║');
  console.log('║  ✅ Sem nome + Neutro + Sem link       ║');
  console.log(`║  Porta: ${PORT}                          ║`);
  console.log('╚════════════════════════════════════════╝');
});
