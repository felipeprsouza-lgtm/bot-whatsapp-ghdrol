// ================================================================
// CARLOS v3.2 - BOT WHATSAPP GHDROL - CLIENT-TOKEN FIXED
// ================================================================

const express = require('express');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json());

// ================================================================
// VARIÁVEIS DE AMBIENTE
// ================================================================
const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
const ZAPI_KEY = process.env.ZAPI_KEY;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;  // 🆕 IMPORTANTE!
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const PORT = process.env.PORT || 8080;

// ================================================================
// LOGS DE INICIALIZAÇÃO
// ================================================================
console.log('');
console.log('🔍 VERIFICANDO VARIÁVEIS DE AMBIENTE...');
console.log('');
console.log(`ZAPI_KEY: ${ZAPI_KEY ? '✅ OK (' + ZAPI_KEY.substring(0, 10) + '...)' : '❌ FALTANDO'}`);
console.log(`ZAPI_INSTANCE: ${ZAPI_INSTANCE ? '✅ OK (' + ZAPI_INSTANCE.substring(0, 10) + '...)' : '❌ FALTANDO'}`);
console.log(`ZAPI_CLIENT_TOKEN: ${ZAPI_CLIENT_TOKEN ? '✅ OK (' + ZAPI_CLIENT_TOKEN.substring(0, 10) + '...)' : '❌ FALTANDO!!!'}`);
console.log(`CLAUDE_API_KEY: ${CLAUDE_API_KEY ? '✅ OK (sk-ant-api...)' : '❌ FALTANDO'}`);
console.log('');

// ================================================================
// INICIALIZAR ANTHROPIC
// ================================================================
console.log('📌 Inicializando Anthropic...');
const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });
console.log('✅ Anthropic Client inicializado!');
console.log('');

// ================================================================
// MEMÓRIA DE CONVERSAS
// ================================================================
const conversationMemory = new Map();

function getHistory(phone) {
  if (!conversationMemory.has(phone)) {
    conversationMemory.set(phone, []);
  }
  return conversationMemory.get(phone);
}

function addToHistory(phone, role, content) {
  const history = getHistory(phone);
  history.push({ role, content });
  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }
}

// ================================================================
// SYSTEM PROMPT - CARLOS VENDEDOR
// ================================================================
const SYSTEM_PROMPT = `Você é CARLOS, vendedor experiente do GHDROL no WhatsApp.

## PERSONALIDADE
- Linguagem masculina informal brasileira (cara, mano, irmão, fera)
- Direto, confiante, vendedor profissional
- Foca em RESOLVER a dor do cliente
- Usa emojis com moderação (💪🔥✅🤝)
- Respostas CURTAS (2-4 linhas geralmente)

## PRODUTO GHDROL (suplemento natural)
- Composição: L-Arginina 1000mg, L-Lisina, Magnésio, Zinco, Taurina, Vitaminas
- Dosagem: 3 caps/dia, 90 caps/pote = 30 dias
- Resultado: 2-4 semanas (disposição), 6-8 semanas (visível), 3 meses (mudança real)
- ANVISA aprovado, NÃO é anabolizante, NÃO é bomba

## KITS E PREÇOS
- 1 pote: R$147,90 (12x R$14,12)
- Kit 2+1 BÔNUS (3 potes): R$237,90 (12x R$22,71)
- Kit 3+1 BÔNUS (4 potes): R$317,90 (12x R$30,35) ⭐ MAIS VENDIDO
- Kit 5+2 BÔNUS (7 potes): R$447,90 (12x R$42,77)

## GARANTIAS
- 60 DIAS de garantia incondicional
- Frete GRÁTIS Brasil todo
- 12x sem juros no cartão
- Pagamento via Braip (seguro)

## OBJEÇÕES (responda assim)
- "É caro": "Cara, divide em 12x sem juros fica R$14/mês. Menos que uma pizza!"
- "É bomba?": "Não mano! É 100% natural, ANVISA aprovado. Vitaminas e aminoácidos."
- "Funciona mesmo?": "Tem 60 dias de garantia. Se não rolar, devolvo seu dinheiro."
- "Vou pensar": "Fechado! Mas o lote tá acabando hein, lote novo vai demorar 30 dias."

## REGRAS
- NUNCA invente informação
- SEMPRE pergunte o objetivo (massa, força, disposição)
- Foque no kit 3+1 BÔNUS (mais vendido)
- Mande link Braip quando ele decidir
- Se ficar agressivo/sem resposta, passa pro humano

## LINKS BRAIP
- 1 pote: https://ev.braip.co/ref?pl=plapd60q&af=afi6dm1z9w&ck=camj2ovy5
- Kit 3+1: https://ev.braip.co/ref?pl=plapd60q&af=afi6dm1z9w&ck=camk7o5p7 ⭐`;

// ================================================================
// FUNÇÃO: CHAMAR CLAUDE
// ================================================================
async function callClaude(phone, userMessage) {
  console.log(`🧠 Chamando Claude para ${phone}...`);

  addToHistory(phone, 'user', userMessage);
  const history = getHistory(phone);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: history
    });

    const reply = response.content[0].text;
    addToHistory(phone, 'assistant', reply);
    return reply;
  } catch (error) {
    console.error('❌ Erro Claude:', error.message);
    return 'Opa, deu uma travadinha aqui. Pode repetir?';
  }
}

