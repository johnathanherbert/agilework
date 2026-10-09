import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentUserInfo } from './firestore-helpers';
import {
  PesagemTodoItem,
  PesagemTodoNote,
  PesagemTodoStatus,
  PesagemTodoPriority,
} from '@/types/pesagem-todo';
import { AgingData } from '@/types/aging';

export const PESAGEM_TODOS_COLLECTION = 'pesagem_todos';

/**
 * Remove campos undefined para evitar erros no Firestore
 */
function cleanUndefined(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Timestamp) return obj;
  const cleaned: any = Array.isArray(obj) ? [] : {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      cleaned[key] = typeof val === 'object' && val !== null && !(val instanceof Timestamp) ? cleanUndefined(val) : val;
    }
  }
  return cleaned;
}

/**
 * Converte documento Firestore para modelo tipado PesagemTodoItem
 */
const mapDocToPesagemTodo = (docId: string, data: any): PesagemTodoItem => ({
  id: docId,
  material: String(data.material || '').trim(),
  texto_breve_material: data.texto_breve_material || '',
  lote: String(data.lote || '').trim(),
  unidade_medida: data.unidade_medida || 'KG',

  quantidade_inicial: Number(data.quantidade_inicial ?? data.quantidade ?? 0),
  valor_unitario_inicial: Number(data.valor_unitario_inicial ?? data.valor_unitario ?? 0),
  valor_total_inicial: Number(data.valor_total_inicial ?? data.valor_total ?? 0),
  deposito_inicial: data.deposito_inicial || data.deposito || 'PES',
  tipo_deposito_inicial: data.tipo_deposito_inicial || data.tipo_deposito || 'PES',
  posicao_deposito_inicial: data.posicao_deposito_inicial || data.posicao_deposito || '',
  dias_aging_inicial: data.dias_aging_inicial !== undefined ? Number(data.dias_aging_inicial) : undefined,
  data_vencimento: data.data_vencimento || '',

  status: (data.status as PesagemTodoStatus) || 'pendente',
  prioridade: (data.prioridade as PesagemTodoPriority) || 'media',
  motivo_inicial: data.motivo_inicial || '',
  notas: Array.isArray(data.notas) ? data.notas : [],
  tags: Array.isArray(data.tags) ? data.tags : [],

  resolvido_em: data.resolvido_em?.toDate ? data.resolvido_em.toDate().toISOString() : data.resolvido_em,
  resolvido_por: data.resolvido_por,
  resolvido_por_name: data.resolvido_por_name,
  desfecho: data.desfecho || '',

  created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at || new Date().toISOString(),
  updated_at: data.updated_at?.toDate ? data.updated_at.toDate().toISOString() : data.updated_at || new Date().toISOString(),
  created_by: data.created_by,
  created_by_name: data.created_by_name,
  updated_by: data.updated_by,
  updated_by_name: data.updated_by_name,
});

/**
 * Escuta itens de TODO em tempo real no Firestore
 */
export function subscribePesagemTodos(
  onData: (items: PesagemTodoItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    const q = query(
      collection(db, PESAGEM_TODOS_COLLECTION),
      orderBy('created_at', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) =>
          mapDocToPesagemTodo(docSnap.id, docSnap.data())
        );
        onData(items);
      },
      (error) => {
        console.error('Erro na subscription de Pesagem TODOs:', error);
        onError?.(error);
      }
    );
  } catch (error: any) {
    console.warn('Falha ao inicializar listener de Pesagem TODOs:', error);
    return () => {};
  }
}

export type CreatePesagemTodoInput = {
  material: string;
  texto_breve_material?: string;
  lote: string;
  unidade_medida?: string;
  quantidade: number;
  valor_unitario?: number;
  valor_total?: number;
  deposito?: string;
  tipo_deposito?: string;
  posicao_deposito?: string;
  dias_aging?: number;
  data_vencimento?: string;
  motivo_inicial?: string;
  prioridade?: PesagemTodoPriority;
  status?: PesagemTodoStatus;
  tags?: string[];
  nota_inicial?: string;
  desfecho?: string;
};

/**
 * Cria um novo item de TODO no Firestore
 */
