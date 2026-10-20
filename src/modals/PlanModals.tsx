import { IonLabel, IonSegment, IonSegmentButton } from '@ionic/react';
import { useState } from 'react';
import { AmountField, SelectField, TextField } from '../components/common';
import { addMonthsClamped, formatDate, formatIdr, money, monthKey, parseAmount, parseIntStrict, todayKey } from '../domain/formatters';
import { Budget, CalculationMode } from '../domain/models';
import { ImportPreview } from '../domain/store';
import { useBudget } from '../state/store';
import { useUi } from '../state/ui';
import { ModalFrame, SaveCancel, useFormAction } from './ModalFrame';

export const BudgetModal = ({ existing }: { existing?: Budget }) => {
  const store = useBudget();
  const { closeModal, toast } = useUi();
  const { error, run } = useFormAction();
  const expenseCategories = store.activeCategories.filter((item) => item.type === 'expense');

  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? expenseCategories[0]?.id ?? '');
  const [limit, setLimit] = useState(existing ? existing.limitAmount.toFixed(2) : '');
  const [month, setMonth] = useState(existing?.periodMonth ?? monthKey());

  const parsed = parseAmount(limit);
  const isValid = !!categoryId && parsed > 0 && !!month;
  const today = todayKey();
  const months: { value: string; label: string }[] = [];
  for (let offset = 0; offset < 6; offset++) {
    const key = monthKey(addMonthsClamped(today, -offset));
    months.push({ value: key, label: offset === 0 ? `${key} (Current month)` : key });
  }
  for (let offset = 1; offset <= 3; offset++) {
    const key = monthKey(addMonthsClamped(today, offset));
    months.push({ value: key, label: `${key} (Next)` });
  }
  // Keep a budget's own month selectable even when it is outside the default range.
  if (!months.some((option) => option.value === month)) months.push({ value: month, label: month });

  const save = () => {
    if (!isValid) return;
    const ok = run(() => store.upsertBudget({ categoryId, limitAmount: parsed, periodMonth: month }, existing?.id));
    if (ok) {
      toast(existing ? 'Budget updated.' : 'Budget saved.');
      closeModal();
    }
  };

  return (
    <ModalFrame
      title={existing ? 'Edit budget' : 'Set budget'}
      error={error}
      onClose={closeModal}
      onSubmit={save}
      footer={<SaveCancel onCancel={closeModal} onSave={save} disabled={!isValid} />}
    >
      <SelectField
        label="Expense category"
        value={categoryId}
        onChange={setCategoryId}
        options={expenseCategories.map((item) => ({ value: item.id, label: item.name }))}
      />
      <AmountField label="Monthly limit (IDR)" value={limit} onChange={setLimit} hint={parsed > 0 ? `Limit: ${formatIdr(parsed)}` : null} />
      <SelectField label="Month period" value={month} onChange={setMonth} options={months} />
    </ModalFrame>
  );
};

export const PlanModal = () => {
  const store = useBudget();
  const { closeModal, toast } = useUi();
  const { error, run } = useFormAction();
  const paylaterAccounts = store.activeAccounts.filter((item) => item.type === 'paylater');

  const [itemName, setItemName] = useState('');
  const [accountId, setAccountId] = useState(paylaterAccounts[0]?.id ?? '');
  const [mode, setMode] = useState<CalculationMode>('auto');
  const [price, setPrice] = useState('');
  const [tenor, setTenor] = useState('3');
  const [interest, setInterest] = useState('0');
  const [monthly, setMonthly] = useState('');
  const [startDate, setStartDate] = useState(todayKey());

  const auto = mode === 'auto';
  const account = store.account(accountId);
  const parsedPrice = parseAmount(price);
  const parsedTenor = parseIntStrict(tenor) ?? 0;
  const parsedInterest = parseAmount(interest);
  const parsedMonthly = parseAmount(monthly);

  // Same formulas the store uses when it generates the installments.
  let installment = 0;
  let totalBill = 0;
  if (parsedTenor > 0) {
    if (auto && parsedPrice > 0) {
      installment = money((parsedPrice * (1 + parsedInterest / 100)) / parsedTenor);
      totalBill = money(parsedPrice * (1 + parsedInterest / 100));
    } else if (!auto && parsedMonthly > 0) {
      installment = parsedMonthly;
      totalBill = money(parsedMonthly * parsedTenor);
    }
  }
  const exceedsLimit = !!account && account.creditLimit > 0 && store.totalOutstandingForAccount(account.id) + totalBill > account.creditLimit;
  const isValid = !!itemName.trim() && !!accountId && parsedPrice > 0 && parsedTenor >= 1 && (auto || parsedMonthly > 0) && !!startDate;

  const save = () => {
    if (!isValid) return;
    const ok = run(() =>
      store.addPlan({
        accountId,
        itemName,
        totalPrice: parsedPrice,
        tenorMonths: parsedTenor,
        mode,
        monthlyInstallment: installment,
        startDate,
        interestPercent: parsedInterest,
      }),
    );
    if (ok) {
      toast(`Plan "${itemName.trim()}" added.`);
      closeModal();
    }
  };

  return (
    <ModalFrame
      title="Add paylater plan"
      error={error}
      onClose={closeModal}
      onSubmit={save}
      footer={<SaveCancel onCancel={closeModal} onSave={save} disabled={!isValid} />}
    >
      <TextField label="Item or purchase name" value={itemName} onChange={setItemName} placeholder="e.g. New phone" />
      <SelectField
        label="Paylater account"
        value={accountId}
        onChange={setAccountId}
        options={paylaterAccounts.map((item) => ({ value: item.id, label: `${item.name} (Limit: ${formatIdr(item.creditLimit)})` }))}
      />
      <IonSegment value={mode} onIonChange={(event) => setMode(event.detail.value as CalculationMode)}>
        <IonSegmentButton value="auto">
          <IonLabel>Calculate automatically</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="manual">
          <IonLabel>Input manually</IonLabel>
        </IonSegmentButton>
      </IonSegment>
      <AmountField label="Total purchase price (IDR)" value={price} onChange={setPrice} hint={parsedPrice > 0 ? `Price: ${formatIdr(parsedPrice)}` : null} />
      <div className="two-col">
        <TextField label="Tenor (months)" inputMode="numeric" value={tenor} onChange={setTenor} />
        {auto ? (
          <TextField label="Total fee / interest (%)" inputMode="decimal" value={interest} onChange={setInterest} hint="For the entire tenor (e.g. 2.5)" />
        ) : (
          <AmountField label="Monthly installment (IDR)" value={monthly} onChange={setMonthly} />
        )}
      </div>
      <TextField label="First due date" type="date" value={startDate} onChange={setStartDate} />
      {totalBill > 0 && (
        <div className="preview-card">
          <p className="eyebrow">PLAN SUMMARY PREVIEW</p>
          <p>
            <strong>{formatIdr(installment)} / month</strong> for {parsedTenor} month(s)
          </p>
          <small className="muted">Total repayment obligation: {formatIdr(totalBill)}</small>
          {exceedsLimit && account && (
            <p className="danger-text small-text">⚠️ Warning: Total obligation exceeds the available limit on {account.name}.</p>
          )}
        </div>
      )}
    </ModalFrame>
  );
};

