export type Company = {
  id: string;
  name: string;
  trade_name: string | null;
  document: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  slug: string;
  onboarding_completed_at: string | null;
};

export type UnitStatus = "active" | "inactive";

export type Unit = {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  status: UnitStatus;
  business_hours_note: string | null;
};

export type Professional = {
  id: string;
  company_id: string;
  unit_id: string | null;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role_title: string | null;
  active: boolean;
  default_commission_percent: number | null;
};

export type Service = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  category: string | null;
  default_price: number;
  planned_duration_minutes: number;
  status: string;
  default_commission_percent: number | null;
  is_public: boolean;
};

export type Product = {
  id: string;
  company_id: string;
  unit_id: string;
  name: string;
  category: string | null;
  cost_price: number;
  sale_price: number;
  current_stock: number;
  minimum_stock: number;
  active: boolean;
};

export type Consumable = {
  id: string;
  company_id: string;
  unit_id: string;
  name: string;
  category: string | null;
  unit_of_measure: string;
  cost_price: number;
  current_stock: number;
  minimum_stock: number;
  active: boolean;
};

export type PaymentMethodKey = "cash" | "pix" | "debit" | "credit" | "credit_installments";

export type PaymentMethod = {
  id: string;
  company_id: string;
  method: PaymentMethodKey;
  active: boolean;
};

export type CashRegister = {
  id: string;
  company_id: string;
  unit_id: string;
  name: string;
  active: boolean;
};

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

export type ProfessionalSchedule = {
  id: string;
  professional_id: string;
  weekday: number; // 0=domingo .. 6=sábado (mesma convenção do extract(dow) do Postgres)
  start_time: string; // "HH:MM:SS"
  end_time: string;
  active: boolean;
};

export type ProfessionalScheduleBreak = {
  id: string;
  schedule_id: string;
  start_time: string;
  end_time: string;
};

export type UnitBusinessHours = {
  id: string;
  unit_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
};

export type ProfessionalBlockStatus = "active" | "cancelled";

export type ProfessionalBlock = {
  id: string;
  professional_id: string;
  unit_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  status: ProfessionalBlockStatus;
};

export type ProfessionalAbsenceType =
  | "vacation"
  | "day_off"
  | "leave"
  | "holiday"
  | "other";

export type ProfessionalAbsence = {
  id: string;
  professional_id: string;
  starts_at: string;
  ends_at: string;
  type: ProfessionalAbsenceType;
  reason: string | null;
};

export type AvailableSlot = {
  professional_id: string;
  professional_name: string;
  slot_start: string;
  slot_end: string;
};

export type Client = {
  id: string;
  company_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  notes: string | null;
  communication_consent: boolean;
  tags: string[];
};

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled_by_client"
  | "cancelled_by_company"
  | "no_show";

export type Appointment = {
  id: string;
  company_id: string;
  unit_id: string;
  client_id: string;
  status: AppointmentStatus;
  client_access_token: string;
};

