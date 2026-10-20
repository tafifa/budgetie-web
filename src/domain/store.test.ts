import { beforeEach, describe, expect, it } from 'vitest';
import { addMonthsClamped, formatIdr, money, monthKey, parseAmount, todayKey } from './formatters';
import { Account, BudgetError, TransactionRecord } from './models';
import { BudgetStore, MemoryStorage } from './store';

const account = (overrides: Partial<Account> & Pick<Account, 'id' | 'name' | 'type'>): Account => ({
  openingBalance: 0,
  creditLimit: 0,
  statementDay: null,
  dueDay: null,
  color: '#2563EB',
  icon: 'wallet',
  hiddenFromTotal: false,
  deletedAt: null,
  ...overrides,
});

const tx = (overrides: Partial<TransactionRecord> & Pick<TransactionRecord, 'id' | 'accountId' | 'categoryId' | 'type' | 'amount'>): TransactionRecord => ({
  date: todayKey(),
  note: '',
  sourceType: 'manual',
  sourceId: null,
  deletedAt: null,
  ...overrides,
});

describe('BudgetStore financial invariants (ported from store_test.dart)', () => {
  let storage: MemoryStorage;
  let store: BudgetStore;

  beforeEach(() => {
    storage = new MemoryStorage();
    store = new BudgetStore(storage);
    store.load();
  });

  it('balance integrates opening balance, income, expense, and transfers', () => {
    const cash = store.accounts[0];
    const bank = account({ id: 'acc-bank', name: 'BCA', type: 'bank', openingBalance: 1_000_000 });
    store.addAccount(bank);
    const salary = store.categories.find((c) => c.type === 'income')!;
    const food = store.categories.find((c) => c.type === 'expense')!;

    store.addTransaction(tx({ id: 'tx-1', accountId: cash.id, categoryId: salary.id, type: 'income', amount: 500_000 }));
    store.addTransaction(tx({ id: 'tx-2', accountId: cash.id, categoryId: food.id, type: 'expense', amount: 100_000 }));
    store.addTransfer({ id: 'tr-1', fromAccountId: bank.id, toAccountId: cash.id, amount: 200_000, date: todayKey(), note: '', deletedAt: null });

    expect(store.balanceFor(cash)).toBe(600_000);
    expect(store.balanceFor(bank)).toBe(800_000);
  });

  it('transfers do not alter income or expense metrics', () => {
    const month = monthKey();
    const income = store.incomeForMonth(month);
    const expense = store.expenseForMonth(month);
    store.addAccount(account({ id: 'acc-1', name: 'Bank A', type: 'bank', openingBalance: 500_000 }));
    store.addAccount(account({ id: 'acc-2', name: 'GoPay', type: 'ewallet', openingBalance: 100_000 }));
    store.addTransfer({ id: 'tr', fromAccountId: 'acc-1', toAccountId: 'acc-2', amount: 50_000, date: todayKey(), note: '', deletedAt: null });
    expect(store.incomeForMonth(month)).toBe(income);
    expect(store.expenseForMonth(month)).toBe(expense);
  });

  it('budget spending only aggregates active expenses for the matching category and month', () => {
    const now = todayKey();
    const prev = addMonthsClamped(`${monthKey()}-15`, -1);
    const cash = store.accounts[0];
    const food = store.categories.find((c) => c.name === 'Food')!;
    const bills = store.categories.find((c) => c.name === 'Bills')!;
    store.addTransaction(tx({ id: 'a', accountId: cash.id, categoryId: food.id, type: 'expense', amount: 150_000, date: now }));
    store.addTransaction(tx({ id: 'b', accountId: cash.id, categoryId: food.id, type: 'expense', amount: 250_000, date: prev }));
    store.addTransaction(tx({ id: 'c', accountId: cash.id, categoryId: bills.id, type: 'expense', amount: 300_000, date: now }));
    expect(store.spendingFor(food.id, monthKey(now))).toBe(150_000);
    expect(store.spendingFor(food.id, monthKey(prev))).toBe(250_000);
    expect(store.spendingFor(bills.id, monthKey(now))).toBe(300_000);
  });

  it('paying an installment creates exactly one linked expense and marks it paid', () => {
    store.addAccount(account({ id: 'acc-bank', name: 'Bank', type: 'bank', openingBalance: 2_000_000 }));
    store.addAccount(account({ id: 'acc-pl', name: 'SPaylater', type: 'paylater' }));
    store.addPlan({ accountId: 'acc-pl', itemName: 'Smartphone', totalPrice: 1_200_000, tenorMonths: 3, mode: 'manual', monthlyInstallment: 400_000, startDate: todayKey() });

    const before = store.transactions.length;
    const first = store.activeInstallments.find((i) => i.installmentNo === 1)!;
    expect(first.status).toBe('unpaid');
    store.payInstallment(first.id, 'acc-bank');

    expect(first.status).toBe('paid');
    expect(first.paymentAccountId).toBe('acc-bank');
    expect(first.transactionId).not.toBeNull();
    expect(store.transactions.length).toBe(before + 1);
    const linked = store.transactions.find((t) => t.id === first.transactionId)!;
    expect(linked).toMatchObject({ sourceType: 'paylater_installment', sourceId: first.id, type: 'expense', amount: 400_000, accountId: 'acc-bank' });
    expect(store.balanceFor(store.account('acc-bank')!)).toBe(1_600_000);

    store.payInstallment(first.id, 'acc-bank');
    expect(store.transactions.length).toBe(before + 1);
  });

  it('automatic mode: final installment absorbs the rounding remainder', () => {
    store.addAccount(account({ id: 'acc-pl-2', name: 'GoPayLater', type: 'paylater' }));
    store.addPlan({ accountId: 'acc-pl-2', itemName: 'Headphones', totalPrice: 100_000, tenorMonths: 3, mode: 'auto', monthlyInstallment: 33_333.33, startDate: todayKey() });
    const plan = store.activePlans.find((p) => p.itemName === 'Headphones')!;
    const items = store.activeInstallments.filter((i) => i.planId === plan.id);
    expect(items.map((i) => i.amount)).toEqual([33_333.33, 33_333.33, 33_333.34]);
    expect(money(items.reduce((sum, i) => sum + i.amount, 0))).toBe(100_000);
  });

  it('archiving keeps history via deletedAt', () => {
    const cash = store.accounts[0];
    const food = store.categories.find((c) => c.name === 'Food')!;
    store.addTransaction(tx({ id: 'tx-arch', accountId: cash.id, categoryId: food.id, type: 'expense', amount: 75_000 }));
    expect(store.activeTransactions.some((t) => t.id === 'tx-arch')).toBe(true);
    store.archiveTransaction('tx-arch');
    expect(store.activeTransactions.some((t) => t.id === 'tx-arch')).toBe(false);
    expect(store.transactions.find((t) => t.id === 'tx-arch')!.deletedAt).not.toBeNull();
  });

  it('invalid imports throw and leave the dataset untouched', () => {
    const count = store.accounts.length;
    expect(() => store.importJson('invalid json string {')).toThrow(BudgetError);
    expect(store.accounts.length).toBe(count);
    expect(() => store.importJson('{"schema_version": 1, "data": {"accounts": "not-a-list"}}')).toThrow(BudgetError);
    expect(store.accounts.length).toBe(count);
  });

  it('isFirstRun identifies an untouched seed dataset', () => {
    expect(store.isFirstRun).toBe(true);
    const food = store.categories.find((c) => c.name === 'Food')!;
    store.addTransaction(tx({ id: 'fr', accountId: store.accounts[0].id, categoryId: food.id, type: 'expense', amount: 25_000 }));
    expect(store.isFirstRun).toBe(false);
  });

  it('linked paylater transactions cannot be edited or archived directly', () => {
    store.addAccount(account({ id: 'acc-b', name: 'Bank', type: 'bank', openingBalance: 1_000_000 }));
    store.addAccount(account({ id: 'acc-p', name: 'Paylater', type: 'paylater' }));
    store.addPlan({ accountId: 'acc-p', itemName: 'Watch', totalPrice: 300_000, tenorMonths: 1, mode: 'manual', monthlyInstallment: 300_000, startDate: todayKey() });
    const inst = store.activeInstallments[0];
    store.payInstallment(inst.id, 'acc-b');
    const linked = store.transactions.find((t) => t.sourceId === inst.id)!;
    expect(() => store.archiveTransaction(linked.id)).toThrow(BudgetError);
    expect(() => store.updateTransaction({ ...linked, amount: 500_000, sourceType: 'manual' })).toThrow(BudgetError);
  });
});

