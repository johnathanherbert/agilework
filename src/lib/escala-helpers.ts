import escalaJson from '../../escala.json';
import { EscalaDay, OperatorTurma } from '@/types';

export interface TurmaInfo {
  id: OperatorTurma;
  nome: string;
  cor: string;
  descricao: string;
  bgLight: string;
  borderLight: string;
  textLight: string;
}

export const TURMAS_INFO: Record<OperatorTurma, TurmaInfo> = {
  A: {
    id: 'A',
    nome: 'Turma A',
    cor: '#3B82F6',
    descricao: 'Equipe / Grupo A (Azul)',
    bgLight: 'bg-blue-500/15 dark:bg-blue-500/25',
    borderLight: 'border-blue-500/30',
    textLight: 'text-blue-600 dark:text-blue-400',
  },
  B: {
    id: 'B',
    nome: 'Turma B',
    cor: '#10B981',
    descricao: 'Equipe / Grupo B (Verde)',
    bgLight: 'bg-emerald-500/15 dark:bg-emerald-500/25',
    borderLight: 'border-emerald-500/30',
    textLight: 'text-emerald-600 dark:text-emerald-400',
  },
  C: {
    id: 'C',
    nome: 'Turma C',
    cor: '#F59E0B',
    descricao: 'Equipe / Grupo C (Amarelo)',
    bgLight: 'bg-amber-500/15 dark:bg-amber-500/25',
    borderLight: 'border-amber-500/30',
    textLight: 'text-amber-600 dark:text-amber-400',
  },
  D: {
    id: 'D',
    nome: 'Turma D',
    cor: '#8B5CF6',
    descricao: 'Equipe / Grupo D (Roxo)',
    bgLight: 'bg-purple-500/15 dark:bg-purple-500/25',
    borderLight: 'border-purple-500/30',
    textLight: 'text-purple-600 dark:text-purple-400',
  },
};

const escalaMap: Map<string, EscalaDay> = new Map();

// Pré-indexa para busca O(1)
if (escalaJson && Array.isArray((escalaJson as any).escala)) {
  (escalaJson as any).escala.forEach((item: any) => {
    escalaMap.set(item.data, item as EscalaDay);
  });
}

/**
 * Retorna os dados completos da escala de um dia específico (YYYY-MM-DD)
 */
export function getEscalaForDate(dateStr: string): EscalaDay | null {
  if (escalaMap.has(dateStr)) {
    return escalaMap.get(dateStr)!;
  }

  // Fallback caso a data não esteja no ano de 2026: calcula com base no ciclo de 28 dias
  try {
    const targetDate = new Date(dateStr + 'T12:00:00Z');
    const baseDate = new Date('2026-01-01T12:00:00Z');
    const diffTime = targetDate.getTime() - baseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Normaliza para o ciclo de 365 dias do ano 2026
    const normalizedIndex = ((diffDays % 365) + 365) % 365;
    const escalaList = (escalaJson as any).escala as EscalaDay[];
    if (escalaList && escalaList[normalizedIndex]) {
      const refDay = escalaList[normalizedIndex];
      return {
        ...refDay,
        data: dateStr,
        dia: targetDate.getDate(),
        mes: targetDate.getMonth() + 1,
        ano: targetDate.getFullYear(),
      };
    }
  } catch (e) {
    console.error('Erro ao calcular escala fallback para data:', dateStr, e);
  }

  return null;
}

/**
 * Retorna a turma/letra de folga da escala no dia (A, B, C ou D).
 * No modelo de 4 turmas, a letra do dia é a turma que está de FOLGA, e as outras 3 turmas trabalham.
 */
export function getTurmaEscalada(dateStr: string): OperatorTurma {
  const day = getEscalaForDate(dateStr);
  return day ? day.turma_escalada : 'A';
}

/**
 * Retorna a turma que está de folga no dia
 */
export function getTurmaFolga(dateStr: string): OperatorTurma {
  return getTurmaEscalada(dateStr);
}

/**
 * Retorna a lista das 3 turmas que estão escaladas para trabalhar na data
 */
export function getTurmasTrabalhando(dateStr: string): OperatorTurma[] {
  const turmaFolga = getTurmaFolga(dateStr);
  const todas: OperatorTurma[] = ['A', 'B', 'C', 'D'];
  return todas.filter((t) => t !== turmaFolga);
}

/**
 * Retorna se o operador com a letra informada está em folga programada da escala na data
 */
export function isFolgaDaEscala(operadorLetra: OperatorTurma, dateStr: string): boolean {
  const turmaFolga = getTurmaFolga(dateStr);
  return operadorLetra === turmaFolga;
}

/**
 * Retorna se o operador com a letra informada está escalado para trabalhar na data (não está na turma de folga)
 */
export function isEscaladoParaTrabalhar(operadorLetra: OperatorTurma, dateStr: string): boolean {
  const turmaFolga = getTurmaFolga(dateStr);
  return operadorLetra !== turmaFolga;
}

/**
 * Retorna todos os dias da escala de um determinado mês (1 a 12)
 */
export function getEscalaForMonth(year: number, month: number): EscalaDay[] {
  const escalaList = (escalaJson as any).escala as EscalaDay[];
  if (!escalaList) return [];

  return escalaList.filter((item) => {
    // month é 1-indexed (1 = Janeiro, ..., 12 = Dezembro)
    return item.mes === month;
  });
}

/**
 * Retorna lista de todos os feriados registrados no ano
 */
export function getFeriadosYear(): { data: string; nome: string; tipo: string }[] {
  return (escalaJson as any).feriados || [];
}

/**
 * Retorna todos os 365 dias da escala de 2026
 */
export function getAllEscalaDays(): EscalaDay[] {
  return ((escalaJson as any).escala as EscalaDay[]) || [];
}

/**
 * Retorna o resumo estatístico oficial do arquivo escala.json
 */
export function getResumoEstatistico() {
  return (escalaJson as any).resumo_estatistico || null;
}

/**
 * Retorna metadados gerais da escala
 */
export function getEscalaMetadata() {
  return (escalaJson as any).metadata || null;
}

/**
 * Retorna cor hexadecimal de uma turma
 */
export function getCorTurma(letra: OperatorTurma): string {
  return TURMAS_INFO[letra]?.cor || '#3B82F6';
}

export interface Ciclo28Item {
  diaCiclo: number;
  turmaFolga: OperatorTurma;
  turmasTrabalhando: OperatorTurma[];
  faseNome: string;
}

/**
 * Retorna a tabela detalhada dos 28 dias do ciclo rotativo
 */
export function getCiclo28Table(): Ciclo28Item[] {
  const allDays = getAllEscalaDays();
  const mapCiclo: Map<number, OperatorTurma> = new Map();
  
  for (const day of allDays) {
    if (day.dia_ciclo_28 && !mapCiclo.has(day.dia_ciclo_28)) {
      mapCiclo.set(day.dia_ciclo_28, day.turma_escalada);
      if (mapCiclo.size === 28) break;
    }
  }

  const result: Ciclo28Item[] = [];
  const todasTurmas: OperatorTurma[] = ['A', 'B', 'C', 'D'];

  for (let i = 1; i <= 28; i++) {
    const folga = mapCiclo.get(i) || 'A';
    const trabalhando = todasTurmas.filter((t) => t !== folga);
    result.push({
      diaCiclo: i,
      turmaFolga: folga,
      turmasTrabalhando: trabalhando,
      faseNome: `Dia ${i} do Ciclo`,
    });
  }

  return result;
}