export async function createPesagemTodo(input: CreatePesagemTodoInput): Promise<string> {
  const collRef = collection(db, PESAGEM_TODOS_COLLECTION);
  const now = Timestamp.now();
  const userInfo = await getCurrentUserInfo();

  const vu = Number(input.valor_unitario) || 0;
  const qtd = Number(input.quantidade) || 0;
  const vt = Number(input.valor_total) || (qtd * vu);

  const notas: PesagemTodoNote[] = [];
  if (input.nota_inicial && input.nota_inicial.trim()) {
    notas.push({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      texto: input.nota_inicial.trim(),
      created_at: new Date().toISOString(),
      created_by: userInfo?.uid || '',
      created_by_name: userInfo?.name || 'Operador',
    });
  }

  const initialStatus: PesagemTodoStatus = input.status || 'pendente';

  const docData: any = {
    material: String(input.material || '').trim(),
    texto_breve_material: input.texto_breve_material || '',
    lote: String(input.lote || '').trim(),
    unidade_medida: input.unidade_medida || 'KG',

    quantidade_inicial: qtd,
    valor_unitario_inicial: vu,
    valor_total_inicial: vt,
    deposito_inicial: input.deposito || 'PES',
    tipo_deposito_inicial: input.tipo_deposito || 'PES',
    posicao_deposito_inicial: input.posicao_deposito || '',
    dias_aging_inicial: Number(input.dias_aging) || 0,
    data_vencimento: input.data_vencimento || '',

    status: initialStatus,
    prioridade: input.prioridade || 'media',
    motivo_inicial: input.motivo_inicial || 'Investigação e acompanhamento de lote',
    notas,
    tags: input.tags || [],

    created_at: now,
    updated_at: now,
  };

  if (userInfo) {
    docData.created_by = userInfo.uid;
    docData.created_by_name = userInfo.name;
    docData.updated_by = userInfo.uid;
    docData.updated_by_name = userInfo.name;
  }

  if (initialStatus === 'concluido') {
    docData.resolvido_em = now;
    docData.resolvido_por = userInfo?.uid || '';
    docData.resolvido_por_name = userInfo?.name || 'Operador';
    if (input.desfecho !== undefined) {
      docData.desfecho = input.desfecho.trim();
    }
  }

  const cleaned = cleanUndefined(docData);
  const docRef = await addDoc(collRef, cleaned);
  return docRef.id;
}

/**
 * Cria múltiplos itens de TODO em lote (batch)
 */
export async function createBatchPesagemTodos(
  items: CreatePesagemTodoInput[]
): Promise<number> {
  if (items.length === 0) return 0;
  const collRef = collection(db, PESAGEM_TODOS_COLLECTION);
  const now = Timestamp.now();
  const userInfo = await getCurrentUserInfo();

  const batch = writeBatch(db);
  let count = 0;

  for (const input of items) {
    const newDocRef = doc(collRef);
    const vu = Number(input.valor_unitario) || 0;
    const qtd = Number(input.quantidade) || 0;
    const vt = Number(input.valor_total) || (qtd * vu);

    const notas: PesagemTodoNote[] = [];
    if (input.nota_inicial && input.nota_inicial.trim()) {
      notas.push({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        texto: input.nota_inicial.trim(),
        created_at: new Date().toISOString(),
        created_by: userInfo?.uid || '',
        created_by_name: userInfo?.name || 'Operador',
      });
    }

    const docData: any = {
      material: String(input.material || '').trim(),
      texto_breve_material: input.texto_breve_material || '',
      lote: String(input.lote || '').trim(),
      unidade_medida: input.unidade_medida || 'KG',

      quantidade_inicial: qtd,
      valor_unitario_inicial: vu,
      valor_total_inicial: vt,
      deposito_inicial: input.deposito || 'PES',
      tipo_deposito_inicial: input.tipo_deposito || 'PES',
      posicao_deposito_inicial: input.posicao_deposito || '',
      dias_aging_inicial: Number(input.dias_aging) || 0,
      data_vencimento: input.data_vencimento || '',

      status: input.status || 'pendente',
      prioridade: input.prioridade || 'media',
      motivo_inicial: input.motivo_inicial || 'Marcado em lote na tabela de pesagem',
      notas,
      tags: input.tags || [],

      created_at: now,
      updated_at: now,
    };

    if (userInfo) {
      docData.created_by = userInfo.uid;
      docData.created_by_name = userInfo.name;
      docData.updated_by = userInfo.uid;
      docData.updated_by_name = userInfo.name;
    }

    const cleaned = cleanUndefined(docData);
    batch.set(newDocRef, cleaned);
    count++;
  }

  await batch.commit();
  return count;
}

/**
 * Atualiza o status de um item de TODO (incluindo desfecho se concluído)
 */