describe('Data compatibility with the Dart app', () => {
  // Exactly the shape BudgetStore.exportJson() in the Dart app writes to localStorage.
  const dartDataset = {
    schema_version: 1,
    exported_at: '2026-10-18T13:00:00.000Z',
    app_version: '0.1.0',
    data: {
      accounts: [
        { id: 'account-abc-1', name: 'Cash wallet', type: 'cash', opening_balance: 150000.0, credit_limit: 0.0, statement_day: null, due_day: null, color: '#2563EB', icon: 'wallet', is_hidden_from_total: false, deleted_at: null },
        { id: 'account-abc-2', name: 'SPaylater', type: 'paylater', opening_balance: 0, credit_limit: 5000000, statement_day: 5, due_day: 25, color: '#ee4d2d', icon: 'wallet', is_hidden_from_total: false, deleted_at: null },
        { id: 'account-abc-3', name: 'Old bank', type: 'bank', opening_balance: 10, credit_limit: 0, statement_day: null, due_day: null, color: '#000000', icon: 'wallet', is_hidden_from_total: true, deleted_at: '2026-09-01T10:11:12.345' },
      ],
      categories: [
        { id: 'category-1', name: 'Salary', type: 'income', icon: 'briefcase', is_default: true, deleted_at: null },
        { id: 'category-2', name: 'Food', type: 'expense', icon: 'utensils', is_default: true, deleted_at: null },
        { id: 'category-3', name: 'Paylater payment', type: 'expense', icon: 'credit-card', is_default: false, deleted_at: null },
      ],
      transactions: [
        { id: 'transaction-1', account_id: 'account-abc-1', category_id: 'category-1', tx_type: 'income', amount: 1000000, tx_date: '2026-10-01', note: null, source_type: 'manual', source_id: null, deleted_at: null },
        { id: 'transaction-2', account_id: 'account-abc-1', category_id: 'category-2', tx_type: 'expense', amount: 25500.5, tx_date: '2026-10-03', note: 'Lunch', source_type: 'manual', source_id: null, deleted_at: null },
        { id: 'transaction-3', account_id: 'account-abc-1', category_id: 'category-3', tx_type: 'expense', amount: 400000, tx_date: '2026-10-10', note: 'Phone • installment 1', source_type: 'paylater_installment', source_id: 'installment-1', deleted_at: null },
      ],
      transfers: [
        { id: 'transfer-1', from_account_id: 'account-abc-1', to_account_id: 'account-abc-3', amount: 5000, tx_date: '2026-08-01', note: null, deleted_at: null },
      ],
      budgets: [{ id: 'budget-1', category_id: 'category-2', limit_amount: 500000, period_month: '2026-10', deleted_at: null }],
      paylater_plans: [
        { id: 'plan-1', account_id: 'account-abc-2', item_name: 'Phone', total_price: 1200000, tenor_months: 3, calculation_mode: 'manual', interest_percent: null, monthly_installment: 400000, start_date: '2026-10-10', status: 'active', deleted_at: null },
      ],
      paylater_installments: [
        { id: 'installment-1', paylater_plan_id: 'plan-1', installment_no: 1, amount: 400000, due_date: '2026-10-10', payment_status: 'paid', paid_at: '2026-10-10T09:00:00.000', payment_account_id: 'account-abc-1', transaction_id: 'transaction-3', deleted_at: null },
        { id: 'installment-2', paylater_plan_id: 'plan-1', installment_no: 2, amount: 400000, due_date: '2026-11-10', payment_status: 'unpaid', paid_at: null, payment_account_id: null, transaction_id: null, deleted_at: null },
      ],
    },
  };

  it('reads a dataset written by the Dart app without seeding over it', () => {
    const storage = new MemoryStorage();
    storage.setItem(BudgetStore.storageKey, JSON.stringify(dartDataset));
    const store = new BudgetStore(storage);
    store.load();
    expect(store.accounts).toHaveLength(3);
    expect(store.activeAccounts).toHaveLength(2);
    expect(store.transactions).toHaveLength(3);
    expect(store.balanceFor(store.account('account-abc-1')!)).toBe(money(150000 + 1000000 - 25500.5 - 400000 - 5000));
    expect(store.totalOutstandingForAccount('account-abc-2')).toBe(400000);
    expect(storage.getItem(BudgetStore.unreadableKey)).toBeNull();
  });

  it('round-trips every record unchanged', () => {
    const storage = new MemoryStorage();
    storage.setItem(BudgetStore.storageKey, JSON.stringify(dartDataset));
    const store = new BudgetStore(storage);
    store.load();
    store.save();
    const saved = JSON.parse(storage.getItem(BudgetStore.storageKey)!);
    expect(saved.schema_version).toBe(1);
    expect(saved.data).toEqual(dartDataset.data);
  });

  it('keeps unreadable data aside instead of silently overwriting it', () => {
    const storage = new MemoryStorage();
    storage.setItem(BudgetStore.storageKey, '{"broken":');
    const store = new BudgetStore(storage);
    store.load();
    expect(storage.getItem(BudgetStore.unreadableKey)).toBe('{"broken":');
    expect(store.isFirstRun).toBe(true);
  });

  it('accepts its own export as an import', () => {
    const a = new BudgetStore(new MemoryStorage());
    a.load();
    const b = new BudgetStore(new MemoryStorage());
    b.load();
    expect(b.previewImport(a.exportJson()).total).toBe(7);
    b.importJson(a.exportJson());
    expect(b.accounts[0].id).toBe(a.accounts[0].id);
  });
});

