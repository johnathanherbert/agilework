/**
 * lib/dashpesagem-api.ts
 * Helper de API para o módulo de DashPesagem e integrações no AgileWork
 */

import { AgingData, RemessaData, ConfiguracaoResiduais, DashboardSnapshot, ListaTecnicaItem, LoteInvestigacao } from '@/types/aging';

export type { DashboardSnapshot, LoteInvestigacao, ListaTecnicaItem };

export const getApiBaseUrl = (): string => {
  const configured = process.env.NEXT_PUBLIC_DASHPESAGEM_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  return typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
};

const API_BASE_URL = getApiBaseUrl();

// =====================================================
// STATUS / POLLING
// =====================================================

export async function fetchAgingStatus() {
  const url = `${getApiBaseUrl()}/api/aging/status?_t=${Date.now()}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) throw new Error('Erro ao buscar status de aging');
  return res.json();
}

export async function fetchSolicitacoes(status?: string) {
  const url = status && status !== 'todos' 
    ? `${API_BASE_URL}/api/solicitacoes?status=${encodeURIComponent(status)}`
    : `${API_BASE_URL}/api/solicitacoes`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Erro ao buscar solicitações');
  return res.json();
}

export async function createSolicitacao(data: any) {
  const res = await fetch(`${API_BASE_URL}/api/solicitacoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Erro ao criar solicitação');
  return res.json();
}

export async function updateSolicitacao(data: { id: string; status?: string; prioridade?: string; observacoes?: string }) {
  const res = await fetch(`${API_BASE_URL}/api/solicitacoes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Erro ao atualizar solicitação');
  return res.json();
}

export async function deleteSolicitacao(id: string) {
  const res = await fetch(`${API_BASE_URL}/api/solicitacoes?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Erro ao excluir solicitação');
  return res.json();
}

// =====================================================
// APP STATE
// =====================================================

export async function loadAppState(userId: string) {
  const res = await fetch(`${API_BASE_URL}/api/app-state?user_id=${encodeURIComponent(userId)}`, { cache: 'no-store' });
  if (!res.ok) return { state: null };
  return res.json();
}

export async function saveAppState(userId: string, state: any) {
  const res = await fetch(`${API_BASE_URL}/api/app-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, state }),
  });
  if (!res.ok) throw new Error('Erro ao salvar estado');
  return res.json();
}

export async function clearAppState(userId?: string) {
  const url = userId ? `${API_BASE_URL}/api/app-state?user_id=${encodeURIComponent(userId)}` : `${API_BASE_URL}/api/app-state`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error('Erro ao limpar estado');
  return res.json();
}

// =====================================================
// AGING ESTOQUE
// =====================================================

export async function fetchAgingData(): Promise<AgingData[]> {
  const res = await fetch(`${API_BASE_URL}/api/aging?_t=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) throw new Error('Erro ao buscar dados de aging');
  return res.json();
}

export async function replaceAllAgingData(newData: AgingData[]): Promise<void> {
  if (!newData || newData.length === 0) {
    throw new Error('Nenhum dado para inserir no banco');
  }
  const res = await fetch(`${API_BASE_URL}/api/aging`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newData),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Falha ao salvar dados de aging');
  }
}

export async function insertAgingData(data: AgingData[]): Promise<void> {
  await replaceAllAgingData(data);
}

export async function uploadExcelAging(data: any[]): Promise<{ success: boolean; count: number }> {
  await replaceAllAgingData(data);
  return { success: true, count: data.length };
}