export const PayModal = ({ installmentId }: { installmentId: string }) => {
  const store = useBudget();
  const { closeModal, toast } = useUi();
  const { error, run } = useFormAction();
  const installment = store.activeInstallments.find((item) => item.id === installmentId);
  const [accountId, setAccountId] = useState(store.liquidAccounts[0]?.id ?? '');

  const account = store.account(accountId);
  const balance = account ? store.balanceFor(account) : 0;
  const amount = installment?.amount ?? 0;
  const plan = installment ? store.plan(installment.planId) : undefined;
  const isValid = !!installment && !!accountId && installment.status === 'unpaid';

  const save = () => {
    if (!isValid) return;
    const ok = run(() => store.payInstallment(installmentId, accountId));
    if (ok) {
      toast('Installment payment recorded as expense.');
      closeModal();
    }
  };

  return (
    <ModalFrame
      title="Pay installment"
      error={error}
      onClose={closeModal}
      onSubmit={save}
      footer={<SaveCancel onCancel={closeModal} onSave={save} disabled={!isValid} saveLabel="Mark paid" />}
    >
      {installment && (
        <div className="preview-card">
          <p className="eyebrow">INSTALLMENT DETAILS</p>
          <p>
            <strong>{plan?.itemName ?? 'Paylater plan'}</strong> • Installment #{installment.installmentNo}
          </p>
          <p className="muted small-text">Due date: {formatDate(installment.dueDate)}</p>
          <h3 style={{ margin: '4px 0' }}>{formatIdr(amount)}</h3>
          <small className="muted">Paying records exactly one expense transaction linked to this installment.</small>
        </div>
      )}
      <SelectField
        label={account ? `Pay from account (Balance: ${formatIdr(balance)})` : 'Pay from account'}
        value={accountId}
        onChange={setAccountId}
        options={store.liquidAccounts.map((item) => ({ value: item.id, label: item.name }))}
      />
      {account && balance < amount && (
        <p className="danger-text small-text">
          ⚠️ Warning: {account.name} balance ({formatIdr(balance)}) is lower than this installment ({formatIdr(amount)}). Balance will become
          negative.
        </p>
      )}
    </ModalFrame>
  );
};

export const ImportModal = ({ source, preview }: { source: string; preview: ImportPreview }) => {
  const store = useBudget();
  const { closeModal, toast } = useUi();
  const { error, run } = useFormAction();
  const counts: [string, number][] = [
    ['Accounts', preview.accounts],
    ['Categories', preview.categories],
    ['Transactions', preview.transactions],
    ['Transfers', preview.transfers],
    ['Budgets', preview.budgets],
    ['Paylater plans', preview.plans],
    ['Installments', preview.installments],
  ];

  const confirm = () => {
    if (run(() => store.importJson(source))) {
      toast(`Restored ${preview.total} records successfully.`);
      closeModal();
    }
  };

  return (
    <ModalFrame
      title="Restore backup"
      error={error}
      onClose={closeModal}
      footer={<SaveCancel onCancel={closeModal} onSave={confirm} saveLabel="Replace data" danger />}
    >
      <p className="muted" style={{ margin: 0 }}>
        This replaces the data stored on this device. A copy of the current data is saved automatically before the import.
      </p>
      <div className="import-preview">
        {counts.map(([label, count]) => (
          <div key={label} className="preview-count">
            <strong>{count}</strong>
            <small className="muted">{label}</small>
          </div>
        ))}
      </div>
    </ModalFrame>
  );
};
