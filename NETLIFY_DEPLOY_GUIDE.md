# 🚀 Guia de Deploy no Netlify

## Pré-requisitos

- Conta no [Netlify](https://app.netlify.com)
- Repositório no GitHub/GitLab com o código
- Projeto Firebase configurado

---

## 📦 Variáveis de Ambiente Necessárias

No Netlify Dashboard → Site → **Environment variables**, adicione:

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | API Key do Firebase |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth Domain do Firebase |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Project ID do Firebase |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage Bucket do Firebase |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Messaging Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID do Firebase |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Measurement ID (Analytics) |

---

## ☁️ Passos para Deploy

### Opção 1 — Via Dashboard (Recomendado)

1. Acesse [app.netlify.com](https://app.netlify.com)
2. Clique em **"Add new site" → "Import an existing project"**
3. Conecte ao seu repositório GitHub
4. Configure o build:
   - **Branch:** `agile2.0` (ou `main`)
   - **Build command:** `npm run build:no-version`
   - **Publish directory:** `.next`
5. Adicione todas as **variáveis de ambiente** (tabela acima)
6. Clique em **"Deploy site"**

### Opção 2 — Via CLI

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Na raiz do projeto:
netlify init

# Deploy de produção
netlify deploy --prod
```

---

## 🔥 Configuração do Firebase

Após o deploy, adicione o domínio do Netlify ao Firebase:

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Vá em **Authentication → Settings → Authorized domains**
3. Adicione o domínio gerado: `seu-site.netlify.app`

---

## ⚙️ Arquivos de Configuração Criados

- **`netlify.toml`** — Configurações de build, headers de segurança e plugin Next.js
- **`next.config.js`** — Atualizado para suportar variável `COMMIT_REF` do Netlify

---

## 🧪 Testar Build Localmente

```bash
npm run build:no-version
npm run start
```

---

## 🔄 Deploy Automático (CD)

O Netlify faz deploy automático a cada `git push` para a branch configurada. Nenhuma ação manual necessária após a configuração inicial.

---

## 🚨 Diferenças vs Vercel

| Feature | Vercel | Netlify |
|---|---|---|
| Plugin Next.js | Nativo | `@netlify/plugin-nextjs` |
| Variável de commit | `VERCEL_GIT_COMMIT_SHA` | `COMMIT_REF` |
| Região BR | `gru1` | Automático (CDN global) |
| Config file | `vercel.json` | `netlify.toml` |

---

**Versão do app:** 0.1.16  
**Branch:** agile2.0