export async function fetchSapMaterialStock(codigo: string) {
  const res = await fetch(`${API_BASE_URL}/api/aging?material=${encodeURIComponent(codigo)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Erro ao buscar estoque SAP');
  return res.json();
}

export async function fetchSaldoMP(): Promise<{ mp_codigo: string; mp_nome: string; saldo_total: number; total_lotes: number }[]> {
  const aging = await fetchAgingData();
  const map: Record<string, { mp_codigo: string; mp_nome: string; saldo_total: number; total_lotes: number }> = {};
  for (const item of aging) {
    const mat = item.material;
    if (!map[mat]) {
      map[mat] = {
        mp_codigo: mat,
        mp_nome: item.texto_breve_material || '',
        saldo_total: 0,
        total_lotes: 0,
      };
    }
    map[mat].saldo_total += item.estoque_disponivel || 0;
    map[mat].total_lotes += 1;
  }
  return Object.values(map);
}

// =====================================================
// MATERIAL VALORES
// =====================================================

const CACHE_KEY = 'material_valores_cache';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

interface CacheData {
  valores: Record<string, number>;
  timestamp: number;
  count: number;
}

function saveCacheToStorage(valores: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  const cacheData: CacheData = {
    valores,
    timestamp: Date.now(),
    count: Object.keys(valores).length,
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('⚠️ Erro ao salvar cache:', error);
  }
}

function loadCacheFromStorage(): Record<string, number> | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const cacheData: CacheData = JSON.parse(cached);
    const age = Date.now() - cacheData.timestamp;
    if (age > CACHE_EXPIRY_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cacheData.valores;
  } catch {
    return null;
  }
}

export function invalidateMaterialValoresCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CACHE_KEY);
}

export async function fetchMaterialValores(
  forceRefresh = false
): Promise<Record<string, number>> {
  if (!forceRefresh) {
    const cached = loadCacheFromStorage();
    if (cached) return cached;
  }

  const res = await fetch(`${API_BASE_URL}/api/material-valores`);
  if (!res.ok) {
    console.error('Erro ao buscar valores');
    return {};
  }
  const rows: { material: string; valor_unitario: number }[] = await res.json();
  const valoresMap: Record<string, number> = {};
  rows.forEach(row => {
    valoresMap[row.material] = Number(row.valor_unitario);
  });

  saveCacheToStorage(valoresMap);
  return valoresMap;
}

export async function replaceAllMaterialValores(
  data: { material: string; valor_unitario: number }[]
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/material-valores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Falha ao salvar valores');
  }
  invalidateMaterialValoresCache();
}

// =====================================================
// REMESSAS
// =====================================================

const REMESSAS_CACHE_KEY = 'remessas_cache';
const REMESSAS_CACHE_EXPIRY_MS = 60 * 60 * 1000;

interface RemessasCacheData {
  data: RemessaData[];
  timestamp: number;
  count: number;
}

function saveRemessasCache(data: RemessaData[]): void {
  if (typeof window === 'undefined') return;
  try {
    const cacheData: RemessasCacheData = {
      data,
      timestamp: Date.now(),
      count: data.length,
    };
    localStorage.setItem(REMESSAS_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('⚠️ Erro ao salvar cache de remessas:', error);
  }
}

function loadRemessasCache(): RemessaData[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(REMESSAS_CACHE_KEY);
    if (!cached) return null;
    const cacheData: RemessasCacheData = JSON.parse(cached);
    const age = Date.now() - cacheData.timestamp;
    if (age > REMESSAS_CACHE_EXPIRY_MS) {
      localStorage.removeItem(REMESSAS_CACHE_KEY);
      return null;
    }
    return cacheData.data;
  } catch {
    return null;
  }
}

export function invalidateRemessasCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(REMESSAS_CACHE_KEY);
  } catch (error) {
    console.warn('⚠️ Erro ao invalidar cache de remessas:', error);
  }
}

export async function fetchRemessas(forceRefresh = false): Promise<RemessaData[]> {
  if (!forceRefresh) {
    const cached = loadRemessasCache();
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  const res = await fetch(`${API_BASE_URL}/api/remessas`);
  if (!res.ok) throw new Error('Erro ao buscar remessas');
  const data: RemessaData[] = await res.json();
  saveRemessasCache(data);
  return data;
}

export async function replaceAllRemessas(newData: RemessaData[]): Promise<void> {
  if (!newData || newData.length === 0) {
    throw new Error('Nenhuma remessa para inserir');
  }
  const res = await fetch(`${API_BASE_URL}/api/remessas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newData),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Falha ao salvar remessas');
  }
  invalidateRemessasCache();
}

// =====================================================
// CONFIGURAÇÃO DE RESIDUAIS
// =====================================================

const DEFAULT_CONFIG: ConfiguracaoResiduais = {
  limite_verde: 100,
  limite_amarelo: 900,
  limite_maximo: 999,
  materiais_alto_valor: [],
};

export async function fetchConfiguracaoResiduais(): Promise<ConfiguracaoResiduais> {
  const res = await fetch(`${API_BASE_URL}/api/config-residuais`);
  if (!res.ok) return DEFAULT_CONFIG;
  const data = await res.json();
  return data || DEFAULT_CONFIG;
}

