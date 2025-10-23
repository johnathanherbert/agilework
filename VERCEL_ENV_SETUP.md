# 🔐 Configuração de Variáveis de Ambiente no Vercel

## ⚠️ AÇÃO NECESSÁRIA ANTES DO BUILD FUNCIONAR

O build está falando porque as variáveis de ambiente do Firebase não estão configuradas no Vercel.

## 📋 Passos para Configurar

### 1. Acesse as Configurações do Projeto no Vercel

1. Vá para o dashboard do Vercel
2. Selecione seu projeto (agilework)
3. Clique em **Settings** (Configurações)
4. No menu lateral, clique em **Environment Variables**

### 2. Adicione as Variáveis de Ambiente

Adicione **TODAS** as seguintes variáveis, uma por uma:

```bash
# Nome da Variável: NEXT_PUBLIC_FIREBASE_API_KEY
# Valor: AIzaSyCbVzZhBeATi-UdXLgHJanZ1Bnrm_PIhMc
# Environments: Production, Preview, Development (marque todos)

# Nome da Variável: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
# Valor: agiliework.firebaseapp.com
# Environments: Production, Preview, Development (marque todos)

# Nome da Variável: NEXT_PUBLIC_FIREBASE_PROJECT_ID
# Valor: agiliework
# Environments: Production, Preview, Development (marque todos)

# Nome da Variável: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
# Valor: agiliework.firebasestorage.app
# Environments: Production, Preview, Development (marque todos)

# Nome da Variável: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
# Valor: 405548227705
# Environments: Production, Preview, Development (marque todos)

# Nome da Variável: NEXT_PUBLIC_FIREBASE_APP_ID
# Valor: 1:405548227705:web:54b317c96684ab648388a8
# Environments: Production, Preview, Development (marque todos)

# Nome da Variável: NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
# Valor: G-K4BFJ35RBB
# Environments: Production, Preview, Development (marque todos)
```

### 3. Como Adicionar Cada Variável

Para cada variável acima:

1. Clique no botão **"Add New"** ou **"Add Variable"**
2. Em **Name**, cole o nome da variável (ex: `NEXT_PUBLIC_FIREBASE_API_KEY`)
3. Em **Value**, cole o valor correspondente
4. Em **Environments**, marque **TODOS** os checkboxes:
   - ✅ Production
   - ✅ Preview  
   - ✅ Development
5. Clique em **Save**
6. Repita para todas as 7 variáveis

### 4. Redesploy Após Adicionar Variáveis

Depois de adicionar todas as variáveis:

1. Vá para a aba **Deployments**
2. Encontre o deployment mais recente que falhou
3. Clique nos três pontinhos (**...**) à direita
4. Clique em **Redeploy**
5. Confirme o redeploy

**OU** simplesmente faça um novo commit e push:

```bash
git commit --allow-empty -m "trigger: redeploy with env vars"
git push origin agile2.0
```

## ✅ Verificação

Após o redeploy, o build deve:
1. ✅ Instalar dependências com sucesso
2. ✅ Compilar sem erros de Firebase
3. ✅ Gerar páginas estáticas
4. ✅ Concluir o deploy com sucesso

## 🔍 Troubleshooting

### Build ainda falha?

Verifique se:
- ✅ Todas as 7 variáveis foram adicionadas
- ✅ Não há espaços extras nos valores
- ✅ Todas as variáveis têm "Production" marcado
- ✅ Você fez o redeploy **APÓS** adicionar as variáveis

### Como verificar se as variáveis foram salvas?

1. Vá em Settings → Environment Variables
2. Você deve ver todas as 7 variáveis listadas
3. Cada uma deve ter um ícone de "Production" ao lado

## 📱 Próximos Passos Após Deploy Bem-Sucedido

1. **Adicionar domínio Vercel ao Firebase**:
   - Firebase Console → Authentication → Settings
   - Authorized domains → Add domain
   - Adicionar: `seu-projeto.vercel.app`

2. **Testar a aplicação**:
   - Login/registro
   - Dashboard
   - Chat em tempo real
   - Notificações

---

## 🆘 Precisa de Ajuda?

Se o build continuar falhando após adicionar as variáveis:
1. Copie a mensagem de erro completa do Vercel
2. Compartilhe comigo para análise
3. Verificaremos logs detalhados
