/**
 * ════════════════════════════════════════════════════════════════
 * CARLOS v3.1 - BOT HÍBRIDO VENDEDOR + ESPECIALISTA GHDROL
 * ════════════════════════════════════════════════════════════════
 * 
 * CORRIGIDO:
 * ✅ Anthropic carrega chave corretamente (apiKey explícito)
 * ✅ Endpoint /debug-config para verificar variáveis
 * ✅ Logs mais claros
 * ✅ Validação de variáveis no startup
 * ✅ Tratamento de erro melhor
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());

// ════════════════════════════════════════════════════════════════
// CONFIG - VALIDAÇÃO RIGOROSA
// ════════════════════════════════════════════════════════════════

const ZAPI_KEY = process.env.ZAPI_KEY;
const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const PORT = process.env.PORT || 3000;

// Validação detalhada das variáveis
console.log('\n🔍 VERIFICANDO VARIÁVEIS DE AMBIENTE...\n');
console.log(`ZAPI_KEY: ${ZAPI_KEY ? '✅ OK (' + ZAPI_KEY.substring(0, 10) + '...)' : '❌ FALTANDO'}`);
console.log(`ZAPI_INSTANCE: ${ZAPI_INSTANCE ? '✅ OK (' + ZAPI_INSTANCE.substring(0, 10) + '...)' : '❌ FALTANDO'}`);
console.log(`CLAUDE_API_KEY: ${CLAUDE_API_KEY ? '✅ OK (' + CLAUDE_API_KEY.substring(0, 10) + '...)' : '❌ FALTANDO'}`);

if (!ZAPI_KEY || !ZAPI_INSTANCE || !CLAUDE_API_KEY) {
  console.error('\n❌ ERRO CRÍTICO: Variáveis de ambiente faltando!');
  console.error('Configure no Vercel/Railway:');
  console.error('  - ZAPI_KEY (Token da instância Z-API)');
  console.error('  - ZAPI_INSTANCE (ID da instância Z-API)');
  console.error('  - CLAUDE_API_KEY (Chave Claude começando com sk-ant-)');
}

// CORREÇÃO IMPORTANTE: passar apiKey EXPLICITAMENTE
const client = CLAUDE_API_KEY ? new Anthropic({
  apiKey: CLAUDE_API_KEY
}) : null;

console.log(`Anthropic Client: ${client ? '✅ Inicializado' : '❌ Falha'}\n`);

// Memória de conversas
const conversationMemory = {};
const hotLeads = {};
const hesitatingLeads = {};

// ════════════════════════════════════════════════════════════════
// SYSTEM PROMPT - CARLOS v3 HÍBRIDO
// ════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `Você é o CARLOS, consultor especialista do GHDROL (suplemento natural pra ganho de massa muscular). Tem 5 anos vendendo, conhece o produto profundamente E sabe vender. NÃO é robô — é vendedor experiente, que escuta, tira dúvida e fecha venda quando faz sentido.

# 🎯 ESTILO DE COMUNICAÇÃO

- **CURTO**: 3-4 linhas máximo (mobile não lê texto longo)
- **INFORMAL MASCULINO**: "cara", "irmão", "mano", "fala aí", "show", "valeu"
- **TOM DE ACADEMIA**: pump, força, ganhar massa, treino pesado
- **EMPÁTICO**: VALIDA o medo antes de responder
- **1-2 emojis MAX** por mensagem
- **SEM FORMALIDADE**: nunca "Atenciosamente", "Prezado", "Em que posso ajudar"

# 💪 PRODUTO (DECORE 100%)

**GHDROL** - Suplemento natural ANVISA aprovado
- Fabricante: GHMuscle (laboratório legítimo)
- Composição: L-Arginina 1000mg, L-Lisina 315mg, Magnésio 260mg, Zinco 7mg, Taurina 200mg, Vitaminas D3/B6/B12
- O que faz: ESTIMULA produção NATURAL de GH e testosterona (NÃO é hormônio)
- Dosagem: 3 cápsulas/dia (manhã ou tarde, NUNCA à noite)
- 90 cápsulas por pote = 30 dias

# 💰 OS 4 KITS (USAR EXATAMENTE)

| Kit | Quantidade | Preço | 12x | Por dia | Link Braip |
|-----|-----------|-------|-----|---------|------------|
| 1 Pote | 1 (sem bônus) | R$147,90 | 12x R$14,12 | R$4,93 | https://ev.braip.com/ref/cpa/camj2ovy5 |
| Kit 2 + 1 BÔNUS | 3 totais | R$237,90 | 12x R$22,71 | R$2,64 | https://ev.braip.com/ref/cpa/cam1812l4 |
| Kit 3 + 1 BÔNUS ⭐ | 4 totais | R$317,90 | 12x R$30,35 | R$2,65 | https://ev.braip.com/ref/cpa/camk7o5p7 |
| Kit 5 + 2 BÔNUS | 7 totais | R$447,90 | 12x R$42,77 | R$1,92 | https://ev.braip.com/ref/cpa/cam44x2m9 |

**TODOS:** Frete GRÁTIS, garantia de 60 DIAS, 12x sem juros, ANVISA

# 🎯 RECOMENDAÇÃO POR PERFIL

- **Iniciante / quer testar**: 1 Pote (R$147,90)
- **Maioria das vendas**: Kit 3+1 BÔNUS (R$317,90) ⭐ MAIS VENDIDO
- **Sério / objetivo claro**: Kit 5+2 BÔNUS (R$447,90)
- **Quer economizar**: Kit 2+1 BÔNUS (R$237,90)

# ⏱️ RESULTADOS REAIS

- Disposição/recuperação: 2-4 SEMANAS
- Resultado VISÍVEL: 6-8 SEMANAS
- Mudança real: 3 MESES
- Casos reais: 6-7kg de massa magra em 3 meses (com treino)

# 🛡️ GARANTIA

- 60 DIAS de garantia total
- Não gostou? Devolve 100%
- Sem burocracia

# 🚀 FLUXO DE VENDAS

## ETAPA 1: ABERTURA
"Fala aí cara! Tudo certo? Tira tua dúvida sobre o GHDROL? Qual teu objetivo - ganhar massa, força ou disposição?"

## ETAPA 2: QUALIFICAÇÃO
- Treina há quanto tempo?
- Já usou outro suplemento?
- Quer resultado em quanto tempo?

## ETAPA 3: RECOMENDAÇÃO
Sugere kit baseado nas respostas

## ETAPA 4: ENVIO DO LINK
Quando interesse, MANDA O LINK direto

## ETAPA 5: TRATAMENTO DE OBJEÇÃO
Usa as objeções abaixo

## ETAPA 6: FECHAMENTO COM URGÊNCIA
Se hesitar: usa pote bônus + escassez + garantia

# 🔥 OBJEÇÕES (DECORE)

## "Está caro"
"Cara, entendo. Mas pensa: 1 cerveja sai R$8/dia. GHDROL no kit 3 sai R$2,65/DIA. Menos da metade pra 4 meses de resultado. E se não rolar? Devolve em 60 dias. Risco zero."

## "Funciona mesmo?"
"Sou direto: NÃO é mágico. GHDROL otimiza tua produção natural de GH/testo. Em 6-8 semanas você sente diferença - força, pump, recuperação. 60 dias garantia se não rolar."

## "É bomba?"
"Não, irmão! GHDROL NÃO injeta hormônio. Tem aminoácidos e minerais que ESTIMULAM teu corpo a produzir mais testo/GH naturalmente. Tipo gasolina pro motor. ANVISA aprova."

## "Falsificação"
"Vendemos SÓ via Braip (plataforma oficial). Recebe nota fiscal, rastreio em 24h, produto LACRADO direto do laboratório. Marketplace tem golpe sim - aqui é seguro."

## "Vou pensar"
"Beleza, sem pressão! Mas te aviso: pote bônus é promoção limitada. Quando acaba, volta preço normal SEM o pote extra. Tem dúvida específica que tá te travando?"

## "Posso parcelar?"
"Sim! 12x sem juros no cartão. PIX aprova na hora."

## "Mulher pode tomar?"
"Pode! Fórmula natural, NÃO é hormônio. Não engrossa voz nem dá pelos. Mulheres usam pra disposição e tônus."

## "Tem efeito colateral?"
"Sem efeitos pra adultos saudáveis. Recomendação: tomar com refeição."

## "Quanto tempo pra chegar?"
"6-10 dias úteis, frete grátis. Rastreio em 24h após pagamento."

## "Quero ver antes"
"Você tem 60 DIAS pra testar. Pede, toma 30 dias. Se não rolar, devolve 100%. É praticamente teste grátis."

## "Já tomei outros e não funcionou"
"Comum. Maioria são fracos. GHDROL tem dose REAL: 1000mg Arginina + minerais. Mas se não treina e não come direito, NENHUM suplemento faz milagre."

# 🚨 HANDOFF HUMANO

Cliente diz "já comprei e não chegou", "cancelar pedido", "reembolso", "pessoa real":
"Beleza, vou avisar nossa equipe agora. Em alguns minutos alguém te chama. Se for sobre pedido feito, me passa o número pra agilizar."

# ❌ NUNCA FAÇA

- Mentir sobre resultados
- Falar que é anabolizante
- Falar que cura doença
- Forçar venda agressivamente
- Mensagens longas
- Emojis demais

# 🎯 FECHAMENTO COM LINK

Quando cliente demonstrar interesse ("ok", "vou comprar", "manda link", "fechar"), MANDA O LINK:

"Show, mano! Bora fechar:

🛒 Kit 3 + 1 BÔNUS (4 potes):
https://ev.braip.com/ref/cpa/camk7o5p7

✅ R$317,90 (12x R$30,35)
✅ Frete grátis, 60 dias garantia
✅ PIX aprova na hora

Qualquer dúvida tô aqui!"

# 💡 LEMBRETES

- Você é CARLOS, vendedor e amigo
- Cliente é gente: trate com respeito
- Não venda - AJUDE a comprar
- Honestidade vende MAIS que mentira`;

// ════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ════════════════════════════════════════════════════════════════

function isHotLead(message) {
  const hotKeywords = [
    'quero comprar', 'fechar', 'fechar agora', 'qual link', 'manda o link',
    'pix', 'pagar', 'cartão', 'finalizar', 'comprar agora',
    'qual valor', 'preço final', 'me manda', 'tô interessado',
    'como faço', 'como compro', 'beleza vou', 'fechado',
    'ok manda', 'pode mandar'
  ];
  const lower = message.toLowerCase();
  return hotKeywords.some(kw => lower.includes(kw));
}

function isHesitating(message) {
  const hesitateKeywords = [
    'vou pensar', 'depois eu', 'ainda nao', 'ainda não', 'mais tarde',
    'preciso pensar', 'não sei', 'nao sei', 'tenho que ver',
    'amanhã', 'amanha', 'semana que vem'
  ];
  const lower = message.toLowerCase();
  return hesitateKeywords.some(kw => lower.includes(kw));
}

function wantsHuman(message) {
  const humanKeywords = [
    'pessoa real', 'humano', 'atendente humano', 'reclamar',
    'problema com pedido', 'não chegou', 'nao chegou', 'cancelar pedido',
    'reembolso', 'devolução', 'devolucao', 'já comprei e', 'ja comprei e'
  ];
  const lower = message.toLowerCase();
  return humanKeywords.some(kw => lower.includes(kw));
}

function addToMemory(phoneNumber, role, content) {
  if (!conversationMemory[phoneNumber]) {
    conversationMemory[phoneNumber] = [];
  }
  conversationMemory[phoneNumber].push({ role, content });
  if (conversationMemory[phoneNumber].length > 20) {
    conversationMemory[phoneNumber] = conversationMemory[phoneNumber].slice(-20);
  }
}

function getMemory(phoneNumber) {
  return conversationMemory[phoneNumber] || [];
}

/**
 * Enviar via Z-API
 */
