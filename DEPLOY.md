# 🚀 DEPLOY DO BOT NO VERCEL

**Tempo total: ~5 minutos**

---

## **PASSO 1: Preparar os arquivos no GitHub**

### 1.1 - Criar repositório GitHub (livre)

1. Vai em https://github.com/new
2. Nome do repositório: `bot-whatsapp-ghdrol`
3. Descrição: `Bot WhatsApp com Claude para GHDROL`
4. Seleciona **"Public"** (para Vercel conseguir acessar)
5. Clica **"Create repository"**

### 1.2 - Fazer upload dos arquivos

**Opção A: Pelo GitHub Web (mais fácil)**

1. No repositório criado, clica em **"Add file"** → **"Upload files"**
2. Arrasta os 3 arquivos:
   - `package.json`
   - `server.js`
   - `.env.example`
3. Clica **"Commit changes"**

**Opção B: Pelo Git (se souber usar)**

```bash
git clone https://github.com/SEU_USUARIO/bot-whatsapp-ghdrol.git
cd bot-whatsapp-ghdrol
# Copia os 3 arquivos pra essa pasta
git add .
git commit -m "Initial commit: bot setup"
git push origin main
```

---

## **PASSO 2: Fazer Deploy no Vercel**

### 2.1 - Criar conta Vercel (grátis)

1. Acessa: https://vercel.com/signup
2. Clica em **"Continue with GitHub"**
3. Autoriza o Vercel a acessar seus repositórios
4. Pronto! Já tem conta

### 2.2 - Fazer Deploy

1. Na página inicial do Vercel, clica em **"New Project"** ou **"Import Project"**
2. Seleciona seu repositório `bot-whatsapp-ghdrol`
3. Vercel detecta que é um projeto Node.js automaticamente
4. **Não precisa mudar nada nas configurações, é só clicar "Deploy"**
5. Aguarda uns 30-60 segundos

### 2.3 - Adicionar Variáveis de Ambiente

⚠️ **IMPORTANTE: Antes de usar o bot!**

1. No painel do Vercel, seu projeto aparece com uma URL tipo: `bot-whatsapp-ghdrol.vercel.app`
2. Clica em **"Settings"** → **"Environment Variables"**
3. Clica **"Add"** e preenche:

```
Nome: ZAPI_KEY
Valor: [SUA_ZAPI_KEY]
```

Clica **Add** de novo para cada:

```
Nome: ZAPI_INSTANCE
Valor: [SUA_INSTANCE_ID]

Nome: CLAUDE_API_KEY
Valor: sk-ant-[SUA_CLAUDE_KEY]
```

4. Após adicionar as 3, Vercel faz **auto-redeploy** automático (~30s)

---

## **PASSO 3: Conectar Z-API ao Webhook**

### 3.1 - Copiar URL do Vercel

Seu URL final vai ser assim:
```
https://bot-whatsapp-ghdrol.vercel.app/webhook
```

### 3.2 - Configurar Webhook no Z-API

1. No painel Z-API, procura por **"Webhook"**, **"Integrações"** ou **"Configurações"**
2. Procura por **"URL do Webhook"** ou **"Webhook URL"**
3. **Cola:**
   ```
   https://bot-whatsapp-ghdrol.vercel.app/webhook
   ```
4. Seleciona os eventos: **"Mensagens Recebidas"** ou **"Message"**
5. Salva/Confirma

---

## **PASSO 4: Testar o Bot**

### 4.1 - Health Check

Abre no navegador:
```
https://bot-whatsapp-ghdrol.vercel.app/health
```

Deve aparecer:
```json
{
  "status": "OK",
  "message": "Bot WhatsApp GHDROL tá rodando! 🚀",
  "timestamp": "2026-05-08T..."
}
```

Se não aparecer, algo deu errado. Avisa!

### 4.2 - Enviar Mensagem de Teste

Envie uma mensagem para seu WhatsApp no número conectado (15997117956):
```
Qual é o preço?
```

Se o bot responder em até 5 segundos com infos sobre GHDROL, **DEU CERTO!** 🎉

Se não responder:
1. Aguarda 30s (redeploy pode estar acontecendo)
2. Tenta de novo
3. Se não responder, me avisa pro debug

---

## **✅ CHECKLIST FINAL**

```
□ Repositório GitHub criado
□ 3 arquivos fazendo upload no GitHub
□ Conta Vercel criada
□ Projeto importado do GitHub
□ 3 variáveis de ambiente adicionadas (ZAPI_KEY, ZAPI_INSTANCE, CLAUDE_API_KEY)
□ URL do webhook configurada no Z-API
□ Health check funcionando
□ Mensagem de teste respondida
```

---

## **🔧 TROUBLESHOOTING**

### "Mensagem não responde"
- Verifica se Webhook foi salvo corretamente no Z-API
- Verifica se todas as 3 variáveis foram adicionadas no Vercel
- Tenta novamente em 60s (pode estar fazendo redeploy)
- Abre `/health` pra confirmar que servidor tá UP

### "Erro 500 no webhook"
- Significa que as variáveis de ambiente não estão lendo
- Vai em Settings → Environment Variables
- Confirma que as 3 estão lá
- Vercel vai fazer redeploy sozinho

### "Erro 'unauthorized' do Z-API"
- ZAPI_KEY ou ZAPI_INSTANCE tá errada
- Volta no painel Z-API e copia de novo
- Atualiza no Vercel

### "Claude responde mas em inglês"
- Aumenta o `max_tokens` no server.js (linha ~150)
- Ou muda o prompt SYSTEM_PROMPT pra ser mais específico

---

## **DEPOIS QUE ESTIVER FUNCIONANDO**

1. **Customize o prompt:** edita `SYSTEM_PROMPT` no `server.js`
2. **Add mais respostas:** edita as perguntas comuns no prompt
3. **Monitore mensagens:** ativa logs no Vercel → Deployments → Logs
4. **Escale:** quando tiver muitas mensagens, migra pra plano pago

---

**Pronto! Seu bot está 24/7 no ar! 🚀**
