# Sistema de Usuários e Notificações Real-time

## 📋 Visão Geral

Sistema completo de rastreamento de usuários e notificações em tempo real implementado com Firebase Firestore.

## ✨ Funcionalidades Implementadas

### 1. Sistema de Usuários

#### Registro com Nome Obrigatório
- Campo `name` adicionado ao formulário de registro
- Validação mínima de 3 caracteres
- Nome salvo no perfil do Firebase Auth (`displayName`)
- Documento de usuário criado automaticamente no Firestore

#### Coleção `users` no Firestore
```typescript
{
  uid: string;           // ID do Firebase Auth
  email: string;         // Email do usuário
  name: string;          // Nome completo
  created_at: string;    // Data de criação
  updated_at: string;    // Data de atualização
}
```

#### Context Provider Aprimorado
- `user`: Dados do Firebase Auth
- `userData`: Dados estendidos do Firestore
- Carregamento automático ao fazer login
- Sincronização em tempo real

### 2. Rastreamento de Autoria

#### Campos Adicionados aos Tipos

**NT (Nota de Transferência):**
```typescript
{
  // ... campos existentes
  created_by?: string;        // UID do criador
  created_by_name?: string;   // Nome do criador
  updated_by?: string;        // UID do último editor
  updated_by_name?: string;   // Nome do último editor
}
```

**NTItem (Item da NT):**
```typescript
{
  // ... campos existentes
  created_by?: string;        // UID do criador
  created_by_name?: string;   // Nome do criador
  updated_by?: string;        // UID do último editor
  updated_by_name?: string;   // Nome do último editor
}
```

#### Funções Atualizadas

Todas as operações CRUD agora incluem informações do usuário:

**`createNT()`**
- Registra quem criou a NT
- Inclui UID e nome do usuário
- Timestamp de criação/atualização

**`updateNT()`**
- Registra quem editou a NT
- Atualiza campos `updated_by`
- Novo timestamp de atualização

**`createNTItem()`**
- Registra quem criou o item
- Inclui UID e nome do usuário

**`updateNTItem()`**
- Registra quem editou o item
- Usado em edições de campos e mudanças de status

### 3. Sistema de Notificações Real-time

#### Listeners do Firebase

**Listener de NTs:**
```typescript
onSnapshot(ntsQuery, (snapshot) => {
  // Detecta: added, modified, removed
  // Notifica outros usuários
  // Exclui ações do próprio usuário
});
```

**Listener de Items:**
```typescript
onSnapshot(itemsQuery, (snapshot) => {
  // Detecta: added, modified, removed
  // Notifica com detalhes do item
  // Inclui mudanças de status
});
```

#### Tipos de Notificações

| Tipo | Evento | Mensagem |
|------|--------|----------|
| `nt_created` | NT criada | "João Silva criou a NT #1234" |
| `nt_updated` | NT editada | "Maria Santos editou a NT #1234" |
| `nt_deleted` | NT deletada | "Pedro Costa deletou a NT #1234" |
| `item_added` | Item adicionado | "Ana Lima adicionou item ABC-123 - Material X" |
| `item_updated` | Item editado | "Carlos Souza editou item ABC-123 (Status: Pago)" |
| `item_deleted` | Item deletado | "Julia Rocha deletou item ABC-123" |

#### Feedback Visual e Sonoro

**Toast Notifications:**
- Aparecem no canto da tela
- Incluem ícones apropriados (📋, ✏️, 🗑️)
- Duração: 4 segundos
- Somente para NTs criadas (evita spam)

**Sons de Notificação:**
- Configuráveis nas configurações
- Tipos disponíveis: impacto, triunfo, alerta, fanfarra, poder, clássico
- Volume ajustável
- Podem ser desativados

**Centro de Notificações:**
- Badge com contador de não lidas
- Lista completa de notificações
- Marcar como lida individualmente
- Marcar todas como lidas
- Limpar todas as notificações

### 4. Filtros Inteligentes

O sistema **não notifica** o próprio usuário sobre suas ações:
```typescript
// Verifica antes de notificar
if (ntData.created_by === user.uid || ntData.updated_by === user.uid) {
  return; // Não notifica
}
```

Isso evita:
- Notificações desnecessárias
- Poluição do centro de notificações
- Sons repetitivos

## 🔧 Como Usar

### Para Desenvolvedores

#### 1. Obter Informações do Usuário Atual

```typescript
import { useFirebase } from '@/components/providers/firebase-provider';

function MyComponent() {
  const { user, userData } = useFirebase();
  
  console.log(userData?.name); // Nome do usuário
  console.log(user?.uid);      // ID do usuário
}
```

#### 2. Adicionar Notificações Personalizadas

```typescript
import { useNotifications } from '@/components/providers/notification-provider';

function MyComponent() {
  const { addNotification } = useNotifications();
  
  addNotification({
    title: 'Título',
    message: 'Mensagem detalhada',
    type: 'system',
    entityId: 'optional-id'
  });
}
```

#### 3. Configurar Sons de Notificação

