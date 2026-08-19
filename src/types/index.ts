   // NT Types
export type NT = {
  id: string;
  nt_number: string;
  created_date: string;
  created_time: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by?: string; // User ID
  created_by_name?: string; // User display name
  updated_by?: string; // User ID
  updated_by_name?: string; // User display name
  items?: NTItem[];
};

// Painel de Produção (Pesagem) Types
export type ProductionTurno = 1 | 2 | 3;
export type ProductionTipo = 'ordem' | 'auto' | 'direta';
export type ProductionVia = 'UMIDA' | 'SECA';

export type ProductionItem = {
  id: string;
  turno: ProductionTurno;
  tipo: ProductionTipo;
  via?: ProductionVia; // Somente para tipo 'ordem'
  familia?: string; // Somente para tipo 'ordem'
  lp?: boolean; // Tag "LP" (Lote Piloto) - somente para tipo 'ordem', destaca o card em roxo
  codigoReceita?: string; // Código do material/receita no rotas.json (ex: 700236)
  produto: string;
  prog: number;
  real: number;
  // Divisão de ordem entre turnos: o "prog" do item pai é mantido apenas
  // para acompanhamento visual dos supervisores; enquanto travado (locked),
  // não é permitido editar/completar o item pai até o turno de destino
  // arrastar o item filho de volta (o que mescla e destrava novamente).
  locked?: boolean; // true no item "pai" enquanto a divisão estiver ativa
  splitChildId?: string; // presente no item "pai": id do item filho gerado pela divisão
  splitParentId?: string; // presente no item "filho": id do item pai de origem
  created_at: string;
  updated_at: string;
  created_by?: string;
  created_by_name?: string;
  updated_by?: string;
  updated_by_name?: string;
};

// NT Item Types
export type NTItem = {
  id: string;
  nt_id: string;
  item_number: number;
  code: string;
  description: string;
  quantity: string;
  batch: string | null;
  created_date: string;
  created_time: string;
  payment_time: string | null;
  status: ItemStatus;
  created_at: string;
  updated_at: string;
  priority: boolean;
  created_by?: string; // User ID
  created_by_name?: string; // User display name
  updated_by?: string; // User ID
  updated_by_name?: string; // User display name
};

// Item Status Type
export type ItemStatus = 'Ag. Pagamento' | 'Pago' | 'Pago Parcial';

// Robot Alert Types
export type RobotAlert = {
  id: string;
  message: string;
  alert_type: string;
  active: boolean;
  created_at: string;
  resolved_at: string | null;
};

// Filter Types
export type NTFilters = {
  search: string;
  status: string[];
  dateRange: { from: string; to: string } | null;
  shift: number | null;
  overdueOnly: boolean;
  hideOldNts: boolean;
  priorityOnly: boolean;
  isCompletedView?: boolean;
};

// Stats Types
export type NTStats = {
  totalNTs: number;
  pendingItems: number;
  paidToday: number;
  overdueItems: number;
};

// User types
export type UserRole = 'admin' | 'supervisor' | 'leader' | 'user';

export type User = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  turno?: ProductionTurno | null;
  allowedMaoDeObra?: boolean;
};

// Mão de Obra & Escala Types
export type OperatorTurma = 'A' | 'B' | 'C' | 'D';
export type OperatorStatus = 'ativo' | 'ferias' | 'afastado' | 'inativo';

export type Operator = {
  id: string;
  nome: string;
  matricula: string;
  cargo: string;
  letra: OperatorTurma;
  turno: ProductionTurno;
  saldoFolgasFlexiveis: number; // em dias (pode ser negativo/positivo/zero)
  status: OperatorStatus;
  dataAdmissao?: string;
  telefone?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  created_by_name?: string;
  updated_by?: string;
  updated_by_name?: string;
};

export type LaborOccurrenceType =
  | 'falta_injustificada'
  | 'falta_justificada'
  | 'atestado'
  | 'folga_flexivel'
  | 'ferias'
  | 'hora_extra'
  | 'atraso';

export type TratativaStatus = 'pendente' | 'em_andamento' | 'encaminhado_rh' | 'encaminhado_medicina' | 'concluido' | 'arquivado';
export type TratativaPriority = 'baixa' | 'media' | 'alta' | 'urgente';

