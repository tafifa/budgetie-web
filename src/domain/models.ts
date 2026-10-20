/**
 * Domain models. The JSON (snake_case) shape is identical to the original Dart app so data
 * already stored under `budgetie.dataset.v1` and old JSON backups keep working.
 */
import { localTimestamp, todayKey } from './formatters';

export type AccountType = 'bank' | 'ewallet' | 'cash' | 'paylater';
export type TransactionType = 'income' | 'expense';
export type CalculationMode = 'auto' | 'manual';
export type PaymentStatus = 'unpaid' | 'paid';

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'bank', label: 'Bank' },
  { value: 'ewallet', label: 'E-wallet' },
  { value: 'cash', label: 'Cash' },
  { value: 'paylater', label: 'Paylater / Credit' },
];
export const accountTypeLabel = (type: AccountType) => ACCOUNT_TYPES.find((item) => item.value === type)!.label;
export const transactionTypeLabel = (type: TransactionType) => (type === 'income' ? 'Income' : 'Expense');
export const calculationModeLabel = (mode: CalculationMode) => (mode === 'manual' ? 'Manual' : 'Automatic');

/** Same role as Dart's FormatException: a user-facing validation error. */
export class BudgetError extends Error {}

export const cleanError = (error: unknown): string =>
  error instanceof BudgetError ? error.message : 'Please check the form and try again.';

let idSequence = 0;
export const newId = (prefix: string): string => {
  idSequence = (idSequence + 1) % 0x7fffffff;
  return `${prefix}-${(Date.now() * 1000).toString(36)}-${idSequence.toString(36)}`;
};

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  creditLimit: number;
  statementDay: number | null;
  dueDay: number | null;
  color: string;
  icon: string;
  hiddenFromTotal: boolean;
  deletedAt: string | null;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
  isDefault: boolean;
  deletedAt: string | null;
}

export interface TransactionRecord {
  id: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  note: string;
  sourceType: string;
  sourceId: string | null;
  deletedAt: string | null;
}

export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note: string;
  deletedAt: string | null;
}

export interface Budget {
  id: string;
  categoryId: string;
  limitAmount: number;
  /** YYYY-MM */
  periodMonth: string;
  deletedAt: string | null;
}

export interface PaylaterPlan {
  id: string;
  accountId: string;
  itemName: string;
  totalPrice: number;
  tenorMonths: number;
  mode: CalculationMode;
  interestPercent: number | null;
  monthlyInstallment: number;
  startDate: string;
  status: string;
  deletedAt: string | null;
}

export interface PaylaterInstallment {
  id: string;
  planId: string;
  installmentNo: number;
  amount: number;
  dueDate: string;
  status: PaymentStatus;
  paidAt: string | null;
  paymentAccountId: string | null;
  transactionId: string | null;
  deletedAt: string | null;
}

// ---- JSON helpers (lenient, like the Dart fromJson factories) ----

type Json = Record<string, unknown>;

/** Dart's '$value' string interpolation: null/undefined become "null". */
export const str = (value: unknown): string => (value === null || value === undefined ? 'null' : String(value));
const strOr = (value: unknown, fallback: string) => (value === null || value === undefined ? fallback : String(value));
const num = (value: unknown): number => {
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};
const int = (value: unknown): number => {
  if (typeof value === 'number') return Math.trunc(value);
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};
const nullableInt = (value: unknown) => (value === null || value === undefined ? null : int(value));
const nullableString = (value: unknown) => (typeof value === 'string' ? value : null);
const timestamp = (value: unknown) =>
  value === null || value === undefined ? null : typeof value === 'string' ? value : localTimestamp();
