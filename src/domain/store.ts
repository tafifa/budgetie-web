/**
 * BudgetStore: in-memory state + business rules, persisted synchronously to localStorage.
 * Ported from the Dart `BudgetStore`; storage key and JSON envelope are unchanged.
 */
import { addMonthsClamped, localTimestamp, money, monthKey, todayKey } from './formatters';
import {
  Account,
  Budget,
  BudgetError,
  CalculationMode,
  Category,
  PaylaterInstallment,
  PaylaterPlan,
  Transfer,
  TransactionRecord,
  accountFromJson,
  accountToJson,
  budgetFromJson,
  budgetToJson,
  categoryFromJson,
  categoryToJson,
  decodeObject,
  installmentFromJson,
  installmentToJson,
  newId,
  planFromJson,
  planToJson,
  str,
  transactionFromJson,
  transactionToJson,
  transferFromJson,
  transferToJson,
} from './models';

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class MemoryStorage implements StorageBackend {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

export interface ImportPreview {
  accounts: number;
  categories: number;
  transactions: number;
  transfers: number;
  budgets: number;
  plans: number;
  installments: number;
  total: number;
}

const COLLECTIONS = [
  'accounts',
  'categories',
  'transactions',
  'transfers',
  'budgets',
  'paylater_plans',
  'paylater_installments',
] as const;

type Json = Record<string, unknown>;

const listOf = (data: Json, key: string): Json[] => {
  const value = data[key];
  if (!Array.isArray(value)) throw new BudgetError(`Missing or invalid ${key} collection.`);
  if (value.some((item) => item === null || typeof item !== 'object' || Array.isArray(item))) {
    throw new BudgetError(`Collection ${key} contains an invalid record.`);
  }
  return value as Json[];
};

export class BudgetStore {
  static readonly schemaVersion = 1;
  static readonly appVersion = '0.2.0';
  static readonly storageKey = 'budgetie.dataset.v1';
  static readonly backupKey = 'budgetie.last-backup.v1';
  /** Raw data that could not be read, kept instead of being silently overwritten. */
  static readonly unreadableKey = 'budgetie.unreadable.v1';

  accounts: Account[] = [];
  categories: Category[] = [];
  transactions: TransactionRecord[] = [];
  transfers: Transfer[] = [];
  budgets: Budget[] = [];
  plans: PaylaterPlan[] = [];
  installments: PaylaterInstallment[] = [];

  private listeners = new Set<() => void>();
  /** Bumped on every save so React can re-render via useSyncExternalStore. */
  version = 0;

  constructor(private readonly storage: StorageBackend) {}

  // ---- subscription ----

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = () => this.version;

  // ---- persistence ----

  load() {
    const raw = this.storage.getItem(BudgetStore.storageKey);
    if (raw === null || raw.trim() === '') {
      this.seed();
      this.save();
      return;
    }
    try {
      this.replaceFromObject(decodeObject(raw));
    } catch {
      this.storage.setItem(BudgetStore.unreadableKey, raw);
      this.seed();
      this.save();
    }
  }

  save() {
    this.storage.setItem(BudgetStore.storageKey, this.exportJson());
    this.version++;
    this.listeners.forEach((listener) => listener());
  }

  exportJson(): string {
    return JSON.stringify({
      schema_version: BudgetStore.schemaVersion,
      exported_at: new Date().toISOString(),
      app_version: BudgetStore.appVersion,
      data: {
        accounts: this.accounts.map(accountToJson),
        categories: this.categories.map(categoryToJson),
        transactions: this.transactions.map(transactionToJson),
        transfers: this.transfers.map(transferToJson),
        budgets: this.budgets.map(budgetToJson),
        paylater_plans: this.plans.map(planToJson),
        paylater_installments: this.installments.map(installmentToJson),
      },
    });
  }

  previewImport(source: string): ImportPreview {
    const object = decodeObject(source);
    this.validateEnvelope(object);
    const data = object.data as Json;
    const counts = {
      accounts: listOf(data, 'accounts').length,
      categories: listOf(data, 'categories').length,
      transactions: listOf(data, 'transactions').length,
      transfers: listOf(data, 'transfers').length,
      budgets: listOf(data, 'budgets').length,
      plans: listOf(data, 'paylater_plans').length,
      installments: listOf(data, 'paylater_installments').length,
    };
    return { ...counts, total: Object.values(counts).reduce((sum, value) => sum + value, 0) };
  }

  importJson(source: string) {
    const object = decodeObject(source);
    this.validateEnvelope(object);
    this.storage.setItem(BudgetStore.backupKey, this.exportJson());
    this.replaceFromObject(object);
    this.save();
  }

  private validateEnvelope(object: Json) {
    if (object.schema_version !== BudgetStore.schemaVersion) {
      throw new BudgetError('Unsupported backup schema version.');
    }
    const data = object.data;
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new BudgetError('Backup data section is invalid.');
    }
    for (const key of COLLECTIONS) {
      if (!Array.isArray((data as Json)[key])) throw new BudgetError(`Backup collection ${key} is invalid.`);
    }
    const d = data as Json;
    const accountIds = new Set(listOf(d, 'accounts').map((item) => str(item.id)));
    const categoryIds = new Set(listOf(d, 'categories').map((item) => str(item.id)));
    const planIds = new Set(listOf(d, 'paylater_plans').map((item) => str(item.id)));
    for (const item of listOf(d, 'transactions')) {
      if (!accountIds.has(str(item.account_id)) || !categoryIds.has(str(item.category_id))) {
        throw new BudgetError('A transaction points to missing data.');
      }
    }
    for (const item of listOf(d, 'transfers')) {
      if (!accountIds.has(str(item.from_account_id)) || !accountIds.has(str(item.to_account_id))) {
        throw new BudgetError('A transfer points to missing data.');
      }
    }
    for (const item of listOf(d, 'budgets')) {
      if (!categoryIds.has(str(item.category_id))) throw new BudgetError('A budget points to missing data.');
    }
    for (const item of listOf(d, 'paylater_plans')) {
      if (!accountIds.has(str(item.account_id))) throw new BudgetError('A plan points to missing account.');
    }
    for (const item of listOf(d, 'paylater_installments')) {
      if (!planIds.has(str(item.paylater_plan_id))) throw new BudgetError('An installment points to missing plan.');
    }
  }

  private replaceFromObject(object: Json) {
    this.validateEnvelope(object);
    const data = object.data as Json;
    this.accounts = listOf(data, 'accounts').map(accountFromJson);
    this.categories = listOf(data, 'categories').map(categoryFromJson);
    this.transactions = listOf(data, 'transactions').map(transactionFromJson);
    this.transfers = listOf(data, 'transfers').map(transferFromJson);
    this.budgets = listOf(data, 'budgets').map(budgetFromJson);
    this.plans = listOf(data, 'paylater_plans').map(planFromJson);
    this.installments = listOf(data, 'paylater_installments').map(installmentFromJson);
  }

  private seed() {
    const category = (name: string, type: Category['type'], icon: string): Category => ({
      id: newId('category'),
      name,
      type,
      icon,
      isDefault: true,
      deletedAt: null,
    });
    this.accounts = [
      {
        id: newId('account'),
        name: 'Cash wallet',
        type: 'cash',
        openingBalance: 0,
        creditLimit: 0,
        statementDay: null,
        dueDay: null,
        color: '#2563EB',
        icon: 'wallet',
        hiddenFromTotal: false,
        deletedAt: null,
      },
    ];
    this.categories = [
      category('Salary', 'income', 'briefcase'),
      category('Food', 'expense', 'utensils'),
      category('Transport', 'expense', 'car'),
      category('Shopping', 'expense', 'bag'),
      category('Bills', 'expense', 'receipt'),
      category('Health', 'expense', 'heart'),
    ];
    this.transactions = [];
    this.transfers = [];
    this.budgets = [];
    this.plans = [];
    this.installments = [];
  }

  // ---- queries ----

  get activeAccounts() {
    return this.accounts.filter((item) => item.deletedAt === null);
  }
  get activeCategories() {
    return this.categories.filter((item) => item.deletedAt === null);
  }
  get activeTransactions() {
    return this.transactions.filter((item) => item.deletedAt === null);
  }
  get activeTransfers() {
    return this.transfers.filter((item) => item.deletedAt === null);
  }
  get activeBudgets() {
    return this.budgets.filter((item) => item.deletedAt === null);
  }
  get activePlans() {
    return this.plans.filter((item) => item.deletedAt === null);
  }
  get activeInstallments() {
    return this.installments.filter((item) => item.deletedAt === null);
  }
  /** Bank, e-wallet and cash accounts: the ones money can be spent from. */
  get liquidAccounts() {
    return this.activeAccounts.filter((item) => item.type !== 'paylater');
  }

  account(id: string) {
    return this.accounts.find((item) => item.id === id && item.deletedAt === null);
  }
  accountById(id: string) {
    return this.accounts.find((item) => item.id === id);
  }
  category(id: string) {
    return this.categories.find((item) => item.id === id && item.deletedAt === null);
  }
  plan(id: string) {
    return this.plans.find((item) => item.id === id && item.deletedAt === null);
  }

  get isFirstRun() {
    return (
      this.transactions.length === 0 &&
      this.transfers.length === 0 &&
      this.budgets.length === 0 &&
      this.plans.length === 0 &&
      this.accounts.length === 1 &&
      this.accounts[0].openingBalance === 0
    );
  }

  balanceFor(account: Account) {
    let balance = account.openingBalance;
    for (const item of this.activeTransactions) {
      if (item.accountId === account.id) balance += item.type === 'income' ? item.amount : -item.amount;
    }
    for (const transfer of this.activeTransfers) {
      if (transfer.fromAccountId === account.id) balance -= transfer.amount;
      if (transfer.toAccountId === account.id) balance += transfer.amount;
    }
    return money(balance);
  }

  get totalAssetBalance() {
    return this.activeAccounts
      .filter((item) => item.type !== 'paylater' && !item.hiddenFromTotal)
      .reduce((total, account) => total + this.balanceFor(account), 0);
  }

  get totalPaylaterOutstanding() {
    return this.activeInstallments
      .filter((item) => item.status === 'unpaid')
      .reduce((total, item) => total + item.amount, 0);
  }

  totalOutstandingForAccount(accountId: string) {
    const planIds = new Set(this.activePlans.filter((plan) => plan.accountId === accountId).map((plan) => plan.id));
    return money(
      this.activeInstallments
        .filter((item) => item.status === 'unpaid' && planIds.has(item.planId))
        .reduce((total, item) => total + item.amount, 0),
    );
  }

  spendingFor(categoryId: string, month: string) {
    return this.activeTransactions
      .filter((item) => item.categoryId === categoryId && item.type === 'expense' && item.date.startsWith(month))
      .reduce((total, item) => total + item.amount, 0);
  }

  incomeForMonth(month: string) {
    return this.activeTransactions
      .filter((item) => item.type === 'income' && item.date.startsWith(month))
      .reduce((total, item) => total + item.amount, 0);
  }

  expenseForMonth(month: string) {
    return this.activeTransactions
      .filter((item) => item.type === 'expense' && item.date.startsWith(month))
      .reduce((total, item) => total + item.amount, 0);
  }

  /** Unpaid installments due before today. */
  isOverdue(installment: PaylaterInstallment) {
    return installment.status === 'unpaid' && installment.dueDate < todayKey();
  }

  // ---- mutations ----

  addAccount(account: Account) {
    this.accounts.push(account);
    this.save();
  }

  updateAccount(id: string, changes: Partial<Omit<Account, 'id'>>) {
    const item = this.account(id);
    if (!item) return;
    Object.assign(item, changes);
    this.save();
  }

  archiveAccount(id: string) {
    const item = this.account(id);
    if (!item) return;
    item.deletedAt = localTimestamp();
    this.save();
  }

  toggleAccountVisibility(id: string) {
    const item = this.account(id);
    if (!item) return;
    item.hiddenFromTotal = !item.hiddenFromTotal;
    this.save();
  }

  addCategory(category: Category) {
    this.categories.push(category);
    this.save();
  }

  private validateTransaction(record: TransactionRecord) {
    if (record.amount <= 0) throw new BudgetError('Amount must be greater than zero.');
    const category = this.category(record.categoryId);
    if (!category || category.type !== record.type) {
      throw new BudgetError('Category type does not match transaction type.');
    }
  }

  addTransaction(record: TransactionRecord) {
    this.validateTransaction(record);
    if (!this.account(record.accountId)) throw new BudgetError('Choose an active account.');
    this.transactions.push(record);
    this.save();
  }

  updateTransaction(replacement: TransactionRecord) {
    const index = this.transactions.findIndex((item) => item.id === replacement.id);
    if (index === -1) return;
    if (this.transactions[index].sourceType === 'paylater_installment') {
      throw new BudgetError('Linked paylater transactions cannot be edited directly.');
    }
    this.validateTransaction(replacement);
    this.transactions[index] = replacement;
    this.save();
  }

  archiveTransaction(id: string) {
    const item = this.transactions.find((record) => record.id === id && record.deletedAt === null);
    if (!item) return;
    if (item.sourceType === 'paylater_installment') {
      throw new BudgetError('Linked paylater transactions cannot be archived directly.');
    }
    item.deletedAt = localTimestamp();
    this.save();
  }

  addTransfer(transfer: Transfer) {
    if (transfer.amount <= 0 || transfer.fromAccountId === transfer.toAccountId) {
      throw new BudgetError('Choose two different accounts and a positive amount.');
    }
    if (!this.account(transfer.fromAccountId) || !this.account(transfer.toAccountId)) {
      throw new BudgetError('Choose active accounts.');
    }
    this.transfers.push(transfer);
    this.save();
  }

  archiveTransfer(id: string) {
    const item = this.transfers.find((transfer) => transfer.id === id && transfer.deletedAt === null);
    if (!item) return;
    item.deletedAt = localTimestamp();
    this.save();
  }

  /**
   * Creates or updates the budget for (category, month). There is at most one active budget per
   * category per month. When `editingId` points to a budget that moved to another category/month,
   * that old budget is archived instead of leaving a stale duplicate.
   */
  upsertBudget(input: { categoryId: string; limitAmount: number; periodMonth: string }, editingId?: string) {
    if (input.limitAmount <= 0) throw new BudgetError('Budget limit must be greater than zero.');
    const target = this.activeBudgets.find(
      (item) => item.categoryId === input.categoryId && item.periodMonth === input.periodMonth,
    );
    const editing = editingId ? this.activeBudgets.find((item) => item.id === editingId) : undefined;
    if (target) {
      target.limitAmount = input.limitAmount;
      if (editing && editing !== target) editing.deletedAt = localTimestamp();
    } else if (editing) {
      Object.assign(editing, input);
    } else {
      this.budgets.push({ id: newId('budget'), ...input, deletedAt: null });
    }
    this.save();
  }

  archiveBudget(id: string) {
    const item = this.activeBudgets.find((budget) => budget.id === id);
    if (!item) return;
    item.deletedAt = localTimestamp();
    this.save();
  }

  addPlan(input: {
    accountId: string;
    itemName: string;
    totalPrice: number;
    tenorMonths: number;
    mode: CalculationMode;
    monthlyInstallment: number;
    startDate: string;
    interestPercent?: number | null;
  }) {
    const { accountId, itemName, totalPrice, tenorMonths, mode, monthlyInstallment, startDate } = input;
    if (this.account(accountId)?.type !== 'paylater') throw new BudgetError('Choose a paylater account.');
    if (!itemName.trim() || totalPrice <= 0 || tenorMonths < 1 || monthlyInstallment <= 0) {
      throw new BudgetError('Complete the installment details with positive values.');
    }
    const planId = newId('plan');
    this.plans.push({
      id: planId,
      accountId,
      itemName: itemName.trim(),
      totalPrice: money(totalPrice),
      tenorMonths,
      mode,
      interestPercent: mode === 'auto' ? input.interestPercent ?? null : null,
      monthlyInstallment: money(monthlyInstallment),
      startDate,
      status: 'active',
      deletedAt: null,
    });
    const totalBill =
      mode === 'auto'
        ? money(totalPrice * (1 + (input.interestPercent ?? 0) / 100))
        : money(monthlyInstallment * tenorMonths);
    let allocated = 0;
    for (let number = 1; number <= tenorMonths; number++) {
      const amount = number === tenorMonths ? money(totalBill - allocated) : money(monthlyInstallment);
      allocated += amount;
      this.installments.push({
        id: newId('installment'),
        planId,
        installmentNo: number,
        amount,
        dueDate: addMonthsClamped(startDate, number - 1),
        status: 'unpaid',
        paidAt: null,
        paymentAccountId: null,
        transactionId: null,
        deletedAt: null,
      });
    }
    this.save();
  }

  payInstallment(installmentId: string, paymentAccountId: string) {
    const installment = this.activeInstallments.find((item) => item.id === installmentId);
    if (!installment || installment.status === 'paid') return;
    const payer = this.account(paymentAccountId);
    if (!payer || payer.type === 'paylater') throw new BudgetError('Choose a bank, e-wallet, or cash account.');
    let category = this.activeCategories.find(
      (item) => item.type === 'expense' && item.name.toLowerCase() === 'paylater payment',
    );
    if (!category) {
      category = {
        id: newId('category'),
        name: 'Paylater payment',
        type: 'expense',
        icon: 'credit-card',
        isDefault: false,
        deletedAt: null,
      };
      this.categories.push(category);
    }
    const plan = this.plan(installment.planId);
    const transaction: TransactionRecord = {
      id: newId('transaction'),
      accountId: paymentAccountId,
      categoryId: category.id,
      type: 'expense',
      amount: installment.amount,
      date: todayKey(),
      note: `${plan?.itemName ?? 'Paylater'} • installment ${installment.installmentNo}`,
      sourceType: 'paylater_installment',
      sourceId: installment.id,
      deletedAt: null,
    };
    this.transactions.push(transaction);
    installment.status = 'paid';
    installment.paidAt = localTimestamp();
    installment.paymentAccountId = paymentAccountId;
    installment.transactionId = transaction.id;
    const planInstallments = this.activeInstallments.filter((item) => item.planId === installment.planId);
    if (plan && planInstallments.every((item) => item.status === 'paid')) plan.status = 'completed';
    this.save();
  }

  archivePlan(id: string) {
    const item = this.activePlans.find((plan) => plan.id === id);
    if (!item) return;
    const now = localTimestamp();
    item.deletedAt = now;
    for (const installment of this.installments) {
      if (installment.planId === id && installment.deletedAt === null) installment.deletedAt = now;
    }
    this.save();
  }
}

/** Expense totals for the month in five-day blocks (1-5, 6-10, ..., 31), used by the trend chart. */
export const expenseTotalsByBucket = (store: BudgetStore, month: string): number[] => {
  const [year, monthNumber] = month.split('-').map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  const totals: number[] = [];
  for (let bucket = 0; bucket * 5 + 1 <= days; bucket++) {
    const start = bucket * 5 + 1;
    const end = Math.min(start + 4, days);
    totals.push(
      store.activeTransactions
        .filter((item) => {
          const day = Number(item.date.slice(8, 10));
          return item.type === 'expense' && monthKey(item.date) === month && day >= start && day <= end;
        })
        .reduce((sum, item) => sum + item.amount, 0),
    );
  }
  return totals;
};
