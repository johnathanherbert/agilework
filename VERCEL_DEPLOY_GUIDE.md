# 🚀 Guia de Deploy Paralelo no Vercel

Este guia explica como fazer deploy de uma versão paralela da aplicação no Vercel, mantendo a versão antiga no ar.

## 📋 Pré-requisitos

- Conta no Vercel (https://vercel.com)
- Repositório no GitHub com a branch `agile2.0`
- Acesso ao Firebase Console

## 🔧 Passo 1: Preparar o Projeto

### 1.1. Criar arquivo vercel.json (opcional)

Este arquivo pode ser usado para configurações específicas do Vercel:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "devCommand": "npm run dev"
}
```

### 1.2. Verificar variáveis de ambiente

Certifique-se de que todas as variáveis do `.env.local` estão documentadas.

**Variáveis necessárias:**
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCbVzZhBeATi-UdXLgHJanZ1Bnrm_PIhMc
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=agiliework.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=agiliework
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=agiliework.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=405548227705
NEXT_PUBLIC_FIREBASE_APP_ID=1:405548227705:web:54b317c96684ab648388a8
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-K4BFJ35RBB
```

## 🌐 Passo 2: Deploy no Vercel

### 2.1. Criar novo projeto no Vercel

1. Acesse https://vercel.com/dashboard
2. Clique em **"Add New..."** → **"Project"**
3. Selecione o repositório **agilework**
4. **IMPORTANTE:** Configure o nome do projeto diferente do original
   - Exemplo: `agilework-v2` ou `agilework-agile2`

### 2.2. Configurar Branch

Na seção **Configure Project**:
- **Framework Preset:** Next.js
- **Root Directory:** `./` (raiz do projeto)
- **Build Command:** `npm run build`
- **Output Directory:** `.next` (padrão Next.js)
- **Install Command:** `npm install`
- **Production Branch:** `agile2.0` ⚠️ **Mudar de `main` para `agile2.0`**

### 2.3. Adicionar Variáveis de Ambiente

Na seção **Environment Variables**, adicione todas as variáveis:

```
NEXT_PUBLIC_FIREBASE_API_KEY = AIzaSyCbVzZhBeATi-UdXLgHJanZ1Bnrm_PIhMc
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = agiliework.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID = agiliework
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = agiliework.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 405548227705
NEXT_PUBLIC_FIREBASE_APP_ID = 1:405548227705:web:54b317c96684ab648388a8
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = G-K4BFJ35RBB
```

**IMPORTANTE:** Marque todas as variáveis para os 3 ambientes:
- ✅ Production
- ✅ Preview
- ✅ Development

### 2.4. Deploy

1. Clique em **"Deploy"**
2. Aguarde o build completar (3-5 minutos)
3. Vercel fornecerá uma URL como: `https://agilework-v2.vercel.app`

## 🔥 Passo 3: Configurar Firebase

### 3.1. Adicionar domínio autorizado

1. Acesse o Firebase Console: https://console.firebase.google.com
2. Selecione o projeto **agiliework**
3. Vá em **Authentication** → **Settings** → **Authorized domains**
4. Clique em **"Add domain"**
5. Adicione o novo domínio Vercel:
   - `agilework-v2.vercel.app` (exemplo)
   - Ou qualquer outro domínio personalizado

### 3.2. Atualizar Firestore Rules (se necessário)

Se houver rules específicas por domínio, atualize em:
**Firestore Database** → **Rules**

## ✅ Passo 4: Testar o Deploy

### 4.1. Checklist de testes

- [ ] Acessar a URL do Vercel
- [ ] Login funciona corretamente
- [ ] Dashboard carrega dados
- [ ] Usuários online aparecem
- [ ] Chat funciona (enviar/receber mensagens)
- [ ] Notificações funcionam
- [ ] Sons tocam corretamente
- [ ] Dark mode funciona
- [ ] NTs podem ser criadas/editadas
- [ ] Itens podem ser adicionados/pagos

### 4.2. Verificar logs

- No Vercel Dashboard → **Deployments** → Clique no deploy → **Logs**
- No Firebase Console → **Firestore** → Verificar se dados estão sendo criados

