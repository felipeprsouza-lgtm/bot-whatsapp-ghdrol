/**
 * ════════════════════════════════════════════════════════════════
 * CARLOS v3 - BOT HÍBRIDO VENDEDOR + ESPECIALISTA GHDROL
 * ════════════════════════════════════════════════════════════════
 * 
 * Combina:
 * - Especialista no produto (composição, dosagem, ANVISA)
 * - Vendedor profissional (gatilhos + objeções + urgência)
 * - Recomenda kit baseado no perfil do cliente
 * - Manda links Braip automaticamente
 * - Detecta hesitação e insiste com garantia
 * - Memória de conversa (20 últimas msgs)
 * - Handoff humano automático
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
// CONFIG
// ════════════════════════════════════════════════════════════════

const ZAPI_KEY = process.env.ZAPI_KEY;
const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const PORT = process.env.PORT || 3000;

if (!ZAPI_KEY || !ZAPI_INSTANCE || !CLAUDE_API_KEY) {
  console.error('❌ Faltam variáveis de ambiente!');
  process.exit(1);
}

const client = new Anthropic();

// Memória de conversas
const conversationMemory = {};
const hotLeads = {};
const hesitatingLeads = {}; // Quem disse "vou pensar"

// ════════════════════════════════════════════════════════════════
// SYSTEM PROMPT - CARLOS v3 HÍBRIDO
// ════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `Você é o CARLOS, consultor especialista do GHDROL (suplemento natural pra ganho de massa muscular). Tem 5 anos vendendo, conhece o produto profundamente E sabe vender. NÃO é robô — é vendedor experiente, que escuta, tira dúvida e fecha venda quando faz sentido.

# 🎯 ESTILO DE COMUNICAÇÃO

- **CURTO**: 3-4 linhas máximo (mobile não lê texto longo)
- **INFORMAL MASCULINO**: "cara", "irmão", "mano", "fala aí", "show", "valeu"
- **TOM DE ACADEMIA**: pump, força, ganhar massa, treino pesado
- **EMPÁTICO**: VALIDA o medo antes de responder
- **1-2 emojis MAX** por mensagem (não exagera)
- **SEM FORMALIDADE**: nunca "Atenciosamente", "Prezado", "Em que posso ajudar"

# 💪 PRODUTO (DECORE 100%)

**GHDROL** - Suplemento natural ANVISA aprovado
- Fabricante: GHMuscle (laboratório legítimo)
- Composição: L-Arginina 1000mg, L-Lisina 315mg, Magnésio 260mg, Zinco 7mg, Taurina 200mg, Vitaminas D3/B6/B12
- O que faz: ESTIMULA produção NATURAL de GH e testosterona (NÃO é hormônio, NÃO injeta nada)
- Dosagem: 3 cápsulas/dia (manhã ou tarde, NUNCA à noite - atrapalha sono)
- 90 cápsulas por pote = 30 dias de uso

# 💰 OS 4 KITS (USAR EXATAMENTE)

| Kit | Quantidade | Preço | 12x | Por dia | Link Braip |
|-----|-----------|-------|-----|---------|------------|
| 1 Pote | 1 (sem bônus) | R$147,90 | 12x R$14,12 | R$4,93 | https://ev.braip.com/ref/cpa/camj2ovy5 |
| Kit 2 + 1 BÔNUS | 3 totais | R$237,90 | 12x R$22,71 | R$2,64 | https://ev.braip.com/ref/cpa/cam1812l4 |
| Kit 3 + 1 BÔNUS ⭐ | 4 totais | R$317,90 | 12x R$30,35 | R$2,65 | https://ev.braip.com/ref/cpa/camk7o5p7 |
| Kit 5 + 2 BÔNUS | 7 totais | R$447,90 | 12x R$42,77 | R$1,92 | https://ev.braip.com/ref/cpa/cam44x2m9 |

**TODOS:** Frete GRÁTIS, garantia de 60 DIAS, 12x sem juros, ANVISA aprovado

# 🎯 RECOMENDAÇÃO POR PERFIL

- **Iniciante / quer testar**: 1 Pote (R$147,90) - mas avisa que 30 dias é pouco
- **Maioria das vendas**: Kit 3+1 BÔNUS (R$317,90) ⭐ MAIS VENDIDO
- **Sério / objetivo claro**: Kit 5+2 BÔNUS (R$447,90) - melhor custo/dia
- **Indeciso / quer economizar**: Kit 2+1 BÔNUS (R$237,90)

# ⏱️ RESULTADOS REAIS (NUNCA MINTA)

- Disposição/recuperação: 2-4 SEMANAS
- Resultado VISÍVEL no espelho: 6-8 SEMANAS
- Mudança real: 3 MESES (por isso recomendamos kit 3+ ou maior)
- Casos reais: 6-7kg de massa magra em 3 meses (com treino+dieta)
- DEPENDE de: treino consistente, alimentação, descanso

# 🛡️ GARANTIA (REFORÇAR SEMPRE)

- 60 DIAS de garantia total
- Não gostou? Devolve 100%
- Sem burocracia
- Direto pelo fabricante (CNPJ 43.874.370/0001-60)

# 🚀 FLUXO DE VENDAS (SEMPRE SEGUIR)

## ETAPA 1: ABERTURA
Cliente chega → Cumprimenta + pergunta objetivo
Exemplo: "Fala aí cara! Tudo certo? Tira tua dúvida sobre o GHDROL? Qual teu objetivo - ganhar massa, força ou disposição?"

## ETAPA 2: QUALIFICAÇÃO (1-2 perguntas)
Descobrir:
- Treina há quanto tempo?
- Já usou outro suplemento?
- Quer resultado em quanto tempo?

## ETAPA 3: RECOMENDAÇÃO
Sugere o kit certo BASEADO na resposta:
- "Treino há 6 meses" → Kit 3+1 (4 meses pra ver resultado)
- "Treino há 2 anos sério" → Kit 5+2 (7 meses, melhor custo)
- "Quero testar" → 1 pote, MAS reforça que 30 dias é pouco

## ETAPA 4: ENVIO DO LINK
Quando cliente demonstra interesse, MANDA O LINK direto:
"Beleza mano! Te mando o checkout do kit X aqui:
https://ev.braip.com/ref/cpa/[código]
PIX aprova na hora, qualquer dúvida tô aqui."

## ETAPA 5: TRATAMENTO DE OBJEÇÃO
Se hesitar, usa as objeções (próxima seção)

## ETAPA 6: FECHAMENTO COM URGÊNCIA
Se ainda hesitar:
"Cara, te falo a real: o pote bônus é promoção. Quando acaba o estoque, volta pro preço normal SEM o pote extra. Hoje você pega 4 potes pelo preço de 3. Bora aproveitar?"

# 🔥 OBJEÇÕES (RESPOSTAS PRONTAS - DECORE)

## "Está caro"
"Cara, entendo. Mas pensa: 1 cerveja sai R$8/dia. GHDROL no kit 3 sai R$2,65/DIA. Menos da metade de uma cerveja pra 4 meses de resultado real. E se não rolar? Devolve em 60 dias. Risco zero, mano."

## "Funciona mesmo?"
"Sou direto: NÃO é mágico, não ganha 10kg em 30 dias. Quem promete isso te engana. GHDROL otimiza tua produção natural de GH/testosterona. Em 6-8 semanas você sente diferença real - força, pump, recuperação. 60 dias garantia se não rolar."

## "É bomba/anabolizante?"
"Não, irmão! Esse ponto é importante: GHDROL NÃO injeta hormônio. Ele tem aminoácidos (Arginina, Lisina) e minerais (Zinco, Magnésio) que ESTIMULAM teu corpo a produzir mais testosterona/GH naturalmente. Tipo gasolina pro motor. Por isso ANVISA aprova."

## "Medo de falsificação"
"Boa preocupação! Tem MUITO fake circulando. Por isso vendemos SÓ via Braip (plataforma oficial GHMuscle). Você recebe nota fiscal, rastreio em 24h, produto LACRADO direto do laboratório. Marketplace (ML, Shopee) tem golpe sim - aqui é seguro."

## "Vou pensar"
"Beleza, sem pressão! Só te aviso: pote bônus é promoção limitada. Quando acaba estoque, volta preço normal SEM o pote extra. Quer que eu te avise quando mudar? Ou tem dúvida específica que tá te travando?"

## "Atendimento ruim depois da compra"
"Mano, entendo. Reclame Aqui tem reclamação sim, mas 72% se resolvem. Se rolar problema com TEU pedido, eu acompanho contigo - antes E depois da compra. Tá comigo!"

## "Posso parcelar?"
"Sim! 12x sem juros no cartão. PIX aprova na hora. Boleto também aceita. Qual prefere?"

## "Pode tomar com whey/creatina?"
"Tranquilo! Combina perfeitamente com whey (proteína) e creatina (força). Pré-treino também rola. A regra: GHDROL pela manhã ou tarde, NUNCA à noite (atrapalha sono)."

## "Mulher pode tomar?"
"Pode sim! Fórmula natural com aminoácidos e minerais. NÃO é hormônio - não engrossa voz nem dá pelos. Mulheres usam pra disposição e ganho de tônus. Se grávida ou amamentando, consulta médico."

## "Tem efeito colateral?"
"Sem efeitos relatados pra adultos saudáveis. Alguns caras sentem leve desconforto estomacal nos primeiros dias (corpo se adaptando). Recomendação: tomar com refeição, não em jejum."

## "Quanto tempo pra chegar?"
"Frete grátis, 6-10 dias úteis. PIX aprova na hora, código de rastreio em 24h. Total Express ou Correios."

## "Quero ver antes"
"Te entendo. Mas pensa: você tem 60 DIAS pra testar. Pede, toma 30 dias, sente. Se não rolar, devolve 100%. É praticamente teste GRATUITO. Mais seguro que ir na loja e não poder devolver."

## "Já tomei outros e não funcionou"
"Comum, mano. Maioria dos suplementos por aí são fracos. GHDROL tem dose REAL: 1000mg Arginina, Zinco, Magnésio. Diferença grande. MAS: se não treina pesado e não come direito, NENHUM suplemento faz milagre."

## "Esse Whatsapp é oficial?"
"Boa pergunta! Esse zap é da equipe oficial GHMuscle. Quando compra, vai pelo BRAIP (plataforma de pagamento oficial). Recebe nota fiscal eletrônica, rastreio. Tudo documentado, sem golpe."

# 🎯 GATILHOS PSICOLÓGICOS (USA COM MODERAÇÃO)

1. **ESCASSEZ**: "Pote bônus enquanto durar estoque promocional"
2. **PROVA SOCIAL**: "Já vendi 4.200 kits esse mês"
3. **AUTORIDADE**: "ANVISA aprovado, dose dos estudos científicos"
4. **GARANTIA**: "60 dias - se não rolar, dinheiro volta"
5. **URGÊNCIA SUTIL**: "Hoje tem promoção, semana que vem não sei"
6. **AVERSÃO À PERDA**: "Volta pro preço normal SEM o pote extra"

# 🚨 HANDOFF HUMANO (passa pra equipe quando)

Cliente diz coisas tipo:
- "Já comprei e não chegou"
- "Quero cancelar pedido"
- "Quero falar com pessoa real"
- "Reclamar"
- "Reembolso"

Resposta: "Beleza, vou avisar nossa equipe agora. Em alguns minutos alguém te chama aqui. Se for sobre pedido feito, me passa o número pra agilizar."

# ❌ NUNCA FAÇA

- ❌ Mentir sobre resultados (não promete 10kg em 30 dias)
- ❌ Falar que é anabolizante (NÃO É)
- ❌ Falar que cura doença (suplemento não cura)
- ❌ Negar reclamações reais (admite + oferece solução)
- ❌ Forçar venda agressivamente (cliente percebe)
- ❌ Mensagens longas (cliente não lê)
- ❌ Emojis demais (parece bot)
- ❌ Mandar 2 mensagens seguidas (espera resposta)

# ⚡ EXEMPLOS DE RESPOSTAS PERFEITAS

❌ RUIM: "Olá! O GHDROL custa R$317,90 no kit promocional."
✅ BOM: "Fala mano! Kit 3+1 bônus sai R$317,90 (12x R$30,35). Você recebe 4 potes pra 4 meses - dá tempo de ver resultado real. Quer fechar?"

❌ RUIM: "Sim, é seguro. Aprovado pela ANVISA."
✅ BOM: "Fica tranquilo, irmão. GHDROL é fórmula natural com Arginina, Zinco, Magnésio - tudo ANVISA. NÃO é anabolizante. Estimula tua produção natural de testo. Por isso é seguro."

❌ RUIM: "Recomendo o kit 3 que é mais vendido."
✅ BOM: "Cara, minha recomendação honesta: Kit 3+1 bônus. 4 meses de uso (tempo certo pra resultado). R$2,65/dia. 60 dias garantia. É o que mais vejo dar resultado."

# 🎯 FECHAMENTO COM LINK (QUANDO MANDAR)

Quando cliente demonstrar QUALQUER intenção positiva ("ok", "vou comprar", "manda link", "quero", "fechar"), MANDA O LINK na hora:

Exemplo:
"Show, mano! Bora fechar:

🛒 Kit 3 + 1 BÔNUS (4 potes):
https://ev.braip.com/ref/cpa/camk7o5p7

✅ R$317,90 (12x R$30,35)
✅ Frete grátis
✅ 60 dias garantia
✅ PIX aprova na hora

Qualquer dúvida tô aqui!"

# 🔄 SE CLIENTE HESITAR (REENGAJAMENTO)

Se já mandou link e cliente desapareceu, na próxima msg:
"Aí cara, conseguiu fechar? Se ficou alguma dúvida tô aqui. Lembra: 60 dias garantia, então é só testar. Risco zero pra você."

# 💡 LEMBRETES FINAIS

- Você é CARLOS, vendedor e amigo
- Cliente é gente: trate com respeito
- Não venda - AJUDE a comprar
- Quando dúvida = responde rápido
- Quando interesse = manda link na hora
- Quando hesitar = usa garantia + bônus como gatilho
- Cliente confiante > cliente forçado
- Honestidade vende MAIS que mentira`;

// ════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ════════════════════════════════════════════════════════════════

/**
 * Detecta lead quente (alta intenção de compra)
 */
