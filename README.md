# NT Manager 2.0

Sistema de gerenciamento de Notas Técnicas (NTs) desenvolvido com Next.js 13, TypeScript, Tailwind CSS e Firebase.

## 🌟 Novidades da Versão 2.0 (Branch agile2.0)

### 👥 Sistema de Presença Online
- Cascata de avatares mostrando usuários online
- Indicador visual de status (online/offline)
- Atualização em tempo real a cada 45 segundos
- Badge com contagem de mensagens não lidas

### 💬 Chat Privado Integrado
- Chat 1-on-1 entre usuários
- Integrado no popover de Usuários Online
- Notificações sonoras (envio e recebimento)
- Highlights automáticos de lotes (ex: M4R5767) e códigos (ex: 010311)
- Mensagens marcadas como lidas automaticamente
- Scroll automático para última mensagem
- Foco mantido no input após enviar

### 🎨 UI 2.0
- Redesign completo da página de login
- Gradientes modernos (blue→indigo→purple)
- Glassmorphism e efeitos de blur
- Animações suaves e responsivas
- Badges e indicadores visuais melhorados

### 🔊 Sistema de Sons
- 8 tipos de sons diferentes (notification, subtle, impact, triumph, etc)
- Sons contextuais (NT criada, item pago, mensagem recebida/enviada)
- Volumes diferenciados por ação
- Web Audio API com síntese de múltiplas camadas

## 🚀 Funcionalidades (v1.0 + v2.0)

- ✅ Gerenciamento completo de NTs (Criar, Editar, Excluir)
- 📋 Adição de itens via colagem direta do SAP
- 🔍 Filtragem avançada por status, data, turno e prioridade
- 🌓 Tema claro/escuro
- 📱 Interface responsiva
- ⚡ Atualizações em tempo real
- 🔐 Autenticação e autorização
- 📊 Dashboard com estatísticas
- 🤖 Monitoramento de robôs
- 🔔 Sistema de notificações
- 👥 **NOVO:** Usuários online com presença em tempo real
- 💬 **NOVO:** Chat privado integrado
- 🎨 **NOVO:** UI modernizada
- 🔊 **NOVO:** Sistema de áudio contextual

## 🛠️ Tecnologias