const dateKey = (value: unknown): string => {
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(
        parsed.getDate(),
      ).padStart(2, '0')}`;
    }
  }
  return todayKey();
};
const accountType = (value: unknown): AccountType =>
  ACCOUNT_TYPES.some((item) => item.value === value) ? (value as AccountType) : 'cash';
const txType = (value: unknown): TransactionType => (value === 'income' ? 'income' : 'expense');

export const accountFromJson = (json: Json): Account => ({
  id: str(json.id),
  name: strOr(json.name, 'Account'),
  type: accountType(json.type),
  openingBalance: num(json.opening_balance),
  creditLimit: num(json.credit_limit),
  statementDay: nullableInt(json.statement_day),
  dueDay: nullableInt(json.due_day),
  color: strOr(json.color, '#2563EB'),
  icon: strOr(json.icon, 'wallet'),
  hiddenFromTotal: json.is_hidden_from_total === true,
  deletedAt: timestamp(json.deleted_at),
});
export const accountToJson = (item: Account) => ({
  id: item.id,
  name: item.name,
  type: item.type,
  opening_balance: item.openingBalance,
  credit_limit: item.creditLimit,
  statement_day: item.statementDay,
  due_day: item.dueDay,
  color: item.color,
  icon: item.icon,
  is_hidden_from_total: item.hiddenFromTotal,
  deleted_at: item.deletedAt,
});

export const categoryFromJson = (json: Json): Category => ({
  id: str(json.id),
  name: strOr(json.name, 'Category'),
  type: txType(json.type),
  icon: strOr(json.icon, 'circle'),
  isDefault: json.is_default === true,
  deletedAt: timestamp(json.deleted_at),
});
export const categoryToJson = (item: Category) => ({
  id: item.id,
  name: item.name,
  type: item.type,
  icon: item.icon,
  is_default: item.isDefault,
  deleted_at: item.deletedAt,
});

export const transactionFromJson = (json: Json): TransactionRecord => ({
  id: str(json.id),
  accountId: str(json.account_id),
  categoryId: str(json.category_id),
  type: txType(json.tx_type),
  amount: num(json.amount),
  date: dateKey(json.tx_date),
  note: strOr(json.note, ''),
  sourceType: strOr(json.source_type, 'manual'),
  sourceId: nullableString(json.source_id),
  deletedAt: timestamp(json.deleted_at),
});
export const transactionToJson = (item: TransactionRecord) => ({
  id: item.id,
  account_id: item.accountId,
  category_id: item.categoryId,
  tx_type: item.type,
  amount: item.amount,
  tx_date: item.date,
  note: item.note ? item.note : null,
  source_type: item.sourceType,
  source_id: item.sourceId,
  deleted_at: item.deletedAt,
});

export const transferFromJson = (json: Json): Transfer => ({
  id: str(json.id),
  fromAccountId: str(json.from_account_id),
  toAccountId: str(json.to_account_id),
  amount: num(json.amount),
  date: dateKey(json.tx_date),
  note: strOr(json.note, ''),
  deletedAt: timestamp(json.deleted_at),
});
export const transferToJson = (item: Transfer) => ({
  id: item.id,
  from_account_id: item.fromAccountId,
  to_account_id: item.toAccountId,
  amount: item.amount,
  tx_date: item.date,
  note: item.note ? item.note : null,
  deleted_at: item.deletedAt,
});

export const budgetFromJson = (json: Json): Budget => ({
  id: str(json.id),
  categoryId: str(json.category_id),
  limitAmount: num(json.limit_amount),
  periodMonth: str(json.period_month),
  deletedAt: timestamp(json.deleted_at),
});
export const budgetToJson = (item: Budget) => ({
  id: item.id,
  category_id: item.categoryId,
  limit_amount: item.limitAmount,
  period_month: item.periodMonth,
  deleted_at: item.deletedAt,
});

export const planFromJson = (json: Json): PaylaterPlan => ({
  id: str(json.id),
  accountId: str(json.account_id),
  itemName: strOr(json.item_name, 'Purchase'),
  totalPrice: num(json.total_price),
  tenorMonths: int(json.tenor_months),
  mode: json.calculation_mode === 'manual' ? 'manual' : 'auto',
  interestPercent: json.interest_percent === null || json.interest_percent === undefined ? null : num(json.interest_percent),
  monthlyInstallment: num(json.monthly_installment),
  startDate: dateKey(json.start_date),
  status: strOr(json.status, 'active'),
  deletedAt: timestamp(json.deleted_at),
});
export const planToJson = (item: PaylaterPlan) => ({
  id: item.id,
  account_id: item.accountId,
  item_name: item.itemName,
  total_price: item.totalPrice,
  tenor_months: item.tenorMonths,
  calculation_mode: item.mode,
  interest_percent: item.interestPercent,
  monthly_installment: item.monthlyInstallment,
  start_date: item.startDate,
  status: item.status,
  deleted_at: item.deletedAt,
});

export const installmentFromJson = (json: Json): PaylaterInstallment => ({
  id: str(json.id),
  planId: str(json.paylater_plan_id),
  installmentNo: int(json.installment_no),
  amount: num(json.amount),
  dueDate: dateKey(json.due_date),
  status: json.payment_status === 'paid' ? 'paid' : 'unpaid',
  paidAt: timestamp(json.paid_at),
  paymentAccountId: nullableString(json.payment_account_id),
  transactionId: nullableString(json.transaction_id),
  deletedAt: timestamp(json.deleted_at),
});
export const installmentToJson = (item: PaylaterInstallment) => ({
  id: item.id,
  paylater_plan_id: item.planId,
  installment_no: item.installmentNo,
  amount: item.amount,
  due_date: item.dueDate,
  payment_status: item.status,
  paid_at: item.paidAt,
  payment_account_id: item.paymentAccountId,
  transaction_id: item.transactionId,
  deleted_at: item.deletedAt,
});

export const decodeObject = (source: string): Json => {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new BudgetError('The file is not valid JSON.');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new BudgetError('Backup must contain a JSON object.');
  }
  return value as Json;
};