export type AppointmentService = {
  id: string;
  appointment_id: string;
  service_id: string;
  professional_id: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

export type AttendanceStatus = "in_progress" | "completed" | "cancelled";

export type Attendance = {
  id: string;
  company_id: string;
  unit_id: string;
  client_id: string;
  origin_appointment_id: string | null;
  origin: "from_appointment" | "walk_in";
  status: AttendanceStatus;
};

export type AttendanceItemKind = "service" | "product";

export type AttendanceItem = {
  id: string;
  attendance_id: string;
  kind: AttendanceItemKind;
  service_id: string | null;
  professional_id: string | null;
  product_id: string | null;
  quantity: number;
  original_price: number;
  discount: number;
  final_price: number;
  type: "normal" | "courtesy";
  courtesy_reason: string | null;
  planned_duration_minutes: number | null;
  started_at: string | null;
  ended_at: string | null;
  commission_percent_snapshot: number | null;
  commission_amount: number | null;
};

/**
 * Fase 4 — domínio operacional (VENDA→PAGAMENTO→CAIXA/ESTOQUE/COMISSÃO/
 * FINANCEIRO/CRM). Formato de retorno das tabelas criadas em
 * supabase/migrations/20260908160000_phase4_operational_core.sql — todas
 * lidas via RLS comum (nunca por função pública), o mesmo padrão das
 * tabelas das fases 1-2.
 */
export type SaleStatus = "completed" | "cancelled";

export type Sale = {
  id: string;
  company_id: string;
  unit_id: string;
  client_id: string;
  attendance_id: string | null;
  status: SaleStatus;
  subtotal: number;
  discount_amount: number;
  surcharge_amount: number;
  total: number;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  company_id: string;
  kind: AttendanceItemKind;
  service_id: string | null;
  product_id: string | null;
  attendance_item_id: string | null;
  professional_id: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  is_courtesy: boolean;
  total: number;
};

export type PaymentStatus = "pending" | "confirmed" | "cancelled" | "refunded";

export type Payment = {
  id: string;
  company_id: string;
  sale_id: string;
  method: PaymentMethodKey;
  amount: number;
  status: PaymentStatus;
  cash_session_id: string | null;
  created_at: string;
  refunded_at: string | null;
  refunded_reason: string | null;
};

export type CommissionStatus = "predicted" | "due" | "paid" | "reversed";

export type Commission = {
  id: string;
  company_id: string;
  sale_item_id: string;
  professional_id: string;
  base_amount: number;
  percent: number;
  amount: number;
  status: CommissionStatus;
  paid_at: string | null;
  reversed_at: string | null;
  created_at: string;
};

export type StockItemType = "product" | "consumable";
export type StockMovementType = "entry" | "sale" | "consumption" | "adjustment" | "loss" | "inventory";

export type StockMovement = {
  id: string;
  company_id: string;
  unit_id: string;
  item_type: StockItemType;
  product_id: string | null;
  consumable_id: string | null;
  movement_type: StockMovementType;
  quantity: number;
  unit_cost: number | null;
  reason: string | null;
  created_at: string;
};

export type CashSessionStatus = "open" | "closed";

export type CashSession = {
  id: string;
  company_id: string;
  cash_register_id: string;
  unit_id: string;
  opened_at: string;
  opening_balance: number;
  closed_at: string | null;
  expected_balance: number | null;
  counted_balance: number | null;
  difference: number | null;
  status: CashSessionStatus;
  notes: string | null;
};

export type CashMovementType = "sale_payment" | "sangria" | "suprimento" | "other_in" | "other_out";

export type CashMovement = {
  id: string;
  company_id: string;
  cash_session_id: string;
  type: CashMovementType;
  amount: number;
  method: string | null;
  reason: string | null;
  created_at: string;
};

export type FinancialEntryType = "income" | "expense";

export type FinancialEntry = {
  id: string;
  company_id: string;
  unit_id: string | null;
  type: FinancialEntryType;
  category: string;
  description: string | null;
  amount: number;
  quantity: number | null;
  unit_cost: number | null;
  supplier: string | null;
  reference_type: string | null;
  entry_date: string;
  created_at: string;
};

export type CampaignStatus = "draft" | "scheduled" | "active" | "completed";

export type Campaign = {
  id: string;
  company_id: string;
  name: string;
  objective: string | null;
  channel: "whatsapp" | "sms" | "email" | "other";
  period_start: string | null;
  period_end: string | null;
  status: CampaignStatus;
  result: Record<string, unknown> | null;
  created_at: string;
};

/** Espelha o RETURNS TABLE de public.get_dashboard_metrics() — fonte
 * única de métricas reaproveitada por Dashboard, KPIs, Central e
 * Relatórios (seção 12/13 da Fase 4). */
export type DashboardMetrics = {
  faturamento: number;
  receita_recebida: number;
  estornos: number;
  ticket_medio: number;
  atendimentos_count: number;
  clientes_novos: number;
  clientes_recorrentes: number;
  cancelamentos_count: number;
  no_show_count: number;
  ocupacao_real_minutos: number;
  ocupacao_planejada_minutos: number;
  comissoes_total: number;
  caixa_saldo_atual: number;
  estoque_critico_count: number;
};

export type ClientStatus = "ativo" | "atencao" | "recuperacao" | "inativo";

/**
 * Tipos da Fase 3 — camada pública. Formato de retorno das funções
 * SECURITY DEFINER de supabase/migrations/20260908150000_phase3_public_
 * slug_and_booking.sql, nunca das tabelas diretamente (o visitante público
 * nunca lê `company`/`service`/etc. — só o que essas funções decidem
 * expor).
 */
export type PublicCompany = {
  company_id: string;
  name: string;
  trade_name: string | null;
  logo_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  unit_id: string | null;
  unit_name: string | null;
  unit_address: string | null;
  unit_phone: string | null;
};

export type PublicService = {
  service_id: string;
  name: string;
  description: string | null;
  category: string | null;
  default_price: number;
  planned_duration_minutes: number;
};

export type PublicProfessional = {
  professional_id: string;
  name: string;
  avatar_url: string | null;
  role_title: string | null;
};

export type PublicSlot = {
  professional_id: string;
  professional_name: string;
  slot_start: string;
  slot_end: string;
};

export type PublicAppointmentCreated = {
  appointment_id: string;
  appointment_service_id: string;
  client_access_token: string;
  starts_at: string;
  ends_at: string;
};

export type PublicAppointment = {
  appointment_id: string;
  status: AppointmentStatus;
  company_name: string;
  unit_name: string;
  service_name: string;
  professional_name: string;
  starts_at: string;
  ends_at: string;
  price: number;
  client_name: string;
};
