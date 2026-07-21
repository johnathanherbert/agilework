import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  Timestamp,
  deleteField,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentUserInfo } from './firestore-helpers';
import { ProductionItem, ProductionTipo, ProductionTurno, ProductionVia } from '@/types';

export const PRODUCTION_COLLECTION = 'production_items';

// Converte um snapshot de documento em ProductionItem tipado
const mapDocToProductionItem = (docId: string, data: any): ProductionItem => ({
  id: docId,
  turno: data.turno,
  tipo: data.tipo,
  via: data.via,
  familia: data.familia,
  produto: data.produto,
  prog: data.prog ?? 0,
  real: data.real ?? 0,
  locked: data.locked ?? false,
  splitChildId: data.splitChildId,
  splitParentId: data.splitParentId,
  created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at,
  updated_at: data.updated_at?.toDate ? data.updated_at.toDate().toISOString() : data.updated_at,
  created_by: data.created_by,
  created_by_name: data.created_by_name,
  updated_by: data.updated_by,
  updated_by_name: data.updated_by_name,
});

export type CreateProductionItemInput = {
  turno: ProductionTurno;
  tipo: ProductionTipo;
  via?: ProductionVia;
  familia?: string;
  produto: string;
  prog: number;
  real: number;
  splitParentId?: string;
};

export const createProductionItem = async (input: CreateProductionItemInput): Promise<string> => {
  const itemsRef = collection(db, PRODUCTION_COLLECTION);
  const now = Timestamp.now();
  const userInfo = await getCurrentUserInfo();

  const data: any = {
    turno: input.turno,
    tipo: input.tipo,
    produto: input.produto,
    prog: input.prog,
    real: input.real,
    created_at: now,
    updated_at: now,
  };

  if (input.tipo === 'ordem') {
    data.via = input.via || 'SECA';
    if (input.familia) {
      data.familia = input.familia;
    }
  }

  if (input.splitParentId) {
    data.splitParentId = input.splitParentId;
  }

  if (userInfo) {
    data.created_by = userInfo.uid;
    data.created_by_name = userInfo.name;
    data.updated_by = userInfo.uid;
    data.updated_by_name = userInfo.name;
  }

  const docRef = await addDoc(itemsRef, data);
  console.log(`✅ Item de produção criado por ${userInfo?.name || 'Usuário'} (${userInfo?.uid})`);
  return docRef.id;
};

export type UpdateProductionItemInput = Partial<{
  turno: ProductionTurno;
  via: ProductionVia;
  familia: string;
  produto: string;
  prog: number;
  real: number;
  locked: boolean;
  splitChildId: string;
}>;

export const updateProductionItem = async (itemId: string, input: UpdateProductionItemInput): Promise<void> => {
  const itemRef = doc(db, PRODUCTION_COLLECTION, itemId);
  const now = Timestamp.now();
  const userInfo = await getCurrentUserInfo();

  // Firestore rejeita valores `undefined` em updateDoc (ex.: via/familia em
  // itens de Pesagem Direta/Automática, que não possuem esses campos).
  // Removemos as chaves undefined para permitir editar esses itens de forma
  // independente da ordem normal.
  const sanitizedInput = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  );

  const updateData: any = {
    ...sanitizedInput,
    updated_at: now,
  };

  if (userInfo) {
    updateData.updated_by = userInfo.uid;
    updateData.updated_by_name = userInfo.name;
  }

  await updateDoc(itemRef, updateData);
  console.log(`✅ Item de produção atualizado por ${userInfo?.name || 'Usuário'} (${userInfo?.uid})`);
};

// Move um item entre turnos (e via, quando aplicável) via drag-and-drop
export const moveProductionItem = async (
  itemId: string,
  destination: { turno: ProductionTurno; via?: ProductionVia }
): Promise<void> => {
  await updateProductionItem(itemId, destination);
};

// Divide uma ordem: cria um item "filho" no turno de destino com a quantidade
// informada e trava (locked) o item "pai" para acompanhamento visual, sem
// permitir edição até que o turno de destino arraste o filho de volta.
export const splitProductionItem = async (
  parentItem: ProductionItem,
  destination: { turno: ProductionTurno; qty: number }
): Promise<string> => {
  const childId = await createProductionItem({
    turno: destination.turno,
    tipo: 'ordem',
    via: parentItem.via,
    familia: parentItem.familia,
    produto: parentItem.produto,
    prog: destination.qty,
    real: 0,
    splitParentId: parentItem.id,
  });

  await updateProductionItem(parentItem.id, {
    locked: true,
    splitChildId: childId,
  });

  return childId;
};

// Mescla de volta um item filho dividido ao seu item pai: soma o "real" do
// filho ao pai, destrava o pai e remove o item filho. Chamado quando o turno
// de destino arrasta o item filho de volta para o turno/via de origem.
export const mergeSplitProductionItem = async (parentId: string, childId: string): Promise<void> => {
  const childRef = doc(db, PRODUCTION_COLLECTION, childId);
  const childSnap = await getDoc(childRef);
  const childReal = childSnap.exists() ? (childSnap.data().real ?? 0) : 0;

  const parentRef = doc(db, PRODUCTION_COLLECTION, parentId);
  const now = Timestamp.now();
  const userInfo = await getCurrentUserInfo();

  const parentUpdate: any = {
    locked: false,
    splitChildId: deleteField(),
    real: increment(childReal),
    updated_at: now,
  };
  if (userInfo) {
    parentUpdate.updated_by = userInfo.uid;
    parentUpdate.updated_by_name = userInfo.name;
  }

  await updateDoc(parentRef, parentUpdate);
  await deleteDoc(childRef);
  console.log(`✅ Ordem dividida mesclada de volta (pai: ${parentId}, filho: ${childId})`);
};

export const deleteProductionItem = async (itemId: string): Promise<void> => {
  const itemRef = doc(db, PRODUCTION_COLLECTION, itemId);
  await deleteDoc(itemRef);
  console.log(`✅ Item de produção excluído (ID: ${itemId})`);
};

// Real-time listener - mantém um cache local e reenvia a lista completa a cada mudança
export const subscribeToProductionItems = (
  callback: (items: ProductionItem[]) => void,
  errorCallback?: (error: Error) => void
) => {
  const itemsRef = collection(db, PRODUCTION_COLLECTION);

  const unsubscribe = onSnapshot(
    itemsRef,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => mapDocToProductionItem(docSnap.id, docSnap.data()));
      // Ordena por turno e depois por data de criação para exibição estável
      items.sort((a, b) => {
        if (a.turno !== b.turno) return a.turno - b.turno;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      callback(items);
    },
    (error) => {
      console.error('❌ subscribeToProductionItems: Erro na subscrição em tempo real:', error);
      errorCallback?.(error);
    }
  );

  return unsubscribe;
};
