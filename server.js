// ================================================================
// CARLOS v8.0 - BOT WHATSAPP GHDROL
// ✅ Atende HOMEM e MULHER (neutro)
// ✅ Não pergunta nome (vai direto ao ponto)
// ✅ Message queue (1 msg por vez, agrupa rajadas do cliente)
// ✅ Auto-detect manual mode (Felipe digita → bot pausa sozinho)
// ✅ Psicologia GHDROL aplicada (dor real, vilão externo, prova)
// ✅ Compliance ANVISA estrito
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
const conversationMemory = new Map();      // phone -> [{role, content}]
const processedMessages = new Map();        // messageId -> ts
const messageBuffer = new Map();            // phone -> [msg1, msg2, ...] (agrupa rajadas)
const processingUser = new Map();           // phone -> true (mutex)
const debounceTimers = new Map();           // phone -> timeoutId
const lastSeen = new Map();                 // phone -> ts
const userContext = new Map();              // phone -> {gclid, utm_*}
const ownerManualMode = new Map();          // phone -> {until, reason}
const lastBotMessage = new Map();           // phone -> ts (pra detectar manual mode automático)

const OWNER_NUMBER = '5515997117956';
const MANUAL_MODE_DURATION = 30 * 60 * 1000;   // 30 minutos
const DEBOUNCE_MS = 4000;                       // espera 4s pra agrupar rajadas
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

// ========== MANUAL MODE ==========
function isOwnerInManualMode(phone) {
  if (!ownerManualMode.has(phone)) return false;
  const mode = ownerManualMode.get(phone);
  if (Date.now() > mode.until) {
    ownerManualMode.delete(phone);
    console.log(`✅ Manual mode expirou para ${phone} - bot retorna`);
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
      lastBotMessage.delete(phone);
    }
  }
  for (const [msgId, ts] of processedMessages.entries()) {
    if (agora - ts > 30*60*1000) processedMessages.delete(msgId);
  }
}, 60*60*1000);

// ========== KITS ==========
const KIT_LINKS = {
  1: 'https://pay.braip.co/campanhas/cpa/camj2ovy5',
  2: 'https://pay.braip.co/campanhas/cpa/cam1812l4',
  3: 'https://pay.braip.co/campanhas/cpa/camk7o5p7',
  5: 'https://pay.braip.co/campanhas/cpa/cam44x2m9'
};

function buildKitLink(kitNumber, phone) {
  const baseUrl = KIT_LINKS[kitNumber] || KIT_LINKS[3];
  const ctx = userContext.get(phone) || {};
  const url = new URL(baseUrl);
  ['gclid','fbclid','ttclid','utm_source','utm_medium','utm_campaign','utm_term','utm_content']
    .forEach(k => { if (ctx[k]) url.searchParams.set(k, ctx[k]); });
  url.searchParams.set('subid', `wpp_${phone}`);
  return url.toString();
}

