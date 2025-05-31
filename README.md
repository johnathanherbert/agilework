### Step 1: Set Up the Next.js Project

1. **Create a New Next.js Project**:
   ```bash
   npx create-next-app@latest nt-management-system
   cd nt-management-system
   ```

2. **Install Required Packages**:
   ```bash
   npm install @supabase/supabase-js @heroicons/react shadcn-ui
   ```

3. **Set Up Supabase**:
   - Create a Supabase account and set up your database.
   - Create the necessary tables (`nts`, `nt_items`) in Supabase.
   - Get your Supabase URL and API key from the Supabase dashboard.

4. **Create a Supabase Client**:
   Create a file named `supabaseClient.js` in the `src` directory:
   ```javascript
   // src/supabaseClient.js
   import { createClient } from '@supabase/supabase-js';

   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
   const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

   export const supabase = createClient(supabaseUrl, supabaseAnonKey);
   ```

5. **Set Up Environment Variables**:
   Create a `.env.local` file in the root of your project:
   ```plaintext
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### Step 2: Create Components

1. **Create a Directory for Components**:
   ```bash
   mkdir src/components
   ```

2. **Create the Main NT Manager Component**:
   Create a file named `NTManager.jsx`:
   ```javascript
   // src/components/NTManager.jsx
   import { useEffect, useState } from 'react';
   import { supabase } from '../supabaseClient';
   import NTsList from './NTsList';
   import AddNTModal from './AddNTModal';
   import EditNTModal from './EditNTModal';
   import DeleteConfirmationModal from './DeleteConfirmationModal';

   export default function NTManager() {
     const [nts, setNTs] = useState([]);
     const [isLoading, setIsLoading] = useState(true);
     const [showAddNTModal, setShowAddNTModal] = useState(false);
     const [currentNT, setCurrentNT] = useState(null);
     const [showEditNTModal, setShowEditNTModal] = useState(false);
     const [showDeleteModal, setShowDeleteModal] = useState(false);

     useEffect(() => {
       fetchNTs();
     }, []);

     const fetchNTs = async () => {
       setIsLoading(true);
       const { data, error } = await supabase.from('nts').select('*');
       if (error) console.error(error);
       else setNTs(data);
       setIsLoading(false);
     };

     const handleNTAdded = () => {
       fetchNTs();
       setShowAddNTModal(false);
     };

     const handleEditNT = (nt) => {
       setCurrentNT(nt);
       setShowEditNTModal(true);
     };

     const handleDeleteNT = async (ntId) => {
       await supabase.from('nts').delete().eq('id', ntId);
       fetchNTs();
       setShowDeleteModal(false);
     };

     return (
       <div>
         <button onClick={() => setShowAddNTModal(true)}>Add NT</button>
         <NTsList nts={nts} onEditNT={handleEditNT} onDeleteNT={handleDeleteNT} isLoading={isLoading} />
         <AddNTModal isOpen={showAddNTModal} onClose={() => setShowAddNTModal(false)} onNTAdded={handleNTAdded} />
         <EditNTModal isOpen={showEditNTModal} onClose={() => setShowEditNTModal(false)} nt={currentNT} />
         <DeleteConfirmationModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={() => handleDeleteNT(currentNT.id)} />
       </div>
     );
   }
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