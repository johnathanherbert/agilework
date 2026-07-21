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
export type User = {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'user';
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