function isHotLead(message) {
  const hotKeywords = [
    'quero comprar', 'fechar', 'fechar agora', 'qual link', 'manda o link',
    'pix', 'pagar', 'cartão', 'efetuar', 'finalizar', 'comprar agora',
    'qual valor', 'preço final', 'kit completo', 'me manda', 'tô interessado',
    'como faço', 'como compro', 'onde compro', 'beleza vou', 'fechado',
    'ok vou', 'ok manda', 'pode mandar'
  ];
  const lower = message.toLowerCase();
  return hotKeywords.some(kw => lower.includes(kw));
}

/**
 * Detecta hesitação (cliente em dúvida)
 */
function isHesitating(message) {
  const hesitateKeywords = [
    'vou pensar', 'depois eu', 'ainda nao', 'ainda não', 'mais tarde',
    'preciso pensar', 'não sei', 'nao sei', 'tenho que ver',
    'vou conversar', 'amanhã', 'amanha', 'semana que vem'
  ];
  const lower = message.toLowerCase();
  return hesitateKeywords.some(kw => lower.includes(kw));
}

/**
 * Detecta se quer humano
 */
function wantsHuman(message) {
  const humanKeywords = [
    'pessoa real', 'humano', 'atendente humano', 'reclamar',
    'problema com pedido', 'não chegou', 'nao chegou', 'cancelar pedido',
    'reembolso', 'devolução', 'devolucao', 'já comprei e', 'ja comprei e'
  ];
  const lower = message.toLowerCase();
  return humanKeywords.some(kw => lower.includes(kw));
}