// ================================================================
// 🔥 FUNÇÃO CRÍTICA: ENVIAR MENSAGEM Z-API (COM CLIENT-TOKEN!)
// ================================================================
async function sendZapiMessage(phone, message) {
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_KEY}/send-text`;

  console.log('📤 Enviando Z-API:');
  console.log(`   URL: ${url.substring(0, 70)}...`);
  console.log(`   Para: ${phone}`);
  console.log(`   Mensagem: ${message.substring(0, 50)}...`);
  console.log(`   Client-Token: ${ZAPI_CLIENT_TOKEN ? ZAPI_CLIENT_TOKEN.substring(0, 10) + '...' : '❌ NÃO CONFIGURADO!'}`);

  try {
    const response = await axios.post(
      url,
      {
        phone: phone,
        message: message
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': ZAPI_CLIENT_TOKEN  // 🔥 ESSE É O FIX!
        }
      }
    );

    console.log('✅ Z-API enviado com sucesso!');
    console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}`);
    return response.data;
  } catch (error) {
    console.error('❌ Erro Z-API:');
    console.error(`   Status: ${error.response?.status}`);
    console.error(`   Data: ${JSON.stringify(error.response?.data)}`);
    console.error(`   Phone: ${phone}`);
    throw error;
  }
}

// ================================================================
// WEBHOOK - RECEBE MENSAGENS DO WHATSAPP
// ================================================================
app.post('/webhook', async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`📱 Webhook ${timestamp}`);
  console.log(`   Body keys:`, Object.keys(req.body));

  try {
    const data = req.body;

    // Ignora mensagens do próprio bot
    if (data.fromMe) {
      console.log('   ⏭️  Ignorando msg do bot (fromMe: true)');
      return res.status(200).json({ ok: true });
    }

    // Ignora status/grupo
    if (data.isStatusReply || data.isGroup) {
      console.log('   ⏭️  Ignorando status/grupo');
      return res.status(200).json({ ok: true });
    }

    const phone = data.phone;
    const message = data.text?.message || data.text || '';

    console.log(`   Phone: ${phone}`);
    console.log(`   Message: "${message}"`);
    console.log(`   FromMe: ${data.fromMe}`);

    if (!phone || !message) {
      console.log('   ⏭️  Sem phone/message, ignorando');
      return res.status(200).json({ ok: true });
    }

    // Chama Claude
    const reply = await callClaude(phone, message);
    console.log(`🤖 Carlos → ${phone}: "${reply.substring(0, 80)}..."`);

    // Envia resposta
    await sendZapiMessage(phone, reply);

    return res.status(200).json({ ok: true, reply });
  } catch (error) {
    console.error('❌ Erro no webhook:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ================================================================
// ENDPOINTS DE DEBUG
// ================================================================

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    version: '3.2',
    bot: 'Carlos GHDROL',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', version: '3.2' });
});

app.get('/debug-config', (req, res) => {
  res.json({
    ZAPI_KEY: ZAPI_KEY ? `OK (${ZAPI_KEY.substring(0, 10)}...)` : 'MISSING',
    ZAPI_INSTANCE: ZAPI_INSTANCE ? `OK (${ZAPI_INSTANCE.substring(0, 10)}...)` : 'MISSING',
    ZAPI_CLIENT_TOKEN: ZAPI_CLIENT_TOKEN ? `OK (${ZAPI_CLIENT_TOKEN.substring(0, 10)}...)` : '❌ MISSING!!!',
    CLAUDE_API_KEY: CLAUDE_API_KEY ? 'OK (sk-ant-...)' : 'MISSING',
    PORT: PORT
  });
});

app.get('/test-zapi', async (req, res) => {
  try {
    const result = await sendZapiMessage('5515996966697', '🧪 Teste Carlos v3.2 - Client-Token funcionando! 🎉');
    res.json({ success: true, result });
  } catch (error) {
    res.json({ 
      success: false, 
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
});

app.get('/test-claude', async (req, res) => {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Diga oi em português' }]
    });
    res.json({ success: true, reply: response.content[0].text });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/version', (req, res) => {
  res.json({ 
    version: '3.2',
    fix: 'Client-Token agora é enviado corretamente nos headers!',
    date: new Date().toISOString()
  });
});

// ================================================================
// INICIAR SERVIDOR
// ================================================================
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  🤖 CARLOS v3.2 - CLIENT-TOKEN FIX!    ║');
  console.log('║  ✅ Header Client-Token configurado    ║');
  console.log('║  ✅ Anthropic com apiKey explícito     ║');
  console.log('║  ✅ Logs detalhados                    ║');
  console.log('║                                        ║');
  console.log(`║  Porta: ${PORT}                          ║`);
  console.log('║  Status: ONLINE 🚀                     ║');
  console.log('║                                        ║');
  console.log('║  Aguardando clientes... 💬             ║');
  console.log('╚════════════════════════════════════════╝');
});