describe('Budget upsert', () => {
  it('moving a budget to another month does not leave a duplicate behind', () => {
    const store = new BudgetStore(new MemoryStorage());
    store.load();
    const food = store.categories.find((c) => c.name === 'Food')!;
    store.upsertBudget({ categoryId: food.id, limitAmount: 100, periodMonth: '2026-10' });
    const id = store.activeBudgets[0].id;
    store.upsertBudget({ categoryId: food.id, limitAmount: 200, periodMonth: '2026-11' }, id);
    expect(store.activeBudgets).toHaveLength(1);
    expect(store.activeBudgets[0]).toMatchObject({ id, periodMonth: '2026-11', limitAmount: 200 });
    expect(new Set(store.budgets.map((b) => b.id)).size).toBe(store.budgets.length);
  });
});

describe('formatters', () => {
  it('formats and parses IDR like the Dart helpers', () => {
    expect(formatIdr(1250000)).toBe('Rp 1.250.000');
    expect(formatIdr(-999.6)).toBe('-Rp 1.000');
    expect(formatIdr(0)).toBe('Rp 0');
    expect(parseAmount('1.250.000')).toBe(1250000);
    expect(parseAmount('1,250,000')).toBe(1250000);
    expect(parseAmount('1250000,50')).toBe(1250000.5);
    expect(parseAmount('1.250.000,75')).toBe(1250000.75);
    expect(parseAmount('1,250,000.75')).toBe(1250000.75);
    expect(parseAmount('2,5')).toBe(2.5);
    expect(parseAmount('abc')).toBe(0);
  });

  it('clamps month arithmetic to the month length', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamped('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonthsClamped('2026-03-15', -3)).toBe('2025-12-15');
  });
});
