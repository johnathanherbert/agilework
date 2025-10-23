# Configuração de Regras do Firestore - Usuários Online

## Problema
Erro: `Missing or insufficient permissions` ao tentar buscar usuários online.

## Solução

### Opção 1: Regras Recomendadas para Produção

Acesse o Firebase Console e configure as seguintes regras:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to check if user owns the resource
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Users collection
    // - Qualquer usuário autenticado pode LER todos os documentos (necessário para online users)
    // - Mas só pode ESCREVER no próprio documento
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId);
    }
    
    // NTs collection - authenticated users can read/write all NTs
    match /nts/{ntId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated();
      allow delete: if isAuthenticated();
    }
    
    // NT Items collection - authenticated users can read/write all items
    match /nt_items/{itemId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated();
      allow delete: if isAuthenticated();
    }
    
    // Notifications collection - users can only access their own notifications
    match /notifications/{notificationId} {
      allow read: if isAuthenticated() && 
                     resource.data.user_id == request.auth.uid;
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && 
                      resource.data.user_id == request.auth.uid;
      allow delete: if isAuthenticated() && 
                      resource.data.user_id == request.auth.uid;
    }
    
    // Chat messages - authenticated users can read all and create
    // Only owner can delete their own messages
    match /chat_messages/{messageId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow delete: if isAuthenticated() && 
                      resource.data.userId == request.auth.uid;
    }
  }
}
```

### Opção 2: Regras Simples para Desenvolvimento (NÃO usar em produção)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Passos para Aplicar

1. Acesse: https://console.firebase.google.com
2. Selecione seu projeto
3. Menu lateral > **Firestore Database**
4. Aba **Regras** (Rules)
5. Cole as regras acima
6. Clique em **Publicar** (Publish)
7. Aguarde alguns segundos para propagar
8. Recarregue a aplicação

## Verificar se Funcionou

Após aplicar as regras, você deve ver no console:
- ✅ Presence updated for user: [seu-id]
- 👥 Fetching online users...
- 📊 Online users count: [número]

## Funcionalidades que Dependem dessas Regras

- ✅ Sistema de usuários online
- ✅ Cascata de avatares na topbar
- ✅ Atualização de presença em tempo real
- ✅ Notificações do sistema
- ✅ Gestão de NTs e itens
- ✅ Chat rápido entre usuários
- ✅ Highlight automático de lotes e códigos no chat