export async function updatePesagemTodoStatus(
  id: string,
  status: PesagemTodoStatus,
  desfecho?: string
): Promise<void> {
  const docRef = doc(db, PESAGEM_TODOS_COLLECTION, id);
  const userInfo = await getCurrentUserInfo();
  const now = Timestamp.now();

  const updateData: any = {
    status,
    updated_at: now,
  };

  if (userInfo) {
    updateData.updated_by = userInfo.uid;
    updateData.updated_by_name = userInfo.name;
  }

  if (status === 'concluido') {
    updateData.resolvido_em = now;
    updateData.resolvido_por = userInfo?.uid || '';
    updateData.resolvido_por_name = userInfo?.name || 'Operador';
    if (desfecho !== undefined) {
      updateData.desfecho = desfecho.trim();
    }
  } else {
    updateData.resolvido_em = null;
    updateData.resolvido_por = null;
    updateData.resolvido_por_name = null;
  }

  const cleaned = cleanUndefined(updateData);
  await setDoc(docRef, cleaned, { merge: true });
}

/**
 * Adiciona uma nota/racional de investigação a um item de TODO
 */
export async function addPesagemTodoNote(
  id: string,
  currentNotas: PesagemTodoNote[],
  texto: string
): Promise<void> {
  if (!texto.trim()) return;
  const docRef = doc(db, PESAGEM_TODOS_COLLECTION, id);
  const userInfo = await getCurrentUserInfo();

  const novaNota: PesagemTodoNote = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    texto: texto.trim(),
    created_at: new Date().toISOString(),
    created_by: userInfo?.uid || '',
    created_by_name: userInfo?.name || 'Operador',
  };

  const updatedNotas = [...(currentNotas || []), novaNota];

  const updateData: any = {
    notas: updatedNotas,
    updated_at: Timestamp.now(),
  };

  if (userInfo) {
    updateData.updated_by = userInfo.uid;
    updateData.updated_by_name = userInfo.name;
  }

  const cleaned = cleanUndefined(updateData);
  await setDoc(docRef, cleaned, { merge: true });
}

/**
 * Remove uma nota de investigação
 */
export async function deletePesagemTodoNote(
  id: string,
  currentNotas: PesagemTodoNote[],
  noteId: string
): Promise<void> {
  const docRef = doc(db, PESAGEM_TODOS_COLLECTION, id);
  const userInfo = await getCurrentUserInfo();

  const updatedNotas = (currentNotas || []).filter((n) => n.id !== noteId);

  const updateData: any = {
    notas: updatedNotas,
    updated_at: Timestamp.now(),
  };

  if (userInfo) {
    updateData.updated_by = userInfo.uid;
    updateData.updated_by_name = userInfo.name;
  }

  const cleaned = cleanUndefined(updateData);
  await setDoc(docRef, cleaned, { merge: true });
}

/**
 * Atualiza campos customizados de um TODO (prioridade, motivo, tags, etc.)
 */
export async function updatePesagemTodo(
  id: string,
  partialData: Partial<PesagemTodoItem>
): Promise<void> {
  const docRef = doc(db, PESAGEM_TODOS_COLLECTION, id);
  const userInfo = await getCurrentUserInfo();

  const dataToUpdate: any = {
    ...partialData,
    updated_at: Timestamp.now(),
  };

  if (userInfo) {
    dataToUpdate.updated_by = userInfo.uid;
    dataToUpdate.updated_by_name = userInfo.name;
  }

  // Remove campos calculados / auxiliares que não devem ser salvos diretamente como id ou enriched
  delete dataToUpdate.id;
  delete dataToUpdate.key;
  delete dataToUpdate.score;
  delete dataToUpdate.reasons;
  delete dataToUpdate.diasAberto;
  delete dataToUpdate.diasSemAtividade;
  delete dataToUpdate.ultimaAtividade;
  delete dataToUpdate.valorRef;
  delete dataToUpdate.diff_status;
  delete dataToUpdate.diff_quantidade;
  delete dataToUpdate.diff_valor;
  delete dataToUpdate.estoque_atual;
  delete dataToUpdate.localizado_no_estoque;
  delete dataToUpdate.valor_total_atual;
  delete dataToUpdate.posicao_atual;
  delete dataToUpdate.deposito_atual;
  delete dataToUpdate.tipo_deposito_atual;
  delete dataToUpdate.dias_aging_atual;

  const cleaned = cleanUndefined(dataToUpdate);
  await setDoc(docRef, cleaned, { merge: true });
}

/**
 * Exclui permanentemente um registro de TODO
 */
export async function deletePesagemTodo(id: string): Promise<void> {
  const docRef = doc(db, PESAGEM_TODOS_COLLECTION, id);
  await deleteDoc(docRef);
}
