   // NT Types
export type NT = {
  id: string;
  nt_number: string;
  created_date: string;
  created_time: string;
  status: string;
  created_at: string;
  updated_at: string;
  items?: NTItem[];
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