async function sendZapiMessage(phoneNumber, messageText) {
  try {
    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_KEY}/send-text`;
    
    console.log(`📤 Enviando Z-API:`);
    console.log(`   URL: ${url.substring(0, 80)}...`);
    console.log(`   Para: ${phoneNumber}`);
    
    const response = await axios.post(url, {
      phone: phoneNumber,
      message: messageText
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_KEY
      }
    });
    
    console.log(`✅ Enviado para ${phoneNumber}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Erro Z-API:`, error.response?.data || error.message);
    console.error(`   Status: ${error.response?.status}`);
    throw error;
  }
}

/**
 * Chamar Claude
 */
async function getClaudeResponse(userMessage, phoneNumber) {
  try {
    if (!client) {
      console.error('❌ Cliente Claude não inicializado!');
      return 'Erro de configuração. Aguarda alguns segundos e tenta de novo.';
    }
    
    addToMemory(phoneNumber, 'user', userMessage);
    const messages = getMemory(phoneNumber);
    
    const isHot = isHotLead(userMessage);
    const isHesitate = isHesitating(userMessage);
    const wantsRealPerson = wantsHuman(userMessage);
    
    if (isHot) {
      hotLeads[phoneNumber] = { 
        timestamp: Date.now(),
        lastMessage: userMessage 
      };
      console.log(`🔥 HOT LEAD: ${phoneNumber}`);
    }
    
    if (isHesitate) {
      hesitatingLeads[phoneNumber] = {
        timestamp: Date.now(),
        lastMessage: userMessage
      };
      console.log(`⏸️ HESITANDO: ${phoneNumber}`);
    }
    
    if (wantsRealPerson) {
      const handoffMsg = `Beleza, vou avisar nossa equipe agora. Em alguns minutos alguém te chama aqui. Se for sobre pedido já feito, me passa o número pra agilizar 🤝`;
      addToMemory(phoneNumber, 'assistant', handoffMsg);
      console.log(`👤 Handoff: ${phoneNumber}`);
      return handoffMsg;
    }
    
    console.log(`🧠 Chamando Claude para ${phoneNumber}...`);
    
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: messages
    });
    
    const botMessage = response.content[0].text;
    addToMemory(phoneNumber, 'assistant', botMessage);
    
    console.log(`🤖 Carlos → ${phoneNumber}: "${botMessage.substring(0, 80)}..."`);
    return botMessage;
    
  } catch (error) {
    console.error(`❌ Erro Claude:`, error.message);
    console.error(`   Stack:`, error.stack);
    return `Cara, deu um problema técnico aqui 😅 Manda tua dúvida de novo ou aguarda alguns segundos.`;
  }
}

// ════════════════════════════════════════════════════════════════
// ROTAS
// ════════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  res.json({
    name: 'Carlos v3.1 - Bot WhatsApp GHDROL',
    status: 'online',
    endpoints: ['/health', '/debug-config', '/webhook', '/test-message']
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    bot: 'Carlos v3.1',
    timestamp: new Date().toISOString(),
    activeConversations: Object.keys(conversationMemory).length,
    hotLeads: Object.keys(hotLeads).length,
    hesitatingLeads: Object.keys(hesitatingLeads).length,
    config: {
      zapi_key: ZAPI_KEY ? '✅' : '❌',
      zapi_instance: ZAPI_INSTANCE ? '✅' : '❌',
      claude_api_key: CLAUDE_API_KEY ? '✅' : '❌',
      anthropic_client: client ? '✅' : '❌'
    }
  });
});

/**
 * Endpoint de debug - mostra configuração mascarada
 */
app.get('/debug-config', (req, res) => {
  res.json({
    ZAPI_KEY: ZAPI_KEY ? `${ZAPI_KEY.substring(0, 10)}...${ZAPI_KEY.substring(ZAPI_KEY.length - 4)}` : 'AUSENTE',
    ZAPI_INSTANCE: ZAPI_INSTANCE ? `${ZAPI_INSTANCE.substring(0, 10)}...${ZAPI_INSTANCE.substring(ZAPI_INSTANCE.length - 4)}` : 'AUSENTE',
    CLAUDE_API_KEY: CLAUDE_API_KEY ? `${CLAUDE_API_KEY.substring(0, 15)}...` : 'AUSENTE',
    zapi_url_test: ZAPI_INSTANCE && ZAPI_KEY ? 
      `https://api.z-api.io/instances/${ZAPI_INSTANCE.substring(0, 8)}.../token/${ZAPI_KEY.substring(0, 8)}.../send-text` : 
      'AUSENTE',
    anthropic_initialized: !!client
  });
});

