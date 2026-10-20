import { IonLabel, IonSegment, IonSegmentButton } from '@ionic/react';
import { useState } from 'react';
import { AmountField, SelectField, TextField } from '../components/common';
import { formatIdr, parseAmount, todayKey } from '../domain/formatters';
import { BudgetError, TransactionRecord, TransactionType, newId } from '../domain/models';
import { useBudget } from '../state/store';
import { useUi } from '../state/ui';
import { ModalFrame, SaveCancel, useFormAction } from './ModalFrame';

export const TransactionModal = ({ existing, txType }: { existing?: TransactionRecord; txType?: TransactionType }) => {
  const store = useBudget();
  const { closeModal, toast } = useUi();
  const { error, run } = useFormAction();
  const firstCategory = (type: TransactionType) => store.activeCategories.find((item) => item.type === type)?.id ?? '';

  const [type, setType] = useState<TransactionType>(txType ?? existing?.type ?? 'expense');
  const [amount, setAmount] = useState(existing ? existing.amount.toFixed(2) : '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? firstCategory(type));
  const [accountId, setAccountId] = useState(existing?.accountId ?? store.liquidAccounts[0]?.id ?? '');
  const [date, setDate] = useState(existing?.date ?? todayKey());
  const [note, setNote] = useState(existing?.note ?? '');

  const categories = store.activeCategories.filter((item) => item.type === type);
  const selectedAccount = store.account(accountId);
  const parsed = parseAmount(amount);
  const isValid = parsed > 0 && !!accountId && !!categoryId && !!date;

  const save = () => {
    if (!isValid) return;
    const record: TransactionRecord = {
      id: existing?.id ?? newId('transaction'),
      accountId,
      categoryId,
      type,
      amount: parsed,
      date,
      note: note.trim(),
      sourceType: 'manual',
      sourceId: null,
      deletedAt: null,
    };
    const ok = run(() => (existing ? store.updateTransaction(record) : store.addTransaction(record)));
    if (ok) {
      toast(existing ? 'Transaction updated.' : `Transaction recorded: ${formatIdr(record.amount)}`);
      closeModal();
    }
  };

  return (
    <ModalFrame
      title={existing ? 'Edit transaction' : 'Add transaction'}
      error={error}
      onClose={closeModal}
      onSubmit={save}
      footer={<SaveCancel onCancel={closeModal} onSave={save} disabled={!isValid} />}
    >
      <IonSegment
        value={type}
        onIonChange={(event) => {
          const next = event.detail.value as TransactionType;
          setType(next);
          setCategoryId(firstCategory(next));
        }}
      >
        <IonSegmentButton value="expense">
          <IonLabel>Expense</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="income">
          <IonLabel>Income</IonLabel>
        </IonSegmentButton>
      </IonSegment>
      <AmountField label="Amount (IDR)" value={amount} onChange={setAmount} hint={parsed > 0 ? `Nominal: ${formatIdr(parsed)}` : null} />
      <SelectField
        label={selectedAccount ? `Account (Balance: ${formatIdr(store.balanceFor(selectedAccount))})` : 'Account'}
        value={accountId}
        onChange={setAccountId}
        options={store.liquidAccounts.map((item) => ({ value: item.id, label: item.name }))}
      />
      <SelectField
        label="Category"
        value={categoryId}
        onChange={setCategoryId}
        options={categories.map((item) => ({ value: item.id, label: item.name }))}
      />
      <TextField label="Date" type="date" value={date} onChange={setDate} />
      <TextField label="Note (Optional)" value={note} onChange={setNote} placeholder="What was this for?" />
    </ModalFrame>
  );
};

export const CategoryModal = () => {
  const store = useBudget();
  const { closeModal, toast } = useUi();
  const { error, run } = useFormAction();
  const [name, setName] = useState('');
  const [type, setType] = useState<TransactionType>('expense');

  const save = () => {
    const ok = run(() => {
      if (!name.trim()) throw new BudgetError('Category name is required.');
      store.addCategory({ id: newId('category'), name: name.trim(), type, icon: 'circle', isDefault: false, deletedAt: null });
    });
    if (ok) {
      toast(`Category "${name.trim()}" added.`);
      closeModal();
    }
  };

  return (
    <ModalFrame
      title="New category"
      error={error}
      onClose={closeModal}
      onSubmit={save}
      footer={<SaveCancel onCancel={closeModal} onSave={save} />}
    >
      <TextField label="Category name" value={name} onChange={setName} placeholder="e.g. Subscriptions" />
      <SelectField
        label="Used for"
        value={type}
        onChange={(value) => setType(value as TransactionType)}
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
        ]}
      />
    </ModalFrame>
  );
};
