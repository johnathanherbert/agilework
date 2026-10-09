export type PesagemTodoStatus = 'pendente' | 'em_investigacao' | 'aguardando_sap' | 'concluido';
export type PesagemTodoPriority = 'baixa' | 'media' | 'alta' | 'critica';

export interface PesagemTodoNote {
  id: string;
  texto: string;
  created_at: string;
  created_by?: string;
  created_by_name?: string;
}

export interface PesagemTodoAcao {
  id: string;
  texto: string;
  responsavel?: string;
  prazo?: string; // YYYY-MM-DD
  feito: boolean;
  feito_em?: string;
  created_at: string;
  created_by_name?: string;
}

export interface PesagemTodoItem {
  id: string;
  material: string;
  texto_breve_material: string;
  lote: string;
  unidade_medida: string;

  // Snapshot inicial no momento do registro
  quantidade_inicial: number;
  valor_unitario_inicial: number;
  valor_total_inicial: number;
  deposito_inicial: string;
  tipo_deposito_inicial: string;
  posicao_deposito_inicial: string;
  dias_aging_inicial?: number;
  data_vencimento?: string;

  // Acompanhamento e status
  status: PesagemTodoStatus;
  prioridade: PesagemTodoPriority;
  motivo_inicial?: string;
  notas: PesagemTodoNote[];
  acoes?: PesagemTodoAcao[];
  tags?: string[];

  // Desfecho e conclusão
  resolvido_em?: string;
  resolvido_por?: string;
  resolvido_por_name?: string;
  desfecho?: string;

  // Auditoria
  created_at: string;
  updated_at: string;
  created_by?: string;
  created_by_name?: string;
  updated_by?: string;
  updated_by_name?: string;
}

export type EstoqueDiffStatus =
  | 'ativo_sem_alteracao'
  | 'quantidade_reduziu'
  | 'quantidade_aumentou'
  | 'posicao_alterada'
  | 'saiu_do_estoque';

export interface PesagemTodoItemEnriched extends PesagemTodoItem {
  // Dados ao vivo da base de estoque atual
  estoque_atual?: number;
  valor_total_atual?: number;
  posicao_atual?: string;
  deposito_atual?: string;
  tipo_deposito_atual?: string;
  dias_aging_atual?: number;
  diff_status: EstoqueDiffStatus;
  diff_quantidade: number; // atual - inicial
  diff_valor: number; // atual - inicial
  localizado_no_estoque: boolean;
}
