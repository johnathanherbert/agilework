# 🔥 Firebase Configurado - Próximos Passos

## ✅ Configurações Aplicadas

Seu projeto Firebase **agiliework** está configurado com:
- API Key: `AIzaSyCbVzZhBeATi-UdXLgHJanZ1Bnrm_PIhMc`
- Project ID: `agiliework`
- Auth Domain: `agiliework.firebaseapp.com`
- Firebase Analytics habilitado

## 📋 Configure o Firebase Console

### 1. Ativar Authentication

1. Acesse: https://console.firebase.google.com/project/agiliework/authentication
2. Clique em **"Get started"**
3. Na aba **Sign-in method**, ative:
   - ✅ **Email/Password** (clique em Enable)
4. Salve as configurações

### 2. Criar Firestore Database

1. Acesse: https://console.firebase.google.com/project/agiliework/firestore
2. Clique em **"Create database"**
3. Selecione:
   - 🌎 Location: **southamerica-east1 (São Paulo)** ← Melhor para Brasil
   - 🔒 Mode: **Production mode** (depois configuramos regras)
4. Clique em **"Create"**

### 3. Configurar Regras de Segurança do Firestore

No console do Firestore, vá em **Rules** e substitua por:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Função para verificar autenticação
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Regras para NTs
    match /nts/{ntId} {
      allow read, write: if isAuthenticated();
    }
    
    // Regras para itens de NT
    match /nt_items/{itemId} {
      allow read, write: if isAuthenticated();
    }
    
    // Regras para usuários
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && request.auth.uid == userId;
    }
    
    // Regras para notificações
    match /notifications/{notificationId} {
      allow read, write: if isAuthenticated();
    }
  }
}
```

### 4. Criar Índices Compostos

No Firestore, vá em **Indexes** e adicione:

**Índice 1: NTs ordenadas por data**
- Collection: `nts`
- Fields: `created_at` (Descending)
- Query scope: Collection

**Índice 2: Itens por NT**
- Collection: `nt_items`
- Fields: 
  - `nt_id` (Ascending)
  - `item_number` (Ascending)
- Query scope: Collection

## 🧪 Testar a Aplicação

### 1. Reiniciar o servidor de desenvolvimento

```bash
# Parar o servidor (Ctrl+C)
# Rodar novamente
npm run dev
```

### 2. Testar Autenticação

1. Acesse: http://localhost:3000/register
2. Crie uma conta de teste
3. Faça login com as credenciais

### 3. Testar CRUD de NTs

Após login, teste:
- ✅ Criar nova NT
- ✅ Adicionar itens à NT
- ✅ Editar NT e itens
- ✅ Mudar status de itens
- ✅ Deletar itens e NTs

## ⚠️ Problemas Comuns

### "Firebase: Error (auth/operation-not-allowed)"
→ Você esqueceu de ativar Email/Password no Authentication

### "Missing or insufficient permissions"
→ Regras de segurança do Firestore não foram aplicadas

### "Index not found"
→ Você precisa criar os índices compostos no console

## 📊 Status da Migração

### ✅ Completo (60%)
- Firebase configurado
- Autenticação migrada
- Modais de NT e Item migrados
- Firestore helpers criados

### 🚧 Pendente (40%)
- Página principal de NTs (usa subscribeToNTs)
- Componentes auxiliares (5 arquivos)
- Outras páginas (4 páginas)

## 🎯 Próximo Passo

Após configurar o Firebase Console, volte e me avise para continuarmos a migração dos componentes restantes!

```bash
# Quando terminar a configuração, rode:
npm run dev

# E teste o login/registro
```

## 🔗 Links Úteis

- Console do Projeto: https://console.firebase.google.com/project/agiliework
- Authentication: https://console.firebase.google.com/project/agiliework/authentication
- Firestore: https://console.firebase.google.com/project/agiliework/firestore
- Documentação: https://firebase.google.com/docs/web/setup
