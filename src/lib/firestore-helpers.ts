import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  query, 
  where, 
  orderBy,
  onSnapshot,
  Timestamp,
  QueryConstraint
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { NT, NTItem, ProductionTurno, UserRole } from '@/types';

// Collections
export const COLLECTIONS = {
  NTS: 'nts',
  NT_ITEMS: 'nt_items',
  USERS: 'users',
  NOTIFICATIONS: 'notifications',
  SYSTEM_SETTINGS: 'system_settings',
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

// User Operations (Admin Only)
export const getAllUsers = async () => {
  try {
    const usersRef = collection(db, COLLECTIONS.USERS);
    // Ordenar pelo nome, fallback para data de criação (necessário índice)
    const q = query(usersRef, orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('❌ getAllUsers: Erro ao buscar usuários:', error);
    
    // Se falhar o order (falta de índice), tenta sem order
    try {
      const usersRef = collection(db, COLLECTIONS.USERS);
      const snapshot = await getDocs(usersRef);
      return snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      }));
    } catch (fallbackError) {
      console.error('❌ getAllUsers (fallback): Erro ao buscar usuários:', fallbackError);
      throw fallbackError;
    }
  }
};

export const updateUserStatus = async (uid: string, isApproved: boolean): Promise<void> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(userRef, {
      isApproved,
      updated_at: new Date().toISOString()
    });
    console.log(`✅ updateUserStatus: Status atualizado para ${isApproved} (UID: ${uid})`);
  } catch (error) {
    console.error('❌ updateUserStatus: Erro ao atualizar status:', error);
    throw error;
  }
};

export const deleteUserDb = async (uid: string): Promise<void> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    await deleteDoc(userRef);
    console.log(`✅ deleteUserDb: Conta deletada (UID: ${uid})`);
  } catch (error) {
    console.error('❌ deleteUserDb: Erro ao deletar conta:', error);
    throw error;
  }
};

export const editUserDb = async (uid: string, data: Partial<{ name: string; email: string; isApproved: boolean; role: UserRole; turno: ProductionTurno | null; allowedMaoDeObra: boolean; allowedSolicitacoes: boolean; pinMaoDeObra?: string | null }>): Promise<void> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(userRef, {
      ...data,
      updated_at: new Date().toISOString()
    });
    console.log(`✅ editUserDb: Usuário atualizado (UID: ${uid})`);
  } catch (error) {
    console.error('❌ editUserDb: Erro ao editar conta:', error);
    throw error;
  }
};

export const setUserMaoDeObraPin = async (uid: string, pin: string): Promise<void> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(userRef, {
      pinMaoDeObra: pin,
      pinMaoDeObraUpdatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    console.log(`✅ setUserMaoDeObraPin: PIN configurado com sucesso (UID: ${uid})`);
  } catch (error) {
    console.error('❌ setUserMaoDeObraPin: Erro ao definir PIN:', error);
    throw error;
  }
};

export const resetUserMaoDeObraPin = async (uid: string): Promise<void> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(userRef, {
      pinMaoDeObra: null,
      pinMaoDeObraUpdatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    console.log(`✅ resetUserMaoDeObraPin: PIN resetado com sucesso (UID: ${uid})`);
  } catch (error) {
    console.error('❌ resetUserMaoDeObraPin: Erro ao resetar PIN:', error);
    throw error;
  }
};

export const wipeDataByCategory = async (categories: { nts: boolean; items: boolean; users: boolean }): Promise<{ nts: number; items: number; users: number }> => {
  try {
    console.log('⚠️ INICIANDO WIPE CUSTOMIZADO DE BANCO DE DADOS...', categories);
    let deletedNts = 0;
    let deletedItems = 0;
    let deletedUsers = 0;

    // Delete items
    if (categories.items) {
      const itemsRef = collection(db, COLLECTIONS.NT_ITEMS);
      const itemsSnapshot = await getDocs(itemsRef);
      const itemDeletePromises = itemsSnapshot.docs.map(docSnap => {
        deletedItems++;
        return deleteDoc(doc(db, COLLECTIONS.NT_ITEMS, docSnap.id));
      });
      await Promise.all(itemDeletePromises);
    }

    // Delete NTs
    if (categories.nts) {
      const ntsRef = collection(db, COLLECTIONS.NTS);
      const ntsSnapshot = await getDocs(ntsRef);
      const ntDeletePromises = ntsSnapshot.docs.map(docSnap => {
        deletedNts++;
        return deleteDoc(doc(db, COLLECTIONS.NTS, docSnap.id));
      });
      await Promise.all(ntDeletePromises);
    }

    // Delete Users (Protect Admins ideally, but this is DB level execution)
    if (categories.users) {
      const usersRef = collection(db, COLLECTIONS.USERS);
      const usersSnapshot = await getDocs(usersRef);
      const userDeletePromises = usersSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        if (data.email !== 'johnathan.herbert47@gmail.com') { // Hardcoded protection
          deletedUsers++;
          return deleteDoc(doc(db, COLLECTIONS.USERS, docSnap.id));
        }
        return Promise.resolve();
      });
      await Promise.all(userDeletePromises);
    }

    console.log(`✅ WIPE CONCLUÍDO: ${deletedNts} NTs, ${deletedItems} itens e ${deletedUsers} usuários removidos.`);
    return { nts: deletedNts, items: deletedItems, users: deletedUsers };
  } catch (error) {
    console.error('❌ ERRO NO WIPE CUSTOMIZADO:', error);
    throw error;
  }
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

