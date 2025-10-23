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
import { auth, db } from './firebase';
import { NT, NTItem } from '@/types';

// Collections
export const COLLECTIONS = {
  NTS: 'nts',
  NT_ITEMS: 'nt_items',
  USERS: 'users',
  NOTIFICATIONS: 'notifications',
};

// Helper to get current user info
export const getCurrentUserInfo = async () => {
  const user = auth.currentUser;
  if (!user) {
    console.warn('⚠️ getCurrentUserInfo: Nenhum usuário autenticado');
    return null;
  }
  
  console.log('🔍 getCurrentUserInfo: Buscando dados do usuário', user.uid);
  
  try {
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const userName = userData.name || user.displayName || user.email?.split('@')[0] || 'Usuário';
      console.log('✅ getCurrentUserInfo: Dados encontrados no Firestore -', userName);
      return {
        uid: user.uid,
        name: userName
      };
    } else {
      console.warn('⚠️ getCurrentUserInfo: Documento do usuário não existe no Firestore');
    }
  } catch (error) {
    console.error('❌ getCurrentUserInfo: Erro ao buscar dados do Firestore:', error);
  }
  
  // Fallback: usar dados do Firebase Auth
  const fallbackName = user.displayName || user.email?.split('@')[0] || 'Usuário';
  console.log('ℹ️ getCurrentUserInfo: Usando fallback do Auth -', fallbackName);
  
  return {
    uid: user.uid,
    name: fallbackName
  };
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
  const userInfo = await getCurrentUserInfo();
  
  const ntData: any = {
    nt_number: ntNumber,
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  };
  
  if (userInfo) {
    ntData.created_by = userInfo.uid;
    ntData.created_by_name = userInfo.name;
    ntData.updated_by = userInfo.uid;
    ntData.updated_by_name = userInfo.name;
  }
  
  const docRef = await addDoc(ntsRef, ntData);
  console.log(`✅ NT criada por ${userInfo?.name || 'Usuário'} (${userInfo?.uid})`);
  return docRef.id;
};

export const updateNT = async (ntId: string, ntNumber: string): Promise<void> => {
  const ntRef = doc(db, COLLECTIONS.NTS, ntId);
  const userInfo = await getCurrentUserInfo();
  
  const updateData: any = {
    nt_number: ntNumber,
    updated_at: Timestamp.now(),
  };
  
  if (userInfo) {
    updateData.updated_by = userInfo.uid;
    updateData.updated_by_name = userInfo.name;
  }
  
  await updateDoc(ntRef, updateData);
  console.log(`✅ NT atualizada por ${userInfo?.name || 'Usuário'} (${userInfo?.uid})`);
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
  const userInfo = await getCurrentUserInfo();
  
  const newItemData: any = {
    ...itemData,
    nt_id: ntId,
    created_at: now,
    updated_at: now,
  };
  
  if (userInfo) {
    newItemData.created_by = userInfo.uid;
    newItemData.created_by_name = userInfo.name;
    newItemData.updated_by = userInfo.uid;
    newItemData.updated_by_name = userInfo.name;
  }
  
  const docRef = await addDoc(itemsRef, newItemData);
  console.log(`✅ Item criado por ${userInfo?.name || 'Usuário'} (${userInfo?.uid})`);
  return docRef.id;
};

export const updateNTItem = async (itemId: string, itemData: Partial<NTItem>): Promise<void> => {
  const itemRef = doc(db, COLLECTIONS.NT_ITEMS, itemId);
  const now = Timestamp.now();
  const userInfo = await getCurrentUserInfo();
  
  const updateData: any = {
    ...itemData,
    updated_at: now,
  };
  
  if (userInfo) {
    updateData.updated_by = userInfo.uid;
    updateData.updated_by_name = userInfo.name;
  }
  
  await updateDoc(itemRef, updateData);
  console.log(`✅ Item atualizado por ${userInfo?.name || 'Usuário'} (${userInfo?.uid})`);
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
  const ntsQuery = query(ntsRef, orderBy('created_at', 'desc'));
  
  const itemsRef = collection(db, COLLECTIONS.NT_ITEMS);
  
  let ntsCache: Map<string, any> = new Map();
  let itemsCache: Map<string, NTItem[]> = new Map();
  
  // Função para compilar e enviar dados atualizados
  const compileAndSend = () => {
    const nts: NT[] = [];
    ntsCache.forEach((ntData, ntId) => {
      const items = itemsCache.get(ntId) || [];
      nts.push({
        id: ntId,
        nt_number: ntData.nt_number,
        created_date: timestampToDateString(ntData.created_at),
        created_time: timestampToTimeString(ntData.created_at),
        status: ntData.status || 'pending',
        created_at: ntData.created_at.toDate().toISOString(),
        updated_at: ntData.updated_at?.toDate().toISOString() || ntData.created_at.toDate().toISOString(),
        items,
      });
    });
    
    // Ordenar por created_at (mais recente primeiro)
    nts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    callback(nts);
  };
  
  // Listener para NTs
  const unsubscribeNTs = onSnapshot(
    ntsQuery,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const ntId = change.doc.id;
        const data = change.doc.data();
        
        if (change.type === 'added' || change.type === 'modified') {
          ntsCache.set(ntId, data);
        } else if (change.type === 'removed') {
          ntsCache.delete(ntId);
          itemsCache.delete(ntId);
        }
      });
      
      compileAndSend();
    },
    (error) => {
      console.error('Error in NT subscription:', error);
      errorCallback?.(error);
    }
  );
  
  // Listener para TODOS os items (mais eficiente que um listener por NT)
  const unsubscribeItems = onSnapshot(
    itemsRef,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const itemData = change.doc.data();
        const ntId = itemData.nt_id as string;
        const itemId = change.doc.id;
        
        if (!itemsCache.has(ntId)) {
          itemsCache.set(ntId, []);
        }
        
        const items = itemsCache.get(ntId)!;
        
        if (change.type === 'added') {
          items.push({ ...itemData, id: itemId } as NTItem);
        } else if (change.type === 'modified') {
          const index = items.findIndex(item => item.id === itemId);
          if (index !== -1) {
            items[index] = { ...itemData, id: itemId } as NTItem;
          }
        } else if (change.type === 'removed') {
          const index = items.findIndex(item => item.id === itemId);
          if (index !== -1) {
            items.splice(index, 1);
          }
        }
      });
      
      compileAndSend();
    },
    (error) => {
      console.error('Error in items subscription:', error);
      errorCallback?.(error);
    }
  );
  
  // Retornar função para cancelar ambos os listeners
  return () => {
    unsubscribeNTs();
    unsubscribeItems();
  };
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
