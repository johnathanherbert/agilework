import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  Timestamp,
  QueryConstraint
} from 'firebase/firestore';
import { db } from './firebase';
import { NT, NTItem } from '@/types';

// Collections
export const COLLECTIONS = {
  NTS: 'nts',
  NT_ITEMS: 'nt_items',
  USERS: 'users',
  NOTIFICATIONS: 'notifications',
};

// Helper to convert Firestore timestamp to date string
export const timestampToDateString = (timestamp: Timestamp): string => {
  const date = timestamp.toDate();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Helper to convert Firestore timestamp to time string
export const timestampToTimeString = (timestamp: Timestamp): string => {
  const date = timestamp.toDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

// NT Operations
export const getNTs = async (): Promise<NT[]> => {
  const ntsRef = collection(db, COLLECTIONS.NTS);
  const q = query(ntsRef, orderBy('created_at', 'desc'));
  const snapshot = await getDocs(q);
  
  const nts: NT[] = [];
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const itemsSnapshot = await getDocs(
      query(collection(db, COLLECTIONS.NT_ITEMS), where('nt_id', '==', docSnap.id))
    );
    
    const items = itemsSnapshot.docs.map(itemDoc => ({
      id: itemDoc.id,
      ...itemDoc.data(),
    })) as NTItem[];
    
    nts.push({
      id: docSnap.id,
      nt_number: data.nt_number,
      created_date: timestampToDateString(data.created_at),
      created_time: timestampToTimeString(data.created_at),
      status: data.status || 'pending',
      created_at: data.created_at.toDate().toISOString(),
      updated_at: data.updated_at?.toDate().toISOString() || data.created_at.toDate().toISOString(),
      items,
    });
  }
  
  return nts;
};

export const createNT = async (ntNumber: string): Promise<string> => {
  const ntsRef = collection(db, COLLECTIONS.NTS);
  const docRef = await addDoc(ntsRef, {
    nt_number: ntNumber,
    created_at: Timestamp.now(),
  });
  return docRef.id;
};

export const updateNT = async (ntId: string, ntNumber: string): Promise<void> => {
  const ntRef = doc(db, COLLECTIONS.NTS, ntId);
  await updateDoc(ntRef, {
    nt_number: ntNumber,
  });
};

export const deleteNT = async (ntId: string): Promise<void> => {
  // Delete all items first
  const itemsSnapshot = await getDocs(
    query(collection(db, COLLECTIONS.NT_ITEMS), where('nt_id', '==', ntId))
  );
  
  const deletePromises = itemsSnapshot.docs.map(itemDoc => 
    deleteDoc(doc(db, COLLECTIONS.NT_ITEMS, itemDoc.id))
  );
  await Promise.all(deletePromises);
  
  // Then delete the NT
  const ntRef = doc(db, COLLECTIONS.NTS, ntId);
  await deleteDoc(ntRef);
};

// NT Item Operations
export const createNTItem = async (
  ntId: string, 
  itemData: {
    item_number: number;
    code: string;
    description: string;
    quantity: string;
    batch: string | null;
    created_date: string;
    created_time: string;
    payment_time: string | null;
    status: 'Ag. Pagamento' | 'Pago' | 'Pago Parcial';
    priority: boolean;
  }
): Promise<string> => {
  const itemsRef = collection(db, COLLECTIONS.NT_ITEMS);
  const now = Timestamp.now();
  const docRef = await addDoc(itemsRef, {
    ...itemData,
    nt_id: ntId,
    created_at: now,
    updated_at: now,
  });
  return docRef.id;
};

export const updateNTItem = async (itemId: string, itemData: Partial<NTItem>): Promise<void> => {
  const itemRef = doc(db, COLLECTIONS.NT_ITEMS, itemId);
  await updateDoc(itemRef, itemData);
};

export const deleteNTItem = async (itemId: string): Promise<void> => {
  const itemRef = doc(db, COLLECTIONS.NT_ITEMS, itemId);
  await deleteDoc(itemRef);
};

// Real-time listeners
export const subscribeToNTs = (
  callback: (nts: NT[]) => void,
  errorCallback?: (error: Error) => void
) => {
  const ntsRef = collection(db, COLLECTIONS.NTS);
  const q = query(ntsRef, orderBy('created_at', 'desc'));
  
  return onSnapshot(
    q,
    async (snapshot) => {
      const nts: NT[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const itemsSnapshot = await getDocs(
          query(collection(db, COLLECTIONS.NT_ITEMS), where('nt_id', '==', docSnap.id))
        );
        
        const items = itemsSnapshot.docs.map(itemDoc => ({
          id: itemDoc.id,
          ...itemDoc.data(),
        })) as NTItem[];
        
        nts.push({
          id: docSnap.id,
          nt_number: data.nt_number,
          created_date: timestampToDateString(data.created_at),
          created_time: timestampToTimeString(data.created_at),
          status: data.status || 'pending',
          created_at: data.created_at.toDate().toISOString(),
          updated_at: data.updated_at?.toDate().toISOString() || data.created_at.toDate().toISOString(),
          items,
        });
      }
      callback(nts);
    },
    (error) => {
      console.error('Error in NT subscription:', error);
      errorCallback?.(error);
    }
  );
};

export const subscribeToNTItems = (
  ntId: string,
  callback: (items: NTItem[]) => void,
  errorCallback?: (error: Error) => void
) => {
  const itemsRef = collection(db, COLLECTIONS.NT_ITEMS);
  const q = query(itemsRef, where('nt_id', '==', ntId));
  
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as NTItem[];
      callback(items);
    },
    (error) => {
      console.error('Error in items subscription:', error);
      errorCallback?.(error);
    }
  );
};