/**
 * Endpoint para testar Z-API SEM Claude
 */
app.get('/test-zapi', async (req, res) => {
  try {
    if (!ZAPI_KEY || !ZAPI_INSTANCE) {
      return res.status(400).json({ error: 'Z-API não configurado' });
    }
    
    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_KEY}/instance-status`;
    
    const response = await axios.get(url);
    res.json({ success: true, status: response.data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status,
      url_called: `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/[hidden]/instance-status`
    });
  }
});

/**
 * Endpoint para testar Claude SEM Z-API
 */
app.get('/test-claude', async (req, res) => {
  try {
    if (!client) {
      return res.status(400).json({ error: 'Claude não inicializado' });
    }
    
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: 'Diga "OK funcionando" em uma frase curta.'
      }]
    });
    
    res.json({ success: true, response: response.content[0].text });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      type: error.constructor.name
    });
  }
});

app.post('/webhook', async (req, res) => {
  try {
    console.log(`\n📱 Webhook ${new Date().toISOString()}`);
    console.log(`   Body keys:`, Object.keys(req.body));
    
    const body = req.body;
    let userMessage = '';
    let phoneNumber = '';
    let isFromMe = false;
    
    // Z-API tem várias estruturas
    if (body.text && body.text.message) {
      userMessage = body.text.message;
      phoneNumber = body.phone;
      isFromMe = body.fromMe || false;
    } else if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
      const msg = body.messages[0];
      userMessage = msg.text?.message || msg.content || '';
      phoneNumber = msg.phone || msg.sender?.id || '';
      isFromMe = msg.fromMe || msg.direction === 'out';
    } else if (body.message) {
      userMessage = typeof body.message === 'string' ? body.message : body.message.text || '';
      phoneNumber = body.phone || body.from || '';
      isFromMe = body.fromMe || false;
    }
    
    console.log(`   Phone: ${phoneNumber}`);
    console.log(`   Message: "${userMessage}"`);
    console.log(`   FromMe: ${isFromMe}`);
    
    if (isFromMe) {
      return res.status(200).json({ success: true, ignored: 'fromMe' });
    }
    
    if (!userMessage || !phoneNumber) {
      console.log('⚠️ Sem dados úteis no webhook');
      return res.status(200).json({ success: false, message: 'Sem dados' });
    }
    
    const response = await getClaudeResponse(userMessage, phoneNumber);
    await sendZapiMessage(phoneNumber, response);
    
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/test-message', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: 'Faltam phone ou message' });
    }
    
    const response = await getClaudeResponse(message, phone);
    await sendZapiMessage(phone, response);
    
    return res.status(200).json({
      success: true,
      userMessage: message,
      botResponse: response
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/hot-leads', (req, res) => {
  res.json({
    count: Object.keys(hotLeads).length,
    leads: Object.entries(hotLeads).map(([phone, data]) => ({
      phone,
      timestamp: data.timestamp,
      lastMessage: data.lastMessage
    }))
  });
});

app.get('/hesitating-leads', (req, res) => {
  res.json({
    count: Object.keys(hesitatingLeads).length,
    leads: Object.entries(hesitatingLeads).map(([phone, data]) => ({
      phone,
      timestamp: data.timestamp,
      lastMessage: data.lastMessage
    }))
  });
});

app.delete('/memory/:phone', (req, res) => {
  const { phone } = req.params;
  delete conversationMemory[phone];
  delete hotLeads[phone];
  delete hesitatingLeads[phone];
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════
// START
// ════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🤖 CARLOS v3.1 - BUGS CORRIGIDOS!     ║
║                                        ║
║  Status: ONLINE 🚀                     ║
║  Porta: ${PORT}                              ║
║                                        ║
║  ✅ Anthropic com apiKey explícito     ║
║  ✅ Endpoints de debug                 ║
║  ✅ Logs detalhados                    ║
║                                        ║
║  Endpoints:                            ║
║  GET  /                                ║
║  GET  /health                          ║
║  GET  /debug-config                    ║
║  GET  /test-zapi                       ║
║  GET  /test-claude                     ║
║  POST /webhook                         ║
║  POST /test-message                    ║
║                                        ║
║  Aguardando clientes... 💬             ║
╚════════════════════════════════════════╝
  `);
});

module.exports = app;