### Core
- [Next.js 14](https://nextjs.org/) - React Framework
- [React 18](https://reactjs.org/) - UI Library
- [TypeScript 5](https://www.typescriptlang.org/) - Type Safety
- [Tailwind CSS 3](https://tailwindcss.com/) - Styling

### UI Components
- [Shadcn/UI](https://ui.shadcn.com/) - Component Library
- [Radix UI](https://www.radix-ui.com/) - Headless Components
- [Lucide Icons](https://lucide.dev/) - Icon Library

### Backend & Database
- [Firebase](https://firebase.google.com/) - Authentication, Firestore, Real-time
- [Supabase](https://supabase.com/) - (Deprecated, migrated to Firebase)

### Audio & Real-time
- Web Audio API - Sound synthesis
- Firestore onSnapshot - Real-time updates
- Firebase Presence - Online status tracking

## 📦 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/nt-management-app.git
cd nt-management-app
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env.local
```
Edite o arquivo `.env.local` com suas configurações do Supabase.

4. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

## 🗄️ Estrutura do Projeto

```
src/
  ├── app/                    # Rotas e páginas
  ├── components/            
  │   ├── analytics/         # Componentes de análise
  │   ├── auth/              # Componentes de autenticação
  │   ├── layout/            # Componentes de layout (Sidebar, Topbar)
  │   ├── nt-manager/        # Componentes principais do gerenciador de NTs
  │   ├── providers/         # Providers do React Context
  │   └── ui/                # Componentes de UI reutilizáveis
  ├── lib/                   # Utilitários e configurações
  └── types/                 # Definições de tipos TypeScript
```

## 🔒 Autenticação

O sistema utiliza autenticação via Supabase com suporte a:
- Login com email/senha
- Gerenciamento de sessão
- Rotas protegidas
- Middleware de autenticação

## 🎯 Principais Recursos

### Gerenciamento de NTs
- Criação individual e em lote
- Edição de campos
- Exclusão com confirmação
- Histórico completo

### Filtragem e Busca
- Busca por número de NT
- Filtro por status
- Filtro por data
- Filtro por turno
- Filtro por prioridade
- Visualização de NTs concluídas

### Interface
- Design responsivo
- Temas claro/escuro
- Animações suaves
- Feedback visual
- Tooltips informativos

### Tempo Real
- Atualizações automáticas
- Notificações instantâneas
- Status de robôs em tempo real

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## ✨ Contribuição

Contribuições são bem-vindas! Por favor, leia o [CONTRIBUTING.md](CONTRIBUTING.md) para detalhes sobre como contribuir com o projeto.

## 👥 Autores

- Johnathan Herbert (@johnathanherbert)

## 📞 Suporte

Para reportar bugs ou solicitar novas funcionalidades, por favor abra uma [issue](https://github.com/seu-usuario/nt-management-app/issues).


   ```

3. **Create the NTs List Component**:
   Create a file named `NTsList.jsx`:
   ```javascript
   // src/components/NTsList.jsx
   export default function NTsList({ nts, onEditNT, onDeleteNT, isLoading }) {
     if (isLoading) return <div>Loading...</div>;

     return (
       <ul>
         {nts.map(nt => (
           <li key={nt.id}>
             {nt.nt_number}
             <button onClick={() => onEditNT(nt)}>Edit</button>
             <button onClick={() => onDeleteNT(nt.id)}>Delete</button>
           </li>
         ))}
       </ul>
     );
   }
   ```

4. **Create the Add NT Modal Component**:
   Create a file named `AddNTModal.jsx`:
   ```javascript
   // src/components/AddNTModal.jsx
   import { useState } from 'react';
   import { supabase } from '../supabaseClient';

   export default function AddNTModal({ isOpen, onClose, onNTAdded }) {
     const [ntNumber, setNtNumber] = useState('');

     const handleSubmit = async (e) => {
       e.preventDefault();
       await supabase.from('nts').insert([{ nt_number: ntNumber }]);
       onNTAdded();
     };

     if (!isOpen) return null;

     return (
       <div>
         <form onSubmit={handleSubmit}>
           <input value={ntNumber} onChange={(e) => setNtNumber(e.target.value)} placeholder="NT Number" />
           <button type="submit">Add NT</button>
           <button type="button" onClick={onClose}>Cancel</button>
         </form>
       </div>
     );
   }
   ```

5. **Create the Edit NT Modal Component**:
   Create a file named `EditNTModal.jsx`:
   ```javascript
   // src/components/EditNTModal.jsx
   import { useEffect, useState } from 'react';
   import { supabase } from '../supabaseClient';

   export default function EditNTModal({ isOpen, onClose, nt }) {
     const [ntNumber, setNtNumber] = useState('');

     useEffect(() => {
       if (isOpen && nt) {
         setNtNumber(nt.nt_number);
       }
     }, [isOpen, nt]);

     const handleSubmit = async (e) => {
       e.preventDefault();
       await supabase.from('nts').update({ nt_number: ntNumber }).eq('id', nt.id);
       onClose();
     };

     if (!isOpen || !nt) return null;

     return (
       <div>
         <form onSubmit={handleSubmit}>
           <input value={ntNumber} onChange={(e) => setNtNumber(e.target.value)} />
           <button type="submit">Save</button>
           <button type="button" onClick={onClose}>Cancel</button>
         </form>
       </div>
     );
   }
   ```

6. **Create the Delete Confirmation Modal Component**:
   Create a file named `DeleteConfirmationModal.jsx`:
   ```javascript
   // src/components/DeleteConfirmationModal.jsx
   export default function DeleteConfirmationModal({ isOpen, onClose, onConfirm }) {
     if (!isOpen) return null;

     return (
       <div>
         <p>Are you sure you want to delete this NT?</p>
         <button onClick={onConfirm}>Yes</button>
         <button onClick={onClose}>No</button>
       </div>
     );
   }
   ```

### Step 3: Integrate Components in the Main Page

1. **Modify the Main Page**:
   Open `src/pages/index.js` and integrate the `NTManager` component:
   ```javascript
   // src/pages/index.js
   import NTManager from '../components/NTManager';

   export default function Home() {
     return (
       <div>
         <h1>NT Management System</h1>
         <NTManager />
       </div>
     );
   }
   ```

### Step 4: Run the Application

1. **Start the Development Server**:
   ```bash
   npm run dev
   ```

2. **Access the Application**:
   Open your browser and navigate to `http://localhost:3000`.

### Additional Features

- **Analytics**: You can create an analytics modal similar to the other modals and fetch relevant data from Supabase.
- **Item Management**: Create components for managing items associated with each NT, similar to how NTs are managed.
- **Styling**: Use ShadCN for styling your components to enhance the UI.

### Conclusion

This guide provides a basic structure for replicating your NT management system using Next.js and Supabase. You can expand upon this foundation by adding more features, improving the UI, and implementing additional functionality as needed.