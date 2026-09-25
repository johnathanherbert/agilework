// API helper for AgileWork connected directly to PostgreSQL backend
const API_BASE_URL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');

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

export async function fetchListaTecnica(params?: { search?: string; codigo_receita?: string; ativo?: string; sugestoes?: string }) {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.codigo_receita) query.set('codigo_receita', params.codigo_receita);
  if (params?.ativo) query.set('ativo', params.ativo);
  if (params?.sugestoes) query.set('sugestoes', params.sugestoes);

  const queryString = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/api/lista-tecnica${queryString}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Erro ao buscar lista técnica');
  return res.json();
}

export async function fetchSapMaterialStock(codigo: string) {
  const res = await fetch(`${API_BASE_URL}/api/aging?material=${encodeURIComponent(codigo)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Erro ao buscar estoque SAP');
  return res.json();
}

export async function fetchSaldoMP() {
  const res = await fetch(`${API_BASE_URL}/api/aging`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Erro ao buscar saldo');
  return res.json();
}

export async function uploadExcelAging(data: any[]) {
  const res = await fetch(`${API_BASE_URL}/api/aging`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Erro ao fazer upload dos dados de estoque');
  return res.json();
}

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