```typescript
const { updateAudioConfig, testSound } = useNotifications();

// Alterar volume
updateAudioConfig({ volume: 0.8 });

// Alterar tipo de som
updateAudioConfig({ soundType: 'triumph' });

// Desativar sons
updateAudioConfig({ enabled: false });

// Testar som atual
testSound();
```

### Para Usuários

#### 1. Registro
1. Acesse a página de registro
2. Preencha o **nome completo** (obrigatório)
3. Preencha email e senha
4. Clique em "Registrar"

#### 2. Receber Notificações
- **Automático**: O sino na topbar mostra um badge com o número de não lidas
- **Clique no sino**: Abre o painel de notificações
- **Som**: Toca quando outros usuários fazem alterações

#### 3. Configurar Notificações
1. Vá em "Configurações"
2. Seção "Configuração de Sons"
3. Ajuste:
   - Ativar/desativar sons
   - Tipo de som
   - Volume (0-100%)
   - Testar som

## 📊 Estrutura de Dados

### Firestore Collections

```
firestore/
├── users/
│   └── {uid}/
│       ├── uid: string
│       ├── email: string
│       ├── name: string
│       ├── created_at: string
│       └── updated_at: string
│
├── nts/
│   └── {ntId}/
│       ├── nt_number: string
│       ├── created_at: Timestamp
│       ├── updated_at: Timestamp
│       ├── created_by: string (opcional)
│       ├── created_by_name: string (opcional)
│       ├── updated_by: string (opcional)
│       └── updated_by_name: string (opcional)
│
└── nt_items/
    └── {itemId}/
        ├── nt_id: string
        ├── code: string
        ├── description: string
        ├── ... outros campos
        ├── created_by: string (opcional)
        ├── created_by_name: string (opcional)
        ├── updated_by: string (opcional)
        └── updated_by_name: string (opcional)
```

## 🔐 Segurança

### Campos Opcionais
Os campos `created_by` e `updated_by` são **opcionais** para manter compatibilidade com dados antigos.

### Validação no Cliente
```typescript
const userInfo = await getCurrentUserInfo();
if (userInfo) {
  // Adiciona informações do usuário
  data.created_by = userInfo.uid;
  data.created_by_name = userInfo.name;
}
```

### Regras Sugeridas do Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users: apenas leitura própria e edição própria
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // NTs: leitura para autenticados, escrita com validação
    match /nts/{ntId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null 
                    && request.resource.data.created_by == request.auth.uid;
      allow update: if request.auth != null;
      allow delete: if request.auth != null;
    }
    
    // Items: mesmas regras
    match /nt_items/{itemId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null 
                    && request.resource.data.created_by == request.auth.uid;
      allow update: if request.auth != null;
      allow delete: if request.auth != null;
    }
  }
}
```

## 🎯 Benefícios

### Colaboração Melhorada
- Saber quem criou/editou cada NT e item
- Notificações instantâneas sobre mudanças
- Histórico de autoria preservado

### Auditoria Completa
- Rastreamento de todas as operações
- Timestamps precisos
- Identificação do autor

### Experiência do Usuário
- Feedback visual e sonoro imediato
- Notificações não intrusivas
- Configurações personalizáveis

### Transparência
- Todos sabem quem fez o quê
- Facilita comunicação da equipe
- Reduz confusões e mal-entendidos

## 🔄 Compatibilidade

### Dados Antigos
Documentos criados antes da implementação não terão campos de autoria, mas continuarão funcionando normalmente.

### Migração Gradual
Conforme os documentos são editados, os campos de autoria são adicionados automaticamente.

## 🚀 Próximos Passos (Opcional)

1. **Dashboard de Auditoria**: Página para visualizar todas as ações por usuário
2. **Filtros por Autor**: Filtrar NTs/items por quem criou/editou
3. **Notificações por Email**: Enviar resumo diário de atividades
4. **Menções**: Sistema de @mencionar usuários
5. **Comentários**: Adicionar comentários em NTs e items
6. **Histórico Detalhado**: Visualizar todas as mudanças com diff

## 📝 Logs de Desenvolvimento

Todos os métodos CRUD agora incluem logs informativos:
```
✅ Usuário criado com sucesso: { uid, email, name }
✅ NT criada por João Silva (abc123...)
✅ Item atualizado por Maria Santos (def456...)
🔔 Configurando listeners de notificação Firebase
```

## 🐛 Troubleshooting

### Notificações não aparecem
1. Verificar se está logado
2. Verificar se notificações estão ativas (sino na topbar)
3. Verificar console do navegador por erros

### Som não toca
1. Ir em Configurações
2. Verificar se sons estão ativados
3. Testar som com o botão "Testar Som"
4. Ajustar volume

### Nome não aparece ao registrar
1. Limpar cache do navegador
2. Fazer logout e login novamente
3. Verificar Firestore Console se documento foi criado

---

**Autor**: Sistema implementado em 23/10/2025
**Branch**: agile2.0
**Commit**: feat: Implementar sistema de usuários e notificações real-time