export type TratativaActionStep = {
  id: string;
  tipoAcao: 'conversa_feedback' | 'orientacao_verbal' | 'advertencia_escrita' | 'suspensao' | 'encaminhamento_rh' | 'encaminhamento_medicina' | 'reuniao_alinhamento' | 'outro';
  descricao: string;
  data: string; // ISO ou YYYY-MM-DD
  registradoPor: string;
  registradoPorId?: string;
  statusConclusao?: boolean;
  prazoRevisao?: string;
  anexosInfo?: string;
};

export type LaborOccurrence = {
  id: string;
  operadorId: string;
  operadorNome: string;
  operadorCargo: string;
  operadorLetra: OperatorTurma;
  turno: ProductionTurno;
  tipo: LaborOccurrenceType;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  dias: number;
  horasImpacto?: number;
  minutosAtraso?: number;
  motivo?: string;
  queixas?: string; // Queixas/sintomas do operador (simplificado — antes era campo CID)
  cid?: string; // Mantido para compatibilidade retroativa
  tipoFolgaFlexivel?: 'concessao' | 'debito';
  impactaAbsenteismo: boolean;
  obsSupervisao?: string; // Observações e tratativas registradas pela supervisão
  obsSupervisaoUpdatedAt?: string; // Data da última atualização das obs da supervisão
  obsSupervisaoUpdatedBy?: string; // Nome do supervisor que atualizou
  tratativaStatus?: TratativaStatus;
  tratativaPriority?: TratativaPriority;
  tratativaPassos?: TratativaActionStep[];
  prazoTratativa?: string; // YYYY-MM-DD
  created_at: string;
  created_by?: string;
  created_by_name?: string;
  updated_at?: string;
};

export type VacationConflict = {
  id: string;
  tipo: 'cargo' | 'letra' | 'capacidade';
  severidade: 'alta' | 'media' | 'baixa';
  titulo: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  turno: ProductionTurno;
  operadores: {
    id: string;
    nome: string;
    cargo: string;
    letra: OperatorTurma;
  }[];
};

export type AbsenteeismStats = {
  totalOperadores: number;
  diasHomemProgramados: number;
  horasHomemProgramadas: number;
  diasPerdidosFaltasInjustificadas: number;
  diasPerdidosFaltasJustificadas: number;
  diasPerdidosAtestados: number;
  totalDiasPerdidos: number;
  totalHorasPerdidas: number;
  taxaAbsenteismo: number; // % geral
  taxaAtestados: number;   // % de atestados
  taxaFaltas: number;      // % de faltas
  taxaFolgasFlexiveis: number;
  diasFolgasFlexiveis: number;
  diasFerias: number;
};

export type EscalaDay = {
  data: string; // YYYY-MM-DD
  dia: number;
  mes: number;
  mes_nome: string;
  ano: number;
  dia_semana: string;
  dia_semana_curto: string;
  dia_semana_iso: number;
  e_fim_de_semana: boolean;
  e_feriado: boolean;
  feriado_nome: string | null;
  feriado_tipo: string | null;
  turma_escalada: OperatorTurma;
  dia_ciclo_28: number;
};

// Analytics Types
export type Analytics = {
  dailyPayments: number;
  averageProcessingTime: string;
  totalItemsProcessed: number;
  paymentRatio: number;
};

// Response Type
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// Heijunka Types
export type HeijunkaTurnoStats = {
  ordens: number;
  umida: number;
  seca: number;
  pa: number;
  pd: number;
  realizado: number;
  programado: number;
  volPA?: number;
  volPD?: number;
  volManual?: number;
};

export type HeijunkaSnapshot = {
  id: string;
  date: string; // YYYY-MM-DD format for easier querying
  metaDiaria: number;
  totalOrdens: number;
  totalUmida: number;
  totalSeca: number;
  totalPA: number;
  totalPD: number;
  totalRealizado: number;
  totalProgramado: number;
  totalManual: number;        // ordens tipo='ordem' SEM correspondente em auto/direta
  volManual?: number;         // Soma do real de ordens manuais
  volPA?: number;             // Soma do real de PA
  volPD?: number;             // Soma do real de PD
  volOrdensComRef?: number;   // Soma do real de ordens referenciadas
  turnos: Record<string, HeijunkaTurnoStats>;
  familias: Record<string, number>;
  created_at: string;
  created_by?: string;
  created_by_name?: string;
};