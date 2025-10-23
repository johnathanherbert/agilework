# Migração para Firebase - Branch agile2.0

Este documento descreve a migração do sistema de Supabase para Firebase na branch `agile2.0`.

## Status da Migração

### ✅ Concluído

1. **Configuração do Firebase**
   - Instalado Firebase SDK (`npm install firebase`)
   - Criado `/src/lib/firebase.ts` com inicialização do Firebase
   - Criado arquivo `.env.example` com variáveis necessárias

2. **Autenticação**
   - Criado `FirebaseProvider` para substituir `SupabaseProvider`
   - Atualizado `layout.tsx` para usar `FirebaseProvider`
   - Atualizado `login-form.tsx` para usar Firebase Auth
   - Atualizado `register-form.tsx` para usar Firebase Auth
   - Atualizado `protected-route.tsx` para usar Firebase Auth

3. **Helpers do Firestore**
   - Criado `/src/lib/firestore-helpers.ts` com funções para:
     - CRUD de NTs (getNTs, createNT, updateNT, deleteNT)
     - CRUD de Itens (createNTItem, updateNTItem, deleteNTItem)
     - Listeners em tempo real (subscribeToNTs, subscribeToNTItems)

### 🚧 Pendente

1. **Atualizar Componentes** (17 arquivos)
   - [ ] `/src/app/almoxarifado/nts/page.tsx` - Página principal de NTs
   - [ ] `/src/app/dashboard/dashboard-new.tsx` - Dashboard
   - [ ] `/src/app/analytics/page-new.tsx` - Analytics
   - [ ] `/src/app/settings/page.tsx` - Settings
   - [ ] `/src/app/robot-status/page.tsx` - Robot Status
   - [ ] `/src/components/nt-manager/add-nt-modal.tsx`
   - [ ] `/src/components/nt-manager/add-item-modal.tsx`
   - [ ] `/src/components/nt-manager/add-bulk-nt-modal.tsx`
   - [ ] `/src/components/nt-manager/edit-nt-modal.tsx`
   - [ ] `/src/components/nt-manager/edit-item-modal.tsx`
   - [ ] `/src/components/nt-manager/edit-field-modal.tsx`
   - [ ] `/src/components/nt-manager/delete-confirmation-modal.tsx`
   - [ ] `/src/components/nt-manager/nt-item-row.tsx`
   - [ ] `/src/components/nt-manager/realtime-stats-card.tsx`
   - [ ] `/src/components/providers/notification-provider.tsx`
   - [ ] `/src/hooks/useTimelineRealtime.ts`

2. **Estrutura do Banco de Dados Firebase**
   - Criar coleções no Firestore:
     - `nts` - Notas Técnicas
     - `nt_items` - Itens das NTs
     - `users` - Usuários
     - `notifications` - Notificações
   - Configurar regras de segurança do Firestore
   - Configurar índices compostos necessários

3. **Migração de Dados**
   - Exportar dados do Supabase
   - Importar dados para Firestore
   - Validar integridade dos dados

## Configuração

### 1. Criar Projeto no Firebase

1. Acesse https://console.firebase.google.com/
2. Clique em "Adicionar projeto"
3. Siga os passos para criar o projeto
4. No painel do projeto, clique no ícone de engrenagem > "Configurações do projeto"
5. Role até "Seus aplicativos" e clique no ícone `</>` para adicionar um app web
6. Copie as configurações do Firebase

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=sua-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu-projeto-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=seu-app-id
```

### 3. Configurar Firestore

1. No console do Firebase, vá para "Firestore Database"
2. Clique em "Criar banco de dados"
3. Escolha o modo de produção
4. Escolha a localização (preferencialmente `southamerica-east1` para o Brasil)

### 4. Estrutura do Firestore

```
firestore/
├── nts/
│   └── {ntId}
│       ├── nt_number: string
│       ├── created_at: timestamp
│       ├── updated_at: timestamp
│       └── status: string
│
├── nt_items/
│   └── {itemId}
│       ├── nt_id: string (referência)
│       ├── item_number: number
│       ├── code: string
│       ├── description: string
│       ├── quantity: string
│       ├── batch: string | null
│       ├── created_date: string
│       ├── created_time: string
│       ├── payment_time: string | null
│       ├── status: string
│       ├── created_at: timestamp
│       ├── updated_at: timestamp
│       └── priority: boolean
│
├── users/
│   └── {userId}
│       ├── email: string
│       ├── name: string | null
│       ├── role: string
│       └── created_at: timestamp
│
└── notifications/
    └── {notificationId}
        ├── user_id: string
        ├── message: string
        ├── type: string
        ├── read: boolean
        ├── created_at: timestamp
        └── data: object
