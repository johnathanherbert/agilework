export interface Solicitacao {
  id: string;
  created_at: string;
  codigo_mp: string;
  nome_mp: string;
  quantidade_solicitada: number;
  unidade: string;
  status: 'pendente' | 'aprovada' | 'recusada' | 'entregue';
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  solicitante: string;
  observacoes?: string;
  data_necessidade: string;
  produto_destino?: string;
  updated_at?: string;
}

export interface SolicitacaoFormData {
  codigo_mp: string;
  nome_mp: string;
  quantidade_solicitada: number;
  unidade: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  solicitante: string;
  observacoes?: string;
  data_necessidade: string;
  produto_destino?: string;
}

export interface ListaTecnicaItem {
  id: number;
  concatenar?: string;
  status?: string;
  semi_acabado: string;
  descricao_semi_acabado: string;
  qtd_semi_acabado: number;
  centro_semi_acabado: string;
  materia_prima: string;
  descricao_materia_prima: string;
  qtd_materia_prima: number;
  un_materia_prima: string;
}

export interface SaldoMP {
  mp_codigo: string;
  mp_nome: string;
  saldo_total: number;
  total_lotes: number;
}