export async function saveConfiguracaoResiduais(
  config: ConfiguracaoResiduais
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/config-residuais`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Falha ao salvar configuração');
  }
}

// =====================================================
// DASHBOARD HISTÓRICO
// =====================================================

export async function fetchDashboardHistorico(
  limit = 90
): Promise<(DashboardSnapshot & { id: string; snapshot_at: string })[]> {
  const res = await fetch(`${API_BASE_URL}/api/dashboard-historico?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function saveSnapshotHistorico(
  data: AgingData[],
  valores: Record<string, number>
): Promise<void> {
  if (data.length === 0) return;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const em30Dias = new Date(hoje);
  em30Dias.setDate(hoje.getDate() + 30);

  const parseDate = (s: string): Date | null => {
    if (!s) return null;
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const d = new Date(+m[3], +m[2] - 1, +m[1]);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  let totalValorizado = 0, valorCritico = 0, valorAlerta = 0, itensComValor = 0;
  let valorAjuste = 0, itensAjuste = 0, valorAjuSaida = 0, itensAjuSaida = 0;
  let itensCriticos = 0, itensAlerta = 0, itensVencidos = 0, itensVencendo30d = 0;
  let materiaisInf = 0, materiaisCfa = 0;
  const { isMaterialEspecial } = await import('@/lib/materiais-especiais');

  const totalDias = data.reduce((s, i) => s + (i.dias_aging || 0), 0);
  const mediaAging = totalDias / data.length;
  const maxAging = Math.max(...data.map(i => i.dias_aging || 0));

  data.forEach(item => {
    const dias = item.dias_aging || 0;
    if (dias > 20) itensCriticos++;
    else if (dias >= 10) itensAlerta++;

    const esp = isMaterialEspecial(item.material);
    if (esp === 'inf') materiaisInf++;
    else if (esp === 'cfa') materiaisCfa++;

    const dv = item.data_vencimento ? parseDate(item.data_vencimento) : null;
    if (dv) {
      if (dv < hoje) itensVencidos++;
      else if (dv <= em30Dias) itensVencendo30d++;
    }

    const valor = valores[item.material];
    if (valor) {
      const vt = (item.estoque_disponivel || 0) * valor;
      totalValorizado += vt;
      itensComValor++;
      if (dias > 20) valorCritico += vt;
      else if (dias >= 10) valorAlerta += vt;

      const tipo = item.tipo_deposito?.toUpperCase() ?? '';
      const pos = item.posicao_deposito?.toUpperCase() ?? '';
      if (tipo === '999' && pos === 'AJUSTE') { valorAjuste += vt; itensAjuste++; }
      else if (tipo === '999' && pos === 'AJU-SAIDA') { valorAjuSaida += vt; itensAjuSaida++; }
    }
  });

  const snapshot: DashboardSnapshot = {
    total_itens: data.length,
    media_aging: Math.round(mediaAging * 100) / 100,
    max_aging: maxAging,
    itens_criticos: itensCriticos,
    itens_alerta: itensAlerta,
    total_valorizado: Math.round(totalValorizado * 100) / 100,
    valor_critico: Math.round(valorCritico * 100) / 100,
    valor_alerta: Math.round(valorAlerta * 100) / 100,
    itens_com_valor: itensComValor,
    valor_ajuste: Math.round(valorAjuste * 100) / 100,
    itens_ajuste: itensAjuste,
    valor_aju_saida: Math.round(valorAjuSaida * 100) / 100,
    itens_aju_saida: itensAjuSaida,
    itens_vencidos: itensVencidos,
    itens_vencendo_30d: itensVencendo30d,
    materiais_inf: materiaisInf,
    materiais_cfa: materiaisCfa,
  };

  try {
    await fetch(`${API_BASE_URL}/api/dashboard-historico`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
  } catch {
    console.warn('Aviso: não foi possível salvar snapshot de histórico');
  }
}

// =====================================================
// LOTES EM INVESTIGAÇÃO
// =====================================================

export async function fetchLotesInvestigacao(): Promise<LoteInvestigacao[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/lotes-investigacao`);
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    console.error('Erro ao buscar lotes em investigação:', error);
    return [];
  }
}

export async function addLoteInvestigacao(item: {
  lote: string;
  material?: string;
  motivo?: string;
  created_by?: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/lotes-investigacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return res.ok;
  } catch (error) {
    console.error('Erro ao adicionar lote em investigação:', error);
    return false;
  }
}

export async function removeLoteInvestigacao(lote: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/lotes-investigacao?lote=${encodeURIComponent(lote)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (error) {
    console.error('Erro ao remover lote de investigação:', error);
    return false;
  }
}

// =====================================================
// LISTA TÉCNICA (BOM)
// =====================================================

export async function fetchListaTecnica(params?: {
  materia_prima?: string;
  semi_acabado?: string;
  search?: string;
  codigo_receita?: string;
  ativo?: string;
  sugestoes?: string;
}): Promise<ListaTecnicaItem[]> {
  try {
    const query = new URLSearchParams();
    if (params?.materia_prima) query.set('materia_prima', params.materia_prima);
    if (params?.semi_acabado) query.set('semi_acabado', params.semi_acabado);
    if (params?.search) query.set('search', params.search);
    if (params?.codigo_receita) query.set('codigo_receita', params.codigo_receita);
    if (params?.ativo) query.set('ativo', params.ativo);
    if (params?.sugestoes) query.set('sugestoes', params.sugestoes);

    const qs = query.toString();
    const res = await fetch(`${API_BASE_URL}/api/lista-tecnica${qs ? `?${qs}` : ''}`);
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    console.error('Erro ao buscar lista técnica:', error);
    return [];
  }
}

// =====================================================
// AUTOMAÇÃO SAP
// =====================================================

export interface SapAutomationJob {
  id: number;
  command: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  requested_by?: string;
  script_code?: string;
  result_message?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
}

export async function triggerSapAutomation(
  command: string = 'movermigo',
  requestedBy: string = 'Web Dashboard',
  scriptCode?: string
): Promise<{ success: boolean; job?: SapAutomationJob; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/sap-automation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command,
        requested_by: requestedBy,
        script_code: scriptCode,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Erro ao disparar automação' };
    }
    return { success: true, job: data.job };
  } catch (error: any) {
    console.error('Erro ao disparar automação SAP:', error);
    return { success: false, error: error?.message || 'Erro de conexão' };
  }
}

export async function checkSapAutomationStatus(
  jobId: number
): Promise<SapAutomationJob | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/sap-automation?id=${jobId}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error('Erro ao verificar status do job SAP:', error);
    return null;
  }
}