```

### 5. Regras de Segurança do Firestore

Adicione as seguintes regras no console do Firebase:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Função auxiliar para verificar se está autenticado
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Função auxiliar para verificar se é o próprio usuário
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Regras para NTs
    match /nts/{ntId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated();
      allow delete: if isAuthenticated();
    }
    
    // Regras para itens de NT
    match /nt_items/{itemId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated();
      allow delete: if isAuthenticated();
    }
    
    // Regras para usuários
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId);
    }
    
    // Regras para notificações
    match /notifications/{notificationId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated();
      allow delete: if isAuthenticated();
    }
  }
}
```

### 6. Índices do Firestore

Crie os seguintes índices compostos no console do Firebase:

1. **Coleção `nts`**
   - Campos: `created_at` (Descending)
   - Modo de consulta: Coleção

2. **Coleção `nt_items`**
   - Campos: `nt_id` (Ascending), `created_at` (Ascending)
   - Modo de consulta: Coleção

## Como Substituir Supabase por Firebase nos Componentes

### Padrão Antigo (Supabase):

```typescript
import { supabase } from '@/lib/supabase';

// Buscar dados
const { data, error } = await supabase
  .from('nts')
  .select('*, items:nt_items(*)')
  .order('created_at', { ascending: false });

// Real-time
const channel = supabase
  .channel('nts_changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'nts' }, 
    (payload) => { /* ... */ }
  )
  .subscribe();
```

### Padrão Novo (Firebase):

```typescript
import { getNTs, subscribeToNTs } from '@/lib/firestore-helpers';

// Buscar dados
try {
  const nts = await getNTs();
  setNts(nts);
} catch (error) {
  console.error('Error fetching NTs:', error);
}

// Real-time
const unsubscribe = subscribeToNTs(
  (nts) => {
    setNts(nts);
  },
  (error) => {
    console.error('Error in subscription:', error);
  }
);

// Cleanup
return () => unsubscribe();
```

## Próximos Passos

1. **Configurar projeto Firebase** seguindo as instruções acima
2. **Adicionar variáveis de ambiente** no arquivo `.env.local`
3. **Atualizar componentes restantes** um por um, testando cada mudança
4. **Migrar dados** do Supabase para Firebase (se houver dados em produção)
5. **Testar todas as funcionalidades**:
   - Autenticação (login/registro/logout)
   - CRUD de NTs
   - CRUD de Itens
   - Atualizações em tempo real
   - Notificações
6. **Remover dependências do Supabase** quando tudo estiver funcionando
7. **Fazer merge da branch agile2.0** para master após testes completos

## Diferenças Principais

### Supabase vs Firebase

| Recurso | Supabase | Firebase |
|---------|----------|----------|
| Database | PostgreSQL | Firestore (NoSQL) |
| Real-time | Postgres Changes | onSnapshot listeners |
| Auth | Supabase Auth | Firebase Auth |
| Queries | SQL-like | NoSQL queries |
| Relations | Foreign keys | Subcollections ou refs |

### Considerações de Migração

1. **Estrutura de dados**: Firestore é NoSQL, então relações precisam ser tratadas diferentemente
2. **Queries**: Firebase tem limitações em queries complexas (sem JOINs nativos)
3. **Real-time**: Firebase usa listeners em vez de canais Postgres
4. **Custos**: Firebase cobra por leituras/escritas, Supabase por conexões ativas

## Comandos Úteis

```bash
# Verificar branch atual
git branch

# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build de produção
npm run build

# Voltar para master
git checkout master

# Comparar branches
git diff master..agile2.0
```

## Suporte

Se encontrar problemas durante a migração, verifique:

1. Console do Firebase para erros
2. Console do navegador para erros de autenticação
3. Regras de segurança do Firestore
4. Variáveis de ambiente configuradas corretamente
5. Índices do Firestore criados