// ==========================================
// NT Automatic Cleanup Operations
// ==========================================

export interface NTCleanupConfig {
  enabled: boolean;
  retentionDays: number;
  lastRun?: string | null;
  lastCleanedNTs?: number;
  lastCleanedItems?: number;
}

export const getNTCleanupConfig = async (): Promise<NTCleanupConfig> => {
  const defaultConfig: NTCleanupConfig = {
    enabled: false,
    retentionDays: 30,
    lastRun: null,
    lastCleanedNTs: 0,
    lastCleanedItems: 0,
  };

  try {
    const configDoc = await getDoc(doc(db, COLLECTIONS.SYSTEM_SETTINGS, 'nt_cleanup'));
    if (configDoc.exists()) {
      return { ...defaultConfig, ...configDoc.data() } as NTCleanupConfig;
    }
  } catch (error) {
    console.warn('⚠️ Erro ao carregar config de limpeza do Firestore, usando fallback local:', error);
  }

  // Fallback para localStorage
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem('nt_cleanup_config');
      if (local) {
        return { ...defaultConfig, ...JSON.parse(local) };
      }
    } catch {}
  }

  return defaultConfig;
};

export const saveNTCleanupConfig = async (config: Partial<NTCleanupConfig>): Promise<void> => {
  try {
    const settingRef = doc(db, COLLECTIONS.SYSTEM_SETTINGS, 'nt_cleanup');
    const existing = await getDoc(settingRef);
    if (existing.exists()) {
      await updateDoc(settingRef, {
        ...config,
        updated_at: new Date().toISOString(),
      });
    } else {
      await setDoc(settingRef, {
        enabled: false,
        retentionDays: 30,
        ...config,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.warn('⚠️ Erro ao salvar config de limpeza no Firestore:', error);
  }

  // Persistir no localStorage
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem('nt_cleanup_config');
      const current = local ? JSON.parse(local) : {};
      localStorage.setItem('nt_cleanup_config', JSON.stringify({ ...current, ...config }));
    } catch {}
  }
};

export function extractNTDate(ntData: any, items: any[]): Date | null {
  // 1. created_at na NT
  if (ntData.created_at) {
    if (typeof ntData.created_at.toDate === 'function') {
      const d = ntData.created_at.toDate();
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(ntData.created_at);
    if (!isNaN(d.getTime())) return d;
  }

  // 2. created_date na NT (ex: "DD/MM/YYYY", "YYYY-MM-DD", "DD-MM-YYYY")
  if (typeof ntData.created_date === 'string' && ntData.created_date.trim()) {
    const clean = ntData.created_date.trim();
    if (clean.includes('/')) {
      const parts = clean.split('/').map(Number);
      if (parts.length === 3) {
        const d = new Date(parts[2], parts[1] - 1, parts[0]);
        if (!isNaN(d.getTime())) return d;
      }
    } else if (clean.includes('-')) {
      const parts = clean.split('-').map(Number);
      if (parts.length === 3) {
        if (parts[0] > 1000) {
          const d = new Date(parts[0], parts[1] - 1, parts[2]);
          if (!isNaN(d.getTime())) return d;
        } else {
          const d = new Date(parts[2], parts[1] - 1, parts[0]);
          if (!isNaN(d.getTime())) return d;
        }
      }
    }
  }

  // 3. updated_at na NT
  if (ntData.updated_at) {
    if (typeof ntData.updated_at.toDate === 'function') {
      const d = ntData.updated_at.toDate();
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(ntData.updated_at);
    if (!isNaN(d.getTime())) return d;
  }

  // 4. Fallback: procurar nas datas dos itens
  if (items && items.length > 0) {
    for (const item of items) {
      if (item.created_at) {
        if (typeof item.created_at.toDate === 'function') {
          const d = item.created_at.toDate();
          if (!isNaN(d.getTime())) return d;
        }
        const d = new Date(item.created_at);
        if (!isNaN(d.getTime())) return d;
      }
      if (typeof item.created_date === 'string' && item.created_date.trim()) {
        const clean = item.created_date.trim();
        if (clean.includes('/')) {
          const parts = clean.split('/').map(Number);
          if (parts.length === 3) {
            const d = new Date(parts[2], parts[1] - 1, parts[0]);
            if (!isNaN(d.getTime())) return d;
          }
        }
      }
    }
  }

  return null;
}

export const cleanOldCompletedNTs = async (
  retentionDays: number = 30
): Promise<{ success: boolean; deletedNTs: number; deletedItems: number; totalAnalyzedNTs: number }> => {
  try {
    console.log(`🧹 [FAST CLEANUP] Iniciando limpeza de NTs concluídas com mais de ${retentionDays} dias...`);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    cutoffDate.setHours(23, 59, 59, 999);

    // 1. Busca em paralelo NTS e NT_ITEMS (apenas 2 requisições no total)
    const [ntsSnapshot, itemsSnapshot] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.NTS)),
      getDocs(collection(db, COLLECTIONS.NT_ITEMS))
    ]);

    const totalAnalyzedNTs = ntsSnapshot.docs.length;
    console.log(`📊 Encontradas ${totalAnalyzedNTs} NTs e ${itemsSnapshot.docs.length} itens no Firestore.`);

    // 2. Mapeia itens por nt_id em memória
    const itemsByNtId = new Map<string, { docId: string; data: any }[]>();
    itemsSnapshot.docs.forEach((itemDoc) => {
      const data = itemDoc.data();
      const ntId = data.nt_id;
      if (ntId) {
        const list = itemsByNtId.get(ntId) || [];
        list.push({ docId: itemDoc.id, data });
        itemsByNtId.set(ntId, list);
      }
    });

    const docsToDelete: { collection: string; id: string }[] = [];
    let deletedNTsCount = 0;
    let deletedItemsCount = 0;

    // 3. Avalia cada NT
    for (const ntDoc of ntsSnapshot.docs) {
      const ntData = ntDoc.data();
      const ntId = ntDoc.id;
      const ntItems = itemsByNtId.get(ntId) || [];

      // Verifica status de conclusão:
      // - Possui itens e todos com status 'Pago' (ou payment_time preenchido)
      // - Ou NT marcada com status 'completed' / 'concluida' / 'Concluído' / 'pago'
      const hasItems = ntItems.length > 0;
      const allItemsPaid = hasItems && ntItems.every((item) => {
        const st = (item.data.status || '').toLowerCase().trim();
        return st === 'pago' || Boolean(item.data.payment_time);
      });
      
      const ntStatus = (ntData.status || '').toLowerCase().trim();
      const isCompleted = allItemsPaid || ntStatus === 'completed' || ntStatus === 'concluida' || ntStatus === 'concluído' || ntStatus === 'pago';

      // Se tiver itens e não estiver concluída (tem itens pendentes), preserva a NT
      if (!isCompleted && hasItems) {
        continue;
      }

      // Se for uma NT concluída ou vazia, verifica a data
      const ntDate = extractNTDate(ntData, ntItems.map(i => i.data));

      // Se temos data e a data é mais antiga que o período de retenção (ex: > 30 dias)
      if (ntDate && ntDate < cutoffDate) {
        // Marca NT para exclusão
        docsToDelete.push({ collection: COLLECTIONS.NTS, id: ntId });
        deletedNTsCount++;

        // Marca todos os itens da NT para exclusão
        ntItems.forEach((item) => {
          docsToDelete.push({ collection: COLLECTIONS.NT_ITEMS, id: item.docId });
          deletedItemsCount++;
        });
      }
    }

    console.log(`🗑️ Total a deletar: ${deletedNTsCount} NTs e ${deletedItemsCount} itens.`);

    // 4. Executa deleções em lotes (writeBatch) de até 450 operações por requisição
    if (docsToDelete.length > 0) {
      const BATCH_SIZE = 450;
      let currentBatch = writeBatch(db);
      let opCount = 0;

      for (const item of docsToDelete) {
        const ref = doc(db, item.collection, item.id);
        currentBatch.delete(ref);
        opCount++;

        if (opCount >= BATCH_SIZE) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          opCount = 0;
        }
      }

      if (opCount > 0) {
        await currentBatch.commit();
      }
    }

    const nowIso = new Date().toISOString();
    await saveNTCleanupConfig({
      lastRun: nowIso,
      lastCleanedNTs: deletedNTsCount,
      lastCleanedItems: deletedItemsCount,
    });

    console.log(`✅ [FAST CLEANUP] Concluído: ${deletedNTsCount} NTs e ${deletedItemsCount} itens removidos.`);
    return { 
      success: true, 
      deletedNTs: deletedNTsCount, 
      deletedItems: deletedItemsCount,
      totalAnalyzedNTs
    };
  } catch (error) {
    console.error('❌ Erro no fast cleanup de NTs:', error);
    throw error;
  }
};