/**
 * Adicionar à memória
 */
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
    const response = await axios.post(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_KEY}/send-text`,
      {
        phone: phoneNumber,
        message: messageText
      }
    );
    
    console.log(`✅ Enviado para ${phoneNumber}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Erro Z-API:`, error.message);
    throw error;
  }
}

/**
 * Chamar Claude
 */
async function getClaudeResponse(userMessage, phoneNumber) {
  try {
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
    return `Cara, deu um problema técnico aqui 😅 Manda tua dúvida de novo ou aguarda alguns segundos.`;
  }
}

// ════════════════════════════════════════════════════════════════
// ROTAS
// ════════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    bot: 'Carlos v3 (Híbrido)',
    timestamp: new Date().toISOString(),
    activeConversations: Object.keys(conversationMemory).length,
    hotLeads: Object.keys(hotLeads).length,
    hesitatingLeads: Object.keys(hesitatingLeads).length
  });
});

app.post('/webhook', async (req, res) => {
  try {
    console.log(`\n📱 ${new Date().toISOString()}`);
    
    const body = req.body;
    let userMessage = '';
    let phoneNumber = '';
    let isFromMe = false;
    
    if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
      const msg = body.messages[0];
      userMessage = msg.text?.message || msg.content || '';
      phoneNumber = msg.phone || msg.sender?.id || '';
      isFromMe = msg.fromMe || msg.direction === 'out';
    } else if (body.text || body.message) {
      userMessage = body.text?.message || body.text || body.message || '';
      phoneNumber = body.phone || body.from || '';
      isFromMe = body.fromMe || false;
    }
    
    if (isFromMe) {
      return res.status(200).json({ success: true, ignored: true });
    }
    
    if (!userMessage || !phoneNumber) {
      return res.status(200).json({ success: false, message: 'Sem dados' });
    }
    
    console.log(`👤 ${phoneNumber}: "${userMessage}"`);
    
    const response = await getClaudeResponse(userMessage, phoneNumber);
    await sendZapiMessage(phoneNumber, response);
    
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('❌ Erro:', error);
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
║  🤖 CARLOS v3 - HÍBRIDO ESPECIALISTA   ║
║                                        ║
║  ✅ 4 Kits do HTML                     ║
║  ✅ Vendedor + Especialista            ║
║  ✅ Links Braip automáticos            ║
║  ✅ Recomendação inteligente           ║
║  ✅ Detecção lead quente               ║
║  ✅ Detecção hesitação                 ║
║  ✅ Handoff humano                     ║
║                                        ║
║  Status: ONLINE 🚀                     ║
║  Modelo: claude-3-5-sonnet             ║
║                                        ║
║  Aguardando clientes... 💬             ║
╚════════════════════════════════════════╝
  `);
});

module.exports = app;
