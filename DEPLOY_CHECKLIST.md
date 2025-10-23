# ✅ Checklist de Pré-Deploy

Use este checklist antes de fazer deploy no Vercel.

## 📦 Preparação do Código

- [ ] **Build local funciona**
  ```bash
  npm run build
  ```

- [ ] **Sem erros de TypeScript**
  ```bash
  npm run lint
  ```

- [ ] **Dependências atualizadas**
  ```bash
  npm install
  ```

- [ ] **Branch está limpa e commitada**
  ```bash
  git status
  git add .
  git commit -m "feat: versão 2.0 com chat integrado"
  git push origin agile2.0
  ```

## 🔐 Variáveis de Ambiente

- [ ] **Firebase API Key** - `NEXT_PUBLIC_FIREBASE_API_KEY`
- [ ] **Firebase Auth Domain** - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- [ ] **Firebase Project ID** - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- [ ] **Firebase Storage Bucket** - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- [ ] **Firebase Messaging Sender ID** - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- [ ] **Firebase App ID** - `NEXT_PUBLIC_FIREBASE_APP_ID`
- [ ] **Firebase Measurement ID** - `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

## 🌐 Configuração do Vercel

- [ ] **Novo projeto criado** (nome diferente do original)
- [ ] **Branch configurada:** `agile2.0`
- [ ] **Variáveis de ambiente adicionadas** (todos os ambientes)
- [ ] **Build command:** `npm run build`
- [ ] **Framework preset:** Next.js

## 🔥 Firebase Console

- [ ] **Domínio Vercel adicionado em Authorized domains**
- [ ] **Firestore Rules atualizadas** (ver firestore-rules.txt)
- [ ] **Authentication habilitado**

## 🧪 Testes Após Deploy

### Funcionalidades Críticas
- [ ] Login com email/senha
- [ ] Dashboard carrega dados
- [ ] Criação de NT
- [ ] Adição de itens
- [ ] Pagamento de itens
- [ ] Notificações aparecem
- [ ] Sons tocam

### Funcionalidades Novas (v2.0)
- [ ] Usuários online aparecem
- [ ] Cascata de avatares funciona
- [ ] Badge de mensagens não lidas aparece
- [ ] Chat abre ao clicar em usuário
- [ ] Envio de mensagem funciona
- [ ] Recebimento de mensagem funciona
- [ ] Sons do chat tocam (envio 0.3, recebimento 0.5)
- [ ] Highlights de lotes (M4R5767) aparecem em azul
- [ ] Highlights de códigos (010311) aparecem em roxo
- [ ] Mensagens marcadas como lidas automaticamente
- [ ] Foco mantido no input após enviar
- [ ] Scroll automático para última mensagem

### Compatibilidade
- [ ] Desktop funciona
- [ ] Mobile funciona
- [ ] Dark mode funciona
- [ ] Light mode funciona

### Performance
- [ ] Carregamento inicial < 3s
- [ ] Transições suaves
- [ ] Sem erros no console (F12)
- [ ] Sem warnings no console

## 🚨 Verificações de Segurança

- [ ] **Firestore Rules restritivas** (users, nts, nt_items, private_messages)
- [ ] **Authenticated users only** para todas as collections
- [ ] **Private messages** só visíveis para sender/receiver
- [ ] **Variáveis de ambiente** nunca commitadas
- [ ] **CORS configurado** apenas para domínios autorizados

## 📊 Monitoramento

- [ ] **Vercel Analytics** ativado
- [ ] **Firebase Usage** verificado (ainda dentro dos limites)
- [ ] **Logs do Vercel** sem erros críticos

## 🔄 Rollback Plan

- [ ] **App antigo** ainda funcional e acessível
- [ ] **URL do app antigo** documentada
- [ ] **Backup do Firebase** (se necessário)
- [ ] **Plano de comunicação** com usuários (se algo der errado)

## 📝 Documentação

- [ ] **README.md** atualizado
- [ ] **VERCEL_DEPLOY_GUIDE.md** revisado
- [ ] **firestore-rules.txt** atualizado
- [ ] **Version incrementada** automaticamente no build

## 🎯 Deploy Final

Quando tudo estiver ✅, execute:

```bash
# No Vercel Dashboard:
1. Configure o projeto
2. Adicione variáveis de ambiente
3. Clique em "Deploy"

# Ou via CLI:
npx vercel --prod
```

## ⏱️ Tempo Estimado

- Preparação: 10 minutos
- Deploy: 5 minutos
- Testes: 10 minutos
- **Total: ~25 minutos**

---

## 🆘 Se Algo Der Errado

1. **Não entre em pânico!**
2. **App antigo ainda está no ar**
3. **Verifique logs no Vercel**
4. **Verifique console do navegador (F12)**
5. **Verifique Firestore rules**
6. **Entre em contato se precisar de ajuda**

---

**Data da última atualização:** 23/10/2025  
**Versão do app:** 0.1.16  
**Branch:** agile2.0