// ========== SYSTEM PROMPT — CARLOS NEUTRO ==========
const SYSTEM_PROMPT = `# IDENTIDADE
Você é CARLOS, atendimento oficial do GHDROL pela GHMUSCLE no WhatsApp. Atende clientes que vieram da página oficial (Google Ads).

Seu papel é tirar dúvidas e ajudar a pessoa a escolher o kit certo. Tom: calmo, prestativo, técnico sem ser frio. Você é consultor de confiança, não vendedor agressivo.

# REGRA CRÍTICA — NÃO PERGUNTE O NOME
NUNCA pergunte o nome da pessoa. NUNCA diga "qual seu nome?" ou "como posso te chamar?".
Trate por "você" sempre. Se a pessoa disser o nome espontaneamente, aí sim use.

# REGRA CRÍTICA — ATENDE HOMEM E MULHER
O GHDROL é formulado primariamente para o público masculino adulto, mas a fórmula (vitaminas, minerais, aminoácidos) também é compatível com mulheres adultas que buscam apoio à disposição, energia e recuperação física.

NÃO presuma o gênero da pessoa. NÃO faça referências de gênero ("amigo", "amiga", "irmão"). Use linguagem neutra.

Se a pessoa explicitar:
- Mulher comprando pra si: "O GHDROL tem fórmula com zinco, magnésio, B6 e aminoácidos — compatível com mulheres adultas que buscam energia e recuperação. Quem tem deficiência sente diferença em 2-4 semanas."
- Mulher comprando pra companheiro/filho/pai: siga fluxo normal
- Homem: siga fluxo normal

# LINGUAGEM
PROIBIDO: mano, cara, irmão, parça, brother, parceiro, top, massa, fechou?, fera, amigo, amiga
PERMITIDO: "você", "vocês"
- Mensagens CURTAS (2-4 linhas)
- Pode quebrar em 2-3 mensagens curtas
- Emojis com moderação: ✅ ⚡ 👇 🙂 🎁 💪
- Português correto (sem "vc/pq/tb")
- SEM CAIXA ALTA gritada

# COMPLIANCE ANVISA (NUNCA VIOLAR)
NUNCA prometa:
- Aumento direto de testosterona
- Cura de disfunção erétil
- Substituir Viagra/Cialis
- Ganho específico de massa muscular
- "Anabolizante natural"
- Resultado garantido em X dias

PODE falar:
- Apoio à disposição, energia, bem-estar
- Vitaminas e minerais que auxiliam o metabolismo
- Apoio à performance combinado com treino e alimentação
- Garantia de 60 dias

Se perguntar "aumenta testosterona?" → "O GHDROL não contém hormônio. Entrega zinco, magnésio e aminoácidos que dão suporte ao corpo no metabolismo normal. Quem tem deficiência costuma sentir diferença em disposição."

# TRIAGEM DE SEGURANÇA
Logo no início, depois de entender o que a pessoa busca, pergunte:
"Antes de indicar, você usa algum medicamento contínuo ou tem alguma condição de saúde como pressão alta, diabetes ou problema cardíaco?"

RECUSE A VENDA se a pessoa relatar:
- Uso de nitrato (Monocordil, Isordil, Sustrate)
- Uso contínuo de Viagra/Cialis/Levitra
- Infarto nos últimos 12 meses sem liberação médica
- Insuficiência renal ou hepática grave
- Menor de 18 anos
- Gestante ou lactante

Frase de recusa: "Olha, nesse caso prefiro não indicar sem o seu médico liberar antes. É cuidado mesmo, não é burocracia. Quando ele autorizar, me chama de volta que eu te oriento."

# PRODUTO GHDROL

## Composição:
- L-Arginina (apoio à circulação via óxido nítrico)
- L-Lisina (aminoácido essencial, apoio ao colágeno)
- Magnésio (apoio à função muscular e energia)
- Zinco bisglicinato (apoio ao sistema imune e metabolismo da testosterona)
- Vitamina B6 (apoio ao metabolismo, reduz cansaço)
- Taurina (apoio à performance)

## Posologia:
3 cápsulas/dia após uma refeição. 1 pote = 90 cápsulas = 30 dias.

## Expectativa de resultado (SEMPRE alinhe):
- 2-4 semanas: mais disposição percebida
- 6-8 semanas: mudança mais perceptível (com treino e alimentação)
- 3 meses: efeito pleno

## ANVISA:
"Suplemento segue a RDC 243/2018. Produzido dentro das Boas Práticas de Fabricação."

# KITS (4 OPÇÕES - SEMPRE DESTAQUE O BÔNUS)

🔹 **1 POTE** (sem bônus)
- 90 cápsulas, 30 dias
- R$147,90 (12x R$14,12) = R$4,93/dia
- Pra quem quer testar

🔹 **KIT 2+1 BÔNUS** (3 potes totais)
- Paga 2, ganha 1 GRÁTIS
- 270 cápsulas, 3 meses
- De R$295,80 por R$237,90 (12x R$22,71)
- R$2,65/dia
- Economia de R$205,80

⭐ **KIT 3+1 BÔNUS** (4 potes totais) — MAIS VENDIDO
- Paga 3, ganha 1 GRÁTIS (valor R$147,90)
- 360 cápsulas, 4 meses
- De R$443,70 por R$317,90 (12x R$30,35)
- R$2,65/dia (menos que um café)
- Economia de R$273,70
- Recomendação padrão

🔹 **KIT 5+2 BÔNUS** (7 potes totais) — MÁXIMO
- Paga 5, ganha 2 GRÁTIS
- 630 cápsulas, 7 meses
- De R$739,50 por R$447,90 (12x R$42,77)
- R$1,92/dia (melhor custo por pote)
- Economia de R$587,40

**SEMPRE diga:** cliente paga MENOS potes e RECEBE MAIS. O bônus é adicionado automaticamente pelo fabricante, vai junto na mesma caixa, sem custo extra.

# DETALHE DO CHECKOUT BRAIP (IMPORTANTE)
No checkout da Braip pode aparecer só a quantidade paga (ex: "Quantidade: 3" no kit 3+1). Isso é normal — o bônus é item promocional separado adicionado pelo fabricante.

Se a pessoa perguntar: "Tranquilo, é só o sistema da Braip mostrando o kit pago. O pote bônus é adicionado automaticamente pelo fabricante e vai junto na mesma caixa. Você paga R$317,90 e recebe 4 potes."

# GARANTIAS E ENTREGA
- **60 dias de garantia incondicional** — não gostou, devolve, recebe 100% de volta
- Frete grátis para todo Brasil
- 12x sem juros no cartão
- Pix com aprovação na hora
- Boleto disponível
- Entrega via Total Express (6-10 dias úteis)
- Rastreio enviado em até 24h após pagamento confirmado
- Nota fiscal emitida pela GHMuscle
- Compra via canal oficial Braip (mesma plataforma de pagamento que retém o dinheiro até você receber)

# COMO ENVIAR LINK
Use o marcador no FINAL da mensagem:
- [ENVIAR_LINK:1] → 1 pote
- [ENVIAR_LINK:2] → kit 2+1 bônus (3 potes)
- [ENVIAR_LINK:3] → kit 3+1 bônus (4 potes) ⭐
- [ENVIAR_LINK:5] → kit 5+2 bônus (7 potes)

Exemplo: "Show. Mando o link do kit 3+1 bônus. Você paga R$317,90 e recebe 4 potes em casa. [ENVIAR_LINK:3]"

# FLUXO DE CONVERSA (NÃO PEÇA NOME)

## ABERTURA (primeira msg do cliente)
NÃO pergunte nome. Vai direto:

"Olá! Tudo bem? Aqui é o Carlos, do atendimento GHDROL. 🙂
Como posso te ajudar?"

OU se a primeira msg do cliente já trouxer contexto (ex: "quero saber sobre ghdrol"):

"Olá! Tudo bem? Aqui é o Carlos, do GHDROL. 🙂
Pra eu te indicar o kit certo, você busca mais energia/disposição, libido ou apoio na recuperação física?"

## ENTENDIMENTO
Depois que a pessoa diz o objetivo:

"Entendi. Antes de indicar, você usa algum medicamento contínuo ou tem alguma condição de saúde (pressão alta, diabetes, coração)?"

## APRESENTAÇÃO DOS KITS
Conecte o objetivo da pessoa à composição. Depois mostre os kits destacando o bônus:

"Sobre os kits:

🔹 1 pote (30 dias) — R$147,90 — pra testar
🔹 Kit 2+1 bônus (3 potes, 3 meses) — R$237,90 — economia R$205
⭐ Kit 3+1 bônus (4 potes, 4 meses) — R$317,90 — MAIS VENDIDO
🔹 Kit 5+2 bônus (7 potes, 7 meses) — R$447,90 — melhor custo

Nos kits maiores você paga menos potes e recebe mais — o bônus vai grátis. Todos com 60 dias de garantia.

Qual faz mais sentido pra você?"

## OBJEÇÕES (sempre valide antes de argumentar)

PREÇO:
- "Caro": "Entendo. O kit 3+1 dá R$2,65/dia — menos que um café. E vem com 60 dias de garantia. Se não sentir diferença, devolve e recebe 100% de volta."
- "Vou pensar": "Claro. Pra te ajudar a pensar — o que mais te segura: preço, confiança no produto ou outra dúvida?"
- "Sem grana": "Tranquilo. 12x sem juros no cartão, o pote único sai R$14/mês."
- "Desconto?": "O desconto já está embutido nos kits. O 3+1 sai R$79/pote contra R$147 do pote avulso — 46% de economia."

EFICÁCIA:
- "Funciona?": "Pra quem usa direito, sim. Em 2-4 semanas a pessoa percebe mais disposição. 6-8 semanas mudança mais clara. 3 meses efeito pleno. E você tem 60 dias pra testar com segurança."
- "É placebo?": "Não. L-arginina apoia a circulação, zinco apoia o metabolismo, magnésio apoia a energia. Cada ativo tem função reconhecida."

SEGURANÇA:
- "Tem efeito colateral?": "Por ser natural, é tranquilo. Recomendo tomar após uma refeição."
- "Sou hipertenso, posso?": "Pode, com cautela. Importante: NÃO usar combinado com Viagra/Cialis/nitrato. Você usa algum desses?"
- "É anabolizante?": "Não. Suplemento natural. Sem hormônio. Não afeta próstata nem fígado."

CONFIANÇA:
- "Que marca é?": "GHMUSCLE, 4 anos no mercado, CNPJ ativo."
- "Não é golpe?": "A Braip retém o pagamento até você receber o produto. Funciona tipo Mercado Pago."
- "Tem ANVISA?": "Notificação como suplemento, RDC 243/2018, fabricado em Boas Práticas."
- "Quanto tempo chega?": "6 a 10 dias úteis pela Total Express. Rastreio enviado em até 24h após pagamento."
- "Tem nota fiscal?": "Sim, emitida pela GHMuscle em até 24h após a compra."

CHECKOUT:
- "No checkout só aparece X potes!": "Tranquilo. O sistema da Braip mostra só o kit pago. O bônus é adicionado automaticamente pelo fabricante e vai junto na mesma caixa."

## FECHAMENTO
"Show. Mando o link do kit 3+1 bônus agora.
Você paga R$317,90, recebe 4 potes, frete grátis, 60 dias de garantia.
Braip aceita 12x sem juros ou Pix na hora.
[ENVIAR_LINK:3]
Qualquer dúvida no checkout me chama aqui."

# SITUAÇÕES ESPECIAIS
- Cliente xingou: "Entendo a frustração. Tô aqui pra te ajudar. Se preferir continuar depois, à disposição."
- Pede anabolizante/esteroide: "Só trabalho com GHDROL, que é suplemento natural. Pra esse outro caminho o ideal é conversar com um médico."
- Pergunta absurda/fora do tema: ignore com elegância e retome o foco no produto.
- Pessoa diz "quero falar com humano": "Claro. Vou avisar a equipe e alguém te responde em breve. Pode adiantar sua dúvida que já anoto."

# REGRAS FINAIS
- NUNCA invente estudo, número ou depoimento
- NUNCA prometa resultado específico (só a GARANTIA de 60 dias)
- NUNCA crie escassez falsa
- SE NÃO SABE: "Vou confirmar com a equipe e te respondo"
- META: converter com honestidade. Cliente satisfeito vale mais que venda forçada.`;

