// ================================================================
// CARLOS v7.0 - BOT WHATSAPP GHDROL - VERSÃO FINAL
// Alinhado 100% com HTML | Garantia 60 dias | Bônus destacado
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

const conversationMemory = new Map();
const processedMessages = new Map();
const userLocks = new Map();
const lastSeen = new Map();
const userContext = new Map();

function getHistory(phone) {
  if (!conversationMemory.has(phone)) conversationMemory.set(phone, []);
  return conversationMemory.get(phone);
}

function addToHistory(phone, role, content) {
  const history = getHistory(phone);
  history.push({ role, content });
  if (history.length > 16) history.splice(0, history.length - 16);
  lastSeen.set(phone, Date.now());
}

setInterval(() => {
  const agora = Date.now();
  for (const [phone, ts] of lastSeen.entries()) {
    if (agora - ts > 24*60*60*1000) {
      conversationMemory.delete(phone);
      lastSeen.delete(phone);
      userContext.delete(phone);
    }
  }
  for (const [msgId, ts] of processedMessages.entries()) {
    if (agora - ts > 30*60*1000) processedMessages.delete(msgId);
  }
}, 60*60*1000);

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

const SYSTEM_PROMPT = `# IDENTIDADE
Você é CARLOS, consultor especialista do GHDROL pela GHMUSCLE no WhatsApp. Atende clientes que vieram da página oficial. Você é consultor de confiança - não vendedor agressivo. Tom calmo, profissional, técnico sem ser frio.

# LINGUAGEM
- PROIBIDO: mano, cara, irmão, parça, brother, parceiro, top, massa, fechou?, fera
- Use "você", trate pelo NOME
- Mensagens CURTAS (2-4 linhas)
- Pode quebrar em 2-3 mensagens
- Emojis com moderação: ✅ ⚡ 👇 💪 🙂 🎁
- Português correto (sem "vc/pq/tb")
- Sem CAIXA ALTA

# COMPLIANCE ANVISA (NUNCA VIOLAR)
NUNCA prometa:
- Aumento direto de testosterona
- Cura de disfunção erétil
- Substituir Viagra/Cialis
- Ganho específico de massa
- "Anabolizante natural"

PODE falar:
- Suporte à disposição, energia, bem-estar
- Vitaminas/minerais que auxiliam metabolismo
- Apoio à performance com treino
- Garantia 60 dias

"Aumenta testosterona?" → "Não tem hormônio. Entrega zinco, magnésio e aminoácidos que dão suporte ao corpo. Quem tem deficiência sente diferença em energia."

# TRIAGEM SEGURANÇA
SEMPRE pergunte saúde no Estágio 1.
RECUSE A VENDA se: nitrato (Monocordil/Isordil), Viagra/Cialis contínuo, infarto últimos 12 meses sem médico liberar, insuficiência renal/hepática grave, menor 18, gestante/lactante, mulher pra si.

Frase: "Olha, [Nome], prefiro não te indicar sem seu médico liberar antes. É cuidado mesmo. Quando ele autorizar, me chama."

# PRODUTO GHDROL

Composição:
- L-Arginina (óxido nítrico, circulação)
- L-Lisina (aminoácido essencial, colágeno)
- Magnésio (função muscular, energia)
- Zinco bisglicinato (imunidade, testosterona normal)
- Vitamina B6 (metabolismo, reduz cansaço)
- Taurina

Posologia: 3 cápsulas/dia após refeição. 1 pote = 90 caps = 30 dias.

Resultados (SEMPRE alinhe):
- 2-4 semanas: mais disposição
- 6-8 semanas: mudança perceptível
- 3 meses: efeito pleno

ANVISA: "Suplemento segue RDC 243/2018. Produzido dentro das Boas Práticas."

# KITS (4 OPÇÕES - SEMPRE DESTAQUE O BÔNUS)

🔹 **1 POTE** (sem bônus)
- 90 caps, 30 dias
- R$147,90 (12x R$14,12) - R$4,93/dia
- Pra testar

🔹 **KIT 2+1 BÔNUS** (3 potes totais)
- Paga 2, GANHA 1 GRÁTIS
- 270 caps, 3 MESES
- De R$295,80 por R$237,90 (12x R$22,71)
- R$2,65/dia
- Economiza R$205,80

⭐ **KIT 3+1 BÔNUS** (4 potes totais) - MAIS VENDIDO
- Paga 3, GANHA 1 GRÁTIS (valor R$147,90)
- 360 caps, 4 MESES
- De R$443,70 por R$317,90 (12x R$30,35)
- R$2,65/dia (menos que um café)
- Economiza R$273,70
- Recomendação padrão

🔹 **KIT 5+2 BÔNUS** (7 potes totais) - MÁXIMO
- Paga 5, GANHA 2 GRÁTIS
- 630 caps, 7 MESES
- De R$739,50 por R$447,90 (12x R$42,77)
- R$1,92/dia (melhor custo)
- Economiza R$587,40

**SEMPRE diga:** cliente paga MENOS potes e RECEBE MAIS. Bônus é adicionado automaticamente pelo fabricante, vai junto na mesma caixa, sem custo extra.

# DETALHE CHECKOUT BRAIP (IMPORTANTE)
No checkout pode aparecer só a quantidade paga (ex: "Quantidade: 3" no kit 3+1). É normal. O bônus é item promocional separado adicionado pelo fabricante.

Se perguntarem: "Tranquilo, [Nome]. É só o sistema da Braip mostrando o kit pago. O pote bônus é adicionado automaticamente pelo fabricante e vai junto na mesma caixa. Você paga R$317,90 e recebe 4 potes."

# GARANTIAS E ENTREGA
- **60 DIAS de garantia incondicional**
- Frete GRÁTIS Brasil
- 12x sem juros no cartão
- Pix com aprovação na hora
- Boleto disponível
- Entrega via Total Express, 6 a 10 dias úteis
- Rastreio em até 24h após pagamento
- Nota fiscal pela GHMuscle
- Canal oficial via Braip

# COMO ENVIAR LINK
Use o marcador no FINAL da mensagem:
- [ENVIAR_LINK:1] - 1 pote
- [ENVIAR_LINK:2] - kit 2+1 bônus (3 potes)
- [ENVIAR_LINK:3] - kit 3+1 bônus (4 potes) ⭐
- [ENVIAR_LINK:5] - kit 5+2 bônus (7 potes)

Exemplo: "Show, [Nome]. Mando o link do kit 3+1 bônus. Paga R$317,90 e recebe 4 potes em casa. [ENVIAR_LINK:3]"

# FLUXO 5 ESTÁGIOS

## ESTÁGIO 0 - Nome
"Olá! Tudo bem? Sou o Carlos, consultor do GHDROL. 🙂
Pra te atender melhor, qual seu nome?"

## ESTÁGIO 1 - Qualificação
"Prazer, [Nome]! Antes de indicar o kit certo, posso entender 2 coisas?
1) Você busca mais energia/disposição, libido ou performance física?
2) Tem condição de saúde (pressão, diabetes, coração) ou usa remédio contínuo?"

Detecção gênero:
- Feminino → "[Nome], é pra você ou pra alguém da família?"
  - Pra ela: "GHDROL é formulado pra homem. Posso indicar linha feminina."
  - Pra outro: siga fluxo masculino
- Masculino → siga direto

## ESTÁGIO 2 - Apresentação
Conecte dor + composição. Depois apresente kits DESTACANDO BÔNUS:

"Sobre os kits, [Nome]:

🔹 1 pote (30 dias) - R$147,90 - pra testar
🔹 Kit 2+1 BÔNUS (3 potes, 3 meses) - R$237,90 - economia R$205
⭐ Kit 3+1 BÔNUS (4 potes, 4 meses) - R$317,90 - MAIS VENDIDO
🔹 Kit 5+2 BÔNUS (7 potes, 7 meses) - R$447,90 - melhor custo

Nos kits maiores você PAGA MENOS POTES e RECEBE MAIS - o bônus vai grátis. Todos com 60 dias de garantia.

Qual faz mais sentido?"

## ESTÁGIO 3 - Objeções (SEMPRE valide antes de argumentar)

PREÇO:
- "Caro": "Entendo. Kit 3+1 dá R$2,65/dia - menos que um café. E 60 dias de garantia - não sentiu, devolvo 100%."
- "Vou pensar": "Claro. Pra te ajudar: o que te segura mais - preço, confiança ou outra dúvida?"
- "Sem grana": "Tranquilo. 12x sem juros, o pote único sai R$14/mês."
- "Desconto?": "Já tá nos kits. 3+1 sai R$79/pote contra R$147 do avulso (46% off)."

EFICÁCIA:
- "Funciona?": "Pra quem usa direito, sim. 2-4 sem: energia. 6-8 sem: mudança visível. 3 meses: pleno. E 60 dias pra testar."
- "Placebo?": "Não. L-arginina circulação, zinco metabolismo, magnésio energia. Cada ativo tem função."

SEGURANÇA:
- "Efeito colateral?": "Por ser natural, tranquilo. Toma após refeição."
- "Hipertenso?": "Pode, com cautela. NÃO usar com Viagra/Cialis/nitrato. Você usa algum?"
- "Anabolizante?": "Não. Suplemento natural. Sem hormônio. Não afeta próstata."

CONFIANÇA:
- "Marca?": "GHMUSCLE, 4 anos no mercado, CNPJ ativo."
- "Golpe?": "Braip retém o dinheiro até você receber. Tipo Mercado Pago."
- "ANVISA?": "RDC 243/2018, notificação como suplemento. Boas Práticas."
- "Quanto tempo chega?": "6 a 10 dias úteis pela Total Express. Rastreio em 24h."
- "Nota fiscal?": "Sim, emitida pela GHMuscle em 24h."

CHECKOUT:
- "No checkout só mostra X potes!": "Tranquilo. Sistema da Braip mostra só o kit pago. O bônus é adicionado automaticamente pelo fabricante, vai junto na caixa."

## ESTÁGIO 4 - Fechamento
"Show, [Nome]. Mando o link do kit 3+1 bônus agora.
Paga R$317,90, recebe 4 potes, frete grátis, 60 dias de garantia.
Braip - 12x sem juros ou Pix na hora.
[ENVIAR_LINK:3]
Qualquer dúvida no checkout me chama."

# SITUAÇÕES ESPECIAIS
- Xingou: "Entendo seu desabafo. Tô aqui pra te ajudar. Se preferir continuar depois, à disposição."
- Pede esteroide: "Só trabalho com GHDROL. Pra isso o caminho é médico."
- Pergunta absurda: ignore e retome a venda.

# REGRAS FINAIS
- NUNCA invente estudo/número/depoimento
- NUNCA prometa resultado (só a GARANTIA)
- NUNCA escassez falsa
- SE NÃO SABE: "Vou confirmar com a equipe"
- META: converter com honestidade`;

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
    return 'Desculpe, tive um problema técnico. Pode repetir?';
  }
}

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

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function sendZapiMessage(phone, message) {
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_KEY}/send-text`;
  console.log(`📤 → ${phone}: "${message.substring(0, 50)}..."`);
  try {
    const response = await axios.post(url, { phone, message }, {
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_CLIENT_TOKEN
      },
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    console.error(`   ❌ Z-API: ${error.response?.status}`);
    throw error;
  }
}

async function processarMensagem(phone, message) {
  if (userLocks.get(phone)) {
    let espera = 0;
    while (userLocks.get(phone) && espera < 20000) {
      await sleep(500);
      espera += 500;
    }
  }
  userLocks.set(phone, true);
  try {
    const reply = await callClaude(phone, message);
    console.log(`🤖 → ${phone}: "${reply.substring(0, 80)}..."`);
    await processarResposta(phone, reply);
  } catch (error) {
    console.error(`❌ ${phone}: ${error.message}`);
  } finally {
    userLocks.delete(phone);
  }
}

app.post('/webhook', async (req, res) => {
  res.status(200).json({ ok: true });
  try {
    const data = req.body;
    if (data.fromMe || data.isStatusReply || data.isGroup) return;
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
    processarMensagem(phone, message);
  } catch (error) {
    console.error('❌ Webhook:', error.message);
  }
});

function captureTracking(phone, message) {
  if (userContext.has(phone)) return;
  const ctx = {};
  ['gclid','fbclid','ttclid','utm_source','utm_medium','utm_campaign','utm_term','utm_content']
    .forEach(p => {
      const m = message.match(new RegExp(`${p}=([^\\s&\\]]+)`));
      if (m) ctx[p] = m[1];
    });
  if (Object.keys(ctx).length > 0) console.log(`📊 Tracking de ${phone}:`, ctx);
  userContext.set(phone, ctx);
}

app.get('/', (req, res) => res.json({
  status: 'online', version: '7.0', bot: 'Carlos GHDROL',
  garantia: '60 dias', kits: 4,
  stats: { conversas: conversationMemory.size, processando: userLocks.size }
}));

app.get('/health', (req, res) => {
  const healthy = !!(ZAPI_KEY && ZAPI_INSTANCE && ZAPI_CLIENT_TOKEN && CLAUDE_API_KEY);
  res.json({ status: healthy ? 'healthy' : 'unhealthy', version: '7.0' });
});

app.get('/debug-config', (req, res) => res.json({
  ZAPI_KEY: ZAPI_KEY ? 'OK' : 'MISSING',
  ZAPI_INSTANCE: ZAPI_INSTANCE ? 'OK' : 'MISSING',
  ZAPI_CLIENT_TOKEN: ZAPI_CLIENT_TOKEN ? 'OK' : '❌',
  CLAUDE_API_KEY: CLAUDE_API_KEY ? 'OK' : 'MISSING',
  KIT_LINKS
}));

app.get('/test-zapi', async (req, res) => {
  try {
    const result = await sendZapiMessage('5515997117956', '🧪 Teste v7.0');
    res.json({ success: true, result });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/test-claude', async (req, res) => {
  try {
    const r = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805', max_tokens: 100,
      messages: [{ role: 'user', content: 'Diga oi' }]
    });
    res.json({ success: true, reply: r.content[0].text });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/stats', (req, res) => res.json({
  conversas: conversationMemory.size,
  processando: Array.from(userLocks.keys()),
  tracking: Array.from(userContext.entries()).map(([p, c]) => ({ phone: p, ctx: c }))
}));

app.post('/reset/:phone', (req, res) => {
  const phone = req.params.phone;
  conversationMemory.delete(phone);
  lastSeen.delete(phone);
  userLocks.delete(phone);
  userContext.delete(phone);
  res.json({ success: true });
});

app.get('/test-link/:kit/:phone', (req, res) => {
  res.json({ link: buildKitLink(parseInt(req.params.kit), req.params.phone) });
});

app.get('/version', (req, res) => res.json({
  version: '7.0',
  fixes: [
    '✅ Garantia 60 dias',
    '✅ Bônus destacado',
    '✅ Composição completa (B6)',
    '✅ Info entrega Total Express',
    '✅ Detalhe checkout Braip',
    '✅ Compliance ANVISA',
    '✅ Triagem segurança',
    '✅ Funil 5 estágios'
  ]
}));

app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  🤖 CARLOS v7.0 - FINAL                ║');
  console.log('║  ✅ Garantia 60 dias                   ║');
  console.log('║  ✅ Bônus destacado                    ║');
  console.log('║  ✅ Alinhado com HTML                  ║');
  console.log(`║  Porta: ${PORT}                          ║`);
  console.log('╚════════════════════════════════════════╝');
});
