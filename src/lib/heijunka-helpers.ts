import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
  writeBatch,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { getCurrentUserInfo } from './firestore-helpers';
import { ProductionItem, HeijunkaSnapshot, HeijunkaTurnoStats } from '@/types';
import { clearProductionItems } from './production-helpers';

export const HEIJUNKA_COLLECTION = 'heijunka_snapshots';
const HEIJUNKA_ADMIN_EMAIL = 'johnathan.herbert47@gmail.com';

const ensureHeijunkaAdmin = (actionLabel: string) => {
  const email = auth.currentUser?.email?.toLowerCase() || '';
  if (email !== HEIJUNKA_ADMIN_EMAIL.toLowerCase()) {
    throw new Error(`Apenas o administrador pode ${actionLabel}.`);
  }
};

// O 3º turno vai das 22h às 6h, cruzando a virada do dia.
// Quando o Heijunka é fechado de madrugada (antes das 6h), ele ainda faz
// parte do turno que começou no dia anterior, então a data de referência
// deve retroceder um dia.
const getHeijunkaReferenceDate = (): string => {
  const now = new Date();
  if (now.getHours() < 6) {
    now.setDate(now.getDate() - 1);
  }
  return now.toISOString().split('T')[0];
};

export const saveHeijunkaSnapshot = async (metaDiaria: number, items: ProductionItem[]): Promise<string> => {
  const userInfo = await getCurrentUserInfo();
  const now = Timestamp.now();
  
  // Format date as YYYY-MM-DD for easier grouping
  const date = getHeijunkaReferenceDate();

  const ordens = items.filter(i => i.tipo === 'ordem');
  const pa = items.filter(i => i.tipo === 'auto');
  const pd = items.filter(i => i.tipo === 'direta');
  const umida = ordens.filter(i => i.via === 'UMIDA');
  const seca = ordens.filter(i => i.via === 'SECA');

  // Volumes totais das pesagens automáticas e diretas
  const volPA = pa.reduce((acc, curr) => acc + curr.real, 0);
  const volPD = pd.reduce((acc, curr) => acc + curr.real, 0);
  const volPDPA = volPA + volPD;

  // Volume total realizado das ordens principais
  const totalRealizadoOrdens = ordens.reduce((acc, curr) => acc + curr.real, 0);
  const totalRealizado = Math.max(totalRealizadoOrdens, volPDPA);
  const volManual = Math.max(0, totalRealizado - volPDPA);

  const turnosStats: Record<string, HeijunkaTurnoStats> = {
    '1': { ordens: 0, umida: 0, seca: 0, pa: 0, pd: 0, realizado: 0, programado: 0, volPA: 0, volPD: 0, volManual: 0 },
    '2': { ordens: 0, umida: 0, seca: 0, pa: 0, pd: 0, realizado: 0, programado: 0, volPA: 0, volPD: 0, volManual: 0 },
    '3': { ordens: 0, umida: 0, seca: 0, pa: 0, pd: 0, realizado: 0, programado: 0, volPA: 0, volPD: 0, volManual: 0 }
  };

  const familiasStats: Record<string, number> = {};

  items.forEach(item => {
    const t = item.turno.toString();
    if (!turnosStats[t]) return;

    if (item.tipo === 'ordem') {
      turnosStats[t].ordens += 1;
      if (item.via === 'UMIDA') turnosStats[t].umida += 1;
      if (item.via === 'SECA') turnosStats[t].seca += 1;
      
      if (item.familia) {
        familiasStats[item.familia] = (familiasStats[item.familia] || 0) + item.real;
      }
    } else if (item.tipo === 'auto') {
      turnosStats[t].pa += 1;
      turnosStats[t].volPA = (turnosStats[t].volPA || 0) + item.real;
    } else if (item.tipo === 'direta') {
      turnosStats[t].pd += 1;
      turnosStats[t].volPD = (turnosStats[t].volPD || 0) + item.real;
    }

    turnosStats[t].realizado += item.real;
    turnosStats[t].programado += item.prog;
  });

  // Calcula volManual por turno sem duplicação
  Object.keys(turnosStats).forEach(t => {
    const realizadoTurno = turnosStats[t].realizado;
    const pdpaTurno = (turnosStats[t].volPA || 0) + (turnosStats[t].volPD || 0);
    turnosStats[t].volManual = Math.max(0, realizadoTurno - pdpaTurno);
  });

  const data = {
    date,
    metaDiaria,
    totalOrdens: ordens.length,
    totalManual: ordens.length,
    totalUmida: umida.length,
    totalSeca: seca.length,
    totalPA: pa.length,
    totalPD: pd.length,
    volManual,
    volOrdensComRef: 0,
    volPA,
    volPD,
    totalRealizado,
    totalProgramado: ordens.reduce((acc, curr) => acc + curr.prog, 0) || metaDiaria,
    turnos: turnosStats,
    familias: familiasStats,
    created_at: now,
    created_by: userInfo?.uid || null,
    created_by_name: userInfo?.name || null,
  };

  const docRef = await addDoc(collection(db, HEIJUNKA_COLLECTION), data);
  console.log(`✅ Snapshot de Heijunka salvo: ${date}`);
  
  // Limpar os quadros de produção depois de salvar
  await clearProductionItems();

  return docRef.id;
};

export const updateHeijunkaSnapshot = async (
  snapshotId: string,
  updatedFields: Partial<HeijunkaSnapshot>
): Promise<void> => {
  ensureHeijunkaAdmin('editar entregas do Heijunka');

  const userInfo = await getCurrentUserInfo();
  const now = Timestamp.now();
  const snapshotRef = doc(db, HEIJUNKA_COLLECTION, snapshotId);

  const sanitizedInput = Object.fromEntries(
    Object.entries(updatedFields).filter(([, value]) => value !== undefined)
  );

  const updateData: any = {
    ...sanitizedInput,
    updated_at: now,
  };

  if (userInfo) {
    updateData.updated_by = userInfo.uid;
    updateData.updated_by_name = userInfo.name;
  }

  await updateDoc(snapshotRef, updateData);
  console.log(`✅ Snapshot de Heijunka atualizado: ${snapshotId}`);
};

export const getHeijunkaHistory = async (daysLimit: number = 90): Promise<HeijunkaSnapshot[]> => {
  const q = query(
    collection(db, HEIJUNKA_COLLECTION),
    orderBy('created_at', 'desc'),
    limit(daysLimit)
  );

  const snapshot = await getDocs(q);
  
  const history = snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at,
    } as HeijunkaSnapshot;
  });

  // Retorna em ordem cronológica (do mais antigo para o mais recente) para o gráfico
  return history.reverse();
};

export const clearHeijunkaHistory = async (): Promise<number> => {
  ensureHeijunkaAdmin('zerar o histórico do Heijunka');

  const itemsRef = collection(db, HEIJUNKA_COLLECTION);
  const snapshot = await getDocs(itemsRef);

  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();

  console.log(`✅ Histórico do Heijunka limpo: ${snapshot.size} item(ns) removido(s)`);
  return snapshot.size;
};

export const deleteHeijunkaDay = async (date: string): Promise<number> => {
  ensureHeijunkaAdmin('excluir um dia de produção do Heijunka');

  const dayQuery = query(
    collection(db, HEIJUNKA_COLLECTION),
    where('date', '==', date)
  );

  const snapshot = await getDocs(dayQuery);

  if (snapshot.empty) {
    return 0;
  }

  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();

  console.log(`✅ Dia ${date} removido do Heijunka: ${snapshot.size} item(ns)`);
  return snapshot.size;
};