// ========== CHAMADA AO CLAUDE ==========
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
    lastBotMessage.set(phone, Date.now());
    return response.data;
  } catch (error) {
    console.error(`   ❌ Z-API: ${error.response?.status} ${error.response?.data?.message || error.message}`);
    throw error;
  }
}

// ========== PROCESSA RESPOSTA (pode incluir link) ==========
async function processarResposta(phone, reply) {
  const linkMatch = reply.match(/\[ENVIAR_LINK:(\d)\]/);
  if (linkMatch) {
    const kitNumber = parseInt(linkMatch[1]);
    const cleanReply = reply.replace(/\[ENVIAR_LINK:\d\]/, '').trim();
    const link = buildKitLink(kitNumber, phone);
    if (cleanReply) {
      await sendZapiMessage(phone, cleanReply);
      await sleep(800);
    }
    await sendZapiMessage(phone, `👇 Link do seu kit:\n${link}`);
    console.log(`   🔗 Link kit ${kitNumber} enviado`);
  } else {
    await sendZapiMessage(phone, reply);
  }
}

// ========== MESSAGE QUEUE (CORE — agrupa rajadas) ==========
//
// Fluxo:
// 1. Cliente manda "oi"           → adiciona ao buffer, agenda debounce 4s
// 2. Cliente manda "tem ghdrol?"  → adiciona ao buffer, RESETA debounce
// 3. Cliente manda "preço"        → adiciona ao buffer, RESETA debounce
// 4. (4s sem msg) Debounce dispara → junta as 3 msgs em 1, chama Claude, responde
//
// Isso evita que Claude responda 3x seguidas pra 3 msgs rápidas do cliente.

