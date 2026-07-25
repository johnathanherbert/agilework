import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentUserInfo } from './firestore-helpers';
import { ProductionItem, HeijunkaSnapshot, HeijunkaTurnoStats } from '@/types';
import { clearProductionItems } from './production-helpers';

export const HEIJUNKA_COLLECTION = 'heijunka_snapshots';

export const saveHeijunkaSnapshot = async (metaDiaria: number, items: ProductionItem[]): Promise<string> => {
  const userInfo = await getCurrentUserInfo();
  const now = Timestamp.now();
  
  // Format date as YYYY-MM-DD for easier grouping
  const date = new Date().toISOString().split('T')[0];

  const ordens = items.filter(i => i.tipo === 'ordem');
  const pa = items.filter(i => i.tipo === 'auto');
  const pd = items.filter(i => i.tipo === 'direta');
  const umida = ordens.filter(i => i.via === 'UMIDA');
  const seca = ordens.filter(i => i.via === 'SECA');

  const turnosStats: Record<string, HeijunkaTurnoStats> = {
    '1': { ordens: 0, umida: 0, seca: 0, pa: 0, pd: 0, realizado: 0, programado: 0 },
    '2': { ordens: 0, umida: 0, seca: 0, pa: 0, pd: 0, realizado: 0, programado: 0 },
    '3': { ordens: 0, umida: 0, seca: 0, pa: 0, pd: 0, realizado: 0, programado: 0 }
  };

  // ── Classifica ordens entre Manual e Referenciada (PD/PA) ──────────────────
  // Uma ordem é "referenciada" se existir um item auto ou direta no mesmo turno
  // com o mesmo nome de produto (match case-insensitive).
  const pdpaProductsByTurno: Record<string, Set<string>> = { '1': new Set(), '2': new Set(), '3': new Set() };
  [...pa, ...pd].forEach(item => {
    const t = item.turno.toString();
    pdpaProductsByTurno[t]?.add(item.produto.toLowerCase().trim());
  });

  const ordensManual = ordens.filter(o => !pdpaProductsByTurno[o.turno.toString()]?.has(o.produto.toLowerCase().trim()));
  const ordensReferenciadas = ordens.filter(o => pdpaProductsByTurno[o.turno.toString()]?.has(o.produto.toLowerCase().trim()));

  // PD/PA total = todos auto + todos direta + ordens que têm correspondência em PA/PD
  // Manual total = ordens SEM correspondência
  const totalManual = ordensManual.length;
  // totalAll = totalManual + ordensReferenciadas + pa + pd
  //          = totalOrdens + totalPA + totalPD (mesmo total, apenas reclassificado)

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
    } else if (item.tipo === 'direta') {
      turnosStats[t].pd += 1;
    }

    turnosStats[t].realizado += item.real;
    turnosStats[t].programado += item.prog;
  });

  const data = {
    date,
    metaDiaria,
    totalOrdens: ordens.length,       // total de itens tipo='ordem' (para compatibilidade)
    totalManual: totalManual,          // ordens SEM referência em PA/PD (puramente manuais)
    totalUmida: umida.length,
    totalSeca: seca.length,
    totalPA: pa.length,
    totalPD: pd.length,
    totalRealizado: items.reduce((acc, curr) => acc + curr.real, 0),
    totalProgramado: items.reduce((acc, curr) => acc + curr.prog, 0),
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
  const itemsRef = collection(db, HEIJUNKA_COLLECTION);
  const snapshot = await getDocs(itemsRef);

  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();

  console.log(`✅ Histórico do Heijunka limpo: ${snapshot.size} item(ns) removido(s)`);
  return snapshot.size;
};