## 🔄 Passo 5: Gerenciar Versões

### App Antigo (Produção Original)
- Branch: `main` (ou a branch original)
- URL: URL original do Vercel
- Status: **Mantido no ar** como fallback

### App Novo (Versão Paralela)
- Branch: `agile2.0`
- URL: URL nova do Vercel
- Status: **Teste/Staging** ou **Nova Produção**

### Estratégias de rollout

**Opção 1: Deploy Gradual**
1. Teste extensivo na nova URL
2. Compartilhe com alguns usuários
3. Se tudo OK, promova para produção

**Opção 2: A/B Testing**
1. Mantenha ambas versões no ar
2. Direcione tráfego gradualmente
3. Monitore métricas

**Opção 3: Switch Completo**
1. Quando nova versão estiver estável
2. Configure domínio customizado para apontar para novo deploy
3. Mantenha antigo como backup

## 🚨 Rollback em Caso de Problema

Se algo der errado:

1. **No Vercel:**
   - Vá em **Deployments**
   - Encontre um deploy anterior estável
   - Clique nos 3 pontos → **"Promote to Production"**

2. **Redirecionar usuários:**
   - Compartilhe a URL do app antigo
   - Firebase continuará funcionando para ambos

3. **Investigar problemas:**
   - Verifique logs no Vercel
   - Verifique console do navegador (F12)
   - Verifique Firestore rules e permissions

## 📊 Monitoramento

### Vercel Analytics
- Ative no Dashboard → **Analytics**
- Monitore performance e erros

### Firebase Console
- **Authentication:** Verificar logins
- **Firestore:** Verificar operações de leitura/escrita
- **Usage:** Monitorar limites

## 🔐 Segurança

### Configurações Recomendadas

1. **Environment Variables:**
   - Nunca commitar `.env.local`
   - Usar Vercel Environment Variables

2. **Firestore Rules:**
   - Manter rules restritivas
   - Testar com Firebase Emulator

3. **CORS:**
   - Configurar apenas domínios autorizados

## 📝 Notas Importantes

- ⚠️ **Dois apps compartilharão o mesmo Firebase** (mesmos dados)
- ⚠️ **Usuários verão TODOS os dados** independente do app usado
- ⚠️ Se quiser ambientes separados, crie um novo projeto Firebase
- ✅ **Versionamento automático** funciona (version.json)
- ✅ **Build command** incrementa versão automaticamente

## 🆘 Troubleshooting

### Build falha no Vercel
```bash
# Localmente, teste o build
npm run build

# Se falhar, verifique:
# 1. TypeScript errors
npm run lint

# 2. Missing dependencies
npm install
```

### Firebase Authentication não funciona
- Verificar domínio em **Authorized domains**
- Verificar variáveis de ambiente no Vercel

### Firestore permission denied
- Verificar rules no Firebase Console
- Testar com usuário autenticado

### Chat não funciona
- Verificar rules de `private_messages`
- Verificar se `users` collection tem permissão de leitura

## 🎯 Comandos Úteis

```bash
# Build local (testa antes do deploy)
npm run build

# Build sem incrementar versão
npm run build:no-version

# Ver versão atual
npm run version:current

# Resetar versão (se necessário)
npm run version:reset

# Deploy manual via CLI (alternativa)
npx vercel --prod
```

## 📚 Links Úteis

- Vercel Dashboard: https://vercel.com/dashboard
- Firebase Console: https://console.firebase.google.com
- Vercel Docs: https://vercel.com/docs
- Next.js Deployment: https://nextjs.org/docs/deployment

---

## ✨ Resumo Rápido

1. ✅ Criar novo projeto no Vercel
2. ✅ Configurar branch `agile2.0`
3. ✅ Adicionar variáveis de ambiente
4. ✅ Deploy
5. ✅ Adicionar domínio no Firebase
6. ✅ Testar tudo
7. ✅ Manter app antigo como backup

**Tempo estimado:** 15-20 minutos

**Dificuldade:** ⭐⭐☆☆☆ (Fácil a Média)