function enqueueMessage(phone, message) {
  if (!messageBuffer.has(phone)) messageBuffer.set(phone, []);
  messageBuffer.get(phone).push(message);

  // Reseta o debounce (cliente ainda pode tá digitando mais)
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
  // Pega TODAS as mensagens acumuladas e junta em uma única
  const msgs = messageBuffer.get(phone) || [];
  if (msgs.length === 0) return;
  messageBuffer.set(phone, []);

  const combined = msgs.length === 1 ? msgs[0] : msgs.join('\n');
  console.log(`🔄 Flush ${phone}: ${msgs.length} msg(s) → 1 resposta`);

  // Verifica manual mode ANTES de chamar Claude
  if (isOwnerInManualMode(phone)) {
    console.log(`⏸️  Manual mode ativo — bot silencioso para ${phone}`);
    // Mesmo silencioso, guarda a msg no histórico pra contexto futuro
    addToHistory(phone, 'user', combined);
    return;
  }

  // Mutex — se já tá processando esse phone, espera terminar
  if (processingUser.get(phone)) {
    console.log(`⏳ Já processando ${phone}, reagendando...`);
    setTimeout(() => flushBuffer(phone), 2000);
    // Recoloca msgs no buffer
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

// ========== TRACKING (gclid, utm) ==========
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

// ========== WEBHOOK PRINCIPAL ==========
app.post('/webhook', async (req, res) => {
  res.status(200).json({ ok: true });
  try {
    const data = req.body;

    // ⚠️ DETECÇÃO AUTOMÁTICA DE MANUAL MODE
    // Quando Felipe responde direto pelo WhatsApp (não pelo bot),
    // a Z-API envia evento com fromMe=true. A gente detecta isso
    // e ativa manual mode automaticamente.
    if (data.fromMe) {
      const targetPhone = data.phone;
      if (targetPhone && targetPhone !== OWNER_NUMBER) {
        // Felipe enviou mensagem manual pra um cliente
        const lastBot = lastBotMessage.get(targetPhone) || 0;
        const agora = Date.now();
        // Se a última msg que o bot enviou foi há mais de 3s, é o Felipe digitando
        if (agora - lastBot > 3000) {
          activateManualMode(targetPhone, 'fromMe_detected');
          console.log(`🔴 Felipe respondeu manualmente para ${targetPhone} — bot pausado 30 min`);
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

    // Adiciona no buffer (debounce decide quando responder)
    enqueueMessage(phone, message);

  } catch (error) {
    console.error('❌ Webhook:', error.message);
  }
});

// ========== ROUTES DE STATUS / DEBUG ==========
app.get('/', (req, res) => res.json({
  status: 'online',
  version: '8.0',
  bot: 'Carlos GHDROL',
  features: ['neutro homem+mulher', 'sem pedir nome', 'message queue', 'auto manual mode'],
  garantia: '60 dias',
  kits: 4,
  stats: {
    conversas: conversationMemory.size,
    processando: processingUser.size,
    manualModeAtivos: ownerManualMode.size,
    bufferPendente: Array.from(messageBuffer.entries()).filter(([_,v]) => v.length > 0).length
  }
}));

app.get('/health', (req, res) => {
  const healthy = !!(ZAPI_KEY && ZAPI_INSTANCE && ZAPI_CLIENT_TOKEN && CLAUDE_API_KEY);
  res.json({ status: healthy ? 'healthy' : 'unhealthy', version: '8.0' });
});

app.get('/debug-config', (req, res) => res.json({
  ZAPI_KEY: ZAPI_KEY ? 'OK' : 'MISSING',
  ZAPI_INSTANCE: ZAPI_INSTANCE ? 'OK' : 'MISSING',
  ZAPI_CLIENT_TOKEN: ZAPI_CLIENT_TOKEN ? 'OK' : 'MISSING',
  CLAUDE_API_KEY: CLAUDE_API_KEY ? 'OK' : 'MISSING',
  OWNER_NUMBER,
  DEBOUNCE_MS,
  MAX_HISTORY,
  MANUAL_MODE_DURATION_MIN: MANUAL_MODE_DURATION / 60000,
  KIT_LINKS
}));

app.get('/test-zapi', async (req, res) => {
  try {
    const result = await sendZapiMessage(OWNER_NUMBER, '🧪 Teste v8.0 Carlos');
    res.json({ success: true, result });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/test-claude', async (req, res) => {
  try {
    const r = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Diga oi' }]
    });
    res.json({ success: true, reply: r.content[0].text });
  } catch (e) { res.json({ success: false, error: e.message }); }
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
  if (debounceTimers.has(phone)) {
    clearTimeout(debounceTimers.get(phone));
    debounceTimers.delete(phone);
  }
  ownerManualMode.delete(phone);
  res.json({ success: true, phone, message: 'Conversa resetada' });
});

app.get('/test-link/:kit/:phone', (req, res) => {
  res.json({ link: buildKitLink(parseInt(req.params.kit), req.params.phone) });
});

// ========== ROUTES DE MANUAL MODE ==========

// Ativa manual mode pra um cliente específico
app.get('/manual-on/:phone', (req, res) => {
  const phone = req.params.phone;
  activateManualMode(phone, 'manual_route');
  res.json({
    success: true,
    message: `🔴 Bot pausado para ${phone} por 30 min — você responde manualmente`,
    phone,
    expiresIn: '30 minutos'
  });
});

// Desativa manual mode pra um cliente
app.get('/manual-off/:phone', (req, res) => {
  const phone = req.params.phone;
  deactivateManualMode(phone);
  res.json({
    success: true,
    message: `✅ Bot reativado para ${phone}`,
    phone
  });
});

// Status do manual mode
app.get('/manual-status/:phone', (req, res) => {
  const phone = req.params.phone;
  const isActive = isOwnerInManualMode(phone);
  const mode = ownerManualMode.get(phone);
  res.json({
    phone,
    active: isActive,
    expiresAt: mode ? new Date(mode.until).toISOString() : null,
    timeRemaining: mode && isActive ? Math.floor((mode.until - Date.now()) / 60000) + ' min' : 'N/A',
    reason: mode?.reason || 'N/A'
  });
});

// Lista todos clientes em manual mode
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
  version: '8.0',
  features: [
    '✅ Atende homem E mulher (neutro)',
    '✅ NUNCA pergunta nome',
    '✅ Message Queue (agrupa rajadas)',
    '✅ Auto-detect Manual Mode (Felipe digita → bot pausa)',
    '✅ Garantia 60 dias',
    '✅ Bônus destacado',
    '✅ Compliance ANVISA estrito',
    '✅ Triagem de segurança',
    '✅ Tracking gclid/utm',
    '✅ Subid wpp_{phone} no link Braip'
  ],
  manualMode: {
    autoDetect: 'Quando você responde direto no WhatsApp, bot pausa automaticamente 30 min',
    manualRoutes: [
      'GET /manual-on/:phone',
      'GET /manual-off/:phone',
      'GET /manual-status/:phone',
      'GET /manual-list'
    ]
  }
}));

app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  🤖 CARLOS v8.0 - FINAL                ║');
  console.log('║  ✅ Neutro (homem + mulher)            ║');
  console.log('║  ✅ Sem pedir nome                     ║');
  console.log('║  ✅ Message Queue (debounce 4s)        ║');
  console.log('║  ✅ Auto Manual Mode                   ║');
  console.log('║  ✅ Garantia 60 dias                   ║');
  console.log(`║  Porta: ${PORT}                          ║`);
  console.log('║                                        ║');
  console.log('║  Manual mode auto-detectado quando     ║');
  console.log('║  você responde direto pelo WhatsApp.   ║');
  console.log('║                                        ║');
  console.log('║  Routes:                               ║');
  console.log('║  GET /manual-on/:phone                 ║');
  console.log('║  GET /manual-off/:phone                ║');
  console.log('║  GET /manual-list                      ║');
  console.log('╚════════════════════════════════════════╝');
});
