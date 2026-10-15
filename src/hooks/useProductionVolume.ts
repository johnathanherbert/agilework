"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchListaTecnica } from '@/lib/dashpesagem-api';
import { ProductionItem, ProductionTurno } from '@/types';
import { formatKg } from '@/lib/production-schedule';

export { formatKg };

export interface ShiftVolumeStats {
  realKg: number;
  progKg: number;
  pct: number;
}

export interface ProductionVolumeResult {
  shiftVolumes: Record<ProductionTurno, ShiftVolumeStats>;
  dayVolume: ShiftVolumeStats;
  recipeWeights: Record<string, number>;
  recordVolumeKg: number;
  loading: boolean;
}

import wipRecipesData from '@/data/wip-recipes.json';

const wipProductToCode = new Map<string, string>();
if (Array.isArray(wipRecipesData)) {
  wipRecipesData.forEach((r: any) => {
    if (r.produto && r.codigo) {
      wipProductToCode.set(String(r.produto).toLowerCase().trim(), String(r.codigo).replace(/I$/i, '').trim());
    }
  });
}

// Extrai o código da receita/semi-acabado do item
export function extractRecipeCode(item: { codigoReceita?: string; produto?: string }): string | null {
  if (item.codigoReceita && item.codigoReceita.trim()) {
    // Remove "I" final de semi-acabado intermediário (ex: "703906I" -> "703906")
    const clean = item.codigoReceita.trim().replace(/I$/i, '').trim();
    if (clean) return clean;
  }
  if (item.produto) {
    const match = item.produto.trim().match(/^(\d{5,8})(?:I)?\b/i);
    if (match) return match[1];
    const fromWip = wipProductToCode.get(item.produto.toLowerCase().trim());
    if (fromWip) return fromWip;
  }
  return null;
}

// Cache global em memória para não repetir requisições HTTP desnecessárias
const memoryRecipeWeights = new Map<string, number>();

// Tenta carregar cache prévio do localStorage
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('pp_recipe_weights_cache');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'number') memoryRecipeWeights.set(k, v);
      });
    }
  } catch {}
}

function persistRecipeCache() {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, number> = {};
    memoryRecipeWeights.forEach((v, k) => {
      obj[k] = v;
    });
    localStorage.setItem('pp_recipe_weights_cache', JSON.stringify(obj));
  } catch {}
}

export function useProductionVolume(items: ProductionItem[]): ProductionVolumeResult {
  const [recipeWeights, setRecipeWeights] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    memoryRecipeWeights.forEach((v, k) => {
      initial[k] = v;
    });
    return initial;
  });

  const [recordVolumeKg, setRecordVolumeKg] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const val = localStorage.getItem('pp_highest_shift_volume_kg');
        if (val) return Number(val) || 0;
      } catch {}
    }
    return 0;
  });

  const [loading, setLoading] = useState(false);
  const fetchingCodesRef = useRef<Set<string>>(new Set());

  // 1. Sincroniza o recorde histórico com o Firestore (production_records/highest_shift_volume)
  useEffect(() => {
    if (!db) return;
    let unsub: (() => void) | undefined;
    try {
      const docRef = doc(db, 'production_records', 'highest_shift_volume');
      unsub = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (typeof data.recordKg === 'number' && data.recordKg > 0) {
              setRecordVolumeKg((prev) => {
                const max = Math.max(prev, data.recordKg);
                try {
                  localStorage.setItem('pp_highest_shift_volume_kg', String(max));
                } catch {}
                return max;
              });
            }
          }
        },
        (err) => {
          console.warn('Erro ao escutar recorde de volume no Firestore:', err);
        }
      );
    } catch (err) {
      console.warn('Falha ao iniciar listener do recorde:', err);
    }
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // 2. Coleta os códigos únicos de receitas das ordens em produção
  const targetCodes = useMemo(() => {
    const codes = new Set<string>();
    items.forEach((it) => {
      const code = extractRecipeCode(it);
      if (code) codes.add(code);
    });
    return Array.from(codes);
  }, [items]);

  // 3. Busca lista técnica no Postgres para receitas ainda não cacheadas
  useEffect(() => {
    const missingCodes = targetCodes.filter(
      (code) => !memoryRecipeWeights.has(code) && !fetchingCodesRef.current.has(code)
    );

    if (missingCodes.length === 0) return;

    let isMounted = true;
    setLoading(true);

    missingCodes.forEach((code) => fetchingCodesRef.current.add(code));

    Promise.all(
      missingCodes.map(async (code) => {
        try {
          const list = await fetchListaTecnica({ semi_acabado: code });
          // Filtra estritamente KG (ignora L e UN conforme regra do negócio)
          const kgItems = (list || []).filter(
            (m) => (m.un_materia_prima || '').toUpperCase().trim() === 'KG'
          );
          const totalKg = kgItems.reduce(
            (acc, cur) => acc + (Number(cur.qtd_materia_prima) || 0),
            0
          );
          return { code, totalKg };
        } catch (err) {
          console.error(`Erro ao buscar BOM para receita ${code}:`, err);
          return { code, totalKg: 0 };
        }
      })
    ).then((results) => {
      if (!isMounted) return;

      results.forEach(({ code, totalKg }) => {
        memoryRecipeWeights.set(code, totalKg);
        fetchingCodesRef.current.delete(code);
      });

      persistRecipeCache();

      setRecipeWeights(() => {
        const updated: Record<string, number> = {};
        memoryRecipeWeights.forEach((v, k) => {
          updated[k] = v;
        });
        return updated;
      });

      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [targetCodes]);

  // 4. Calcula o volume em kg para cada turno (1, 2 e 3)
  const shiftVolumes = useMemo(() => {
    const shifts: Record<ProductionTurno, ShiftVolumeStats> = {
      1: { realKg: 0, progKg: 0, pct: 0 },
      2: { realKg: 0, progKg: 0, pct: 0 },
      3: { realKg: 0, progKg: 0, pct: 0 },
    };

    const orders = items.filter((it) => it.tipo === 'ordem');
    const pdpaUnique = items.filter((it) => {
      if (it.tipo !== 'auto' && it.tipo !== 'direta') return false;
      return !orders.some((o) => o.turno === it.turno && o.produto === it.produto);
    });

    [...orders, ...pdpaUnique].forEach((it) => {
      const turno = it.turno as ProductionTurno;
      if (!shifts[turno]) return;

      const code = extractRecipeCode(it);
      const unitWeight = code ? (recipeWeights[code] ?? memoryRecipeWeights.get(code) ?? 0) : 0;

      if (unitWeight > 0) {
        shifts[turno].realKg += (it.real || 0) * unitWeight;
        shifts[turno].progKg += (it.prog || 0) * unitWeight;
      }
    });

    ([1, 2, 3] as ProductionTurno[]).forEach((t) => {
      const s = shifts[t];
      s.pct = s.progKg > 0 ? Math.round((s.realKg / s.progKg) * 100) : 0;
    });

    return shifts;
  }, [items, recipeWeights]);

  // 5. Volume consolidado do dia
  const dayVolume = useMemo(() => {
    const realKg = shiftVolumes[1].realKg + shiftVolumes[2].realKg + shiftVolumes[3].realKg;
    const progKg = shiftVolumes[1].progKg + shiftVolumes[2].progKg + shiftVolumes[3].progKg;
    const pct = progKg > 0 ? Math.round((realKg / progKg) * 100) : 0;
    return { realKg, progKg, pct };
  }, [shiftVolumes]);

  // 6. Atualização automática de novo recorde de volume por turno
  const updateRecord = useCallback(
    async (newRecordKg: number, turno: ProductionTurno) => {
      if (newRecordKg <= recordVolumeKg) return;

      setRecordVolumeKg(newRecordKg);
      try {
        localStorage.setItem('pp_highest_shift_volume_kg', String(newRecordKg));
      } catch {}

      if (db) {
        try {
          const docRef = doc(db, 'production_records', 'highest_shift_volume');
          await setDoc(
            docRef,
            {
              recordKg: newRecordKg,
              turno,
              updated_at: Timestamp.now(),
            },
            { merge: true }
          );
        } catch (err) {
          console.warn('Erro ao persistir recorde no Firestore:', err);
        }
      }
    },
    [recordVolumeKg]
  );

  useEffect(() => {
    ([1, 2, 3] as ProductionTurno[]).forEach((t) => {
      const sVol = shiftVolumes[t];
      if (sVol.realKg > recordVolumeKg) {
        updateRecord(sVol.realKg, t);
      }
    });
  }, [shiftVolumes, recordVolumeKg, updateRecord]);

  return {
    shiftVolumes,
    dayVolume,
    recipeWeights,
    recordVolumeKg,
    loading,
  };
}
