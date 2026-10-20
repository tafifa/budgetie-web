import { IonButton, IonToggle } from '@ionic/react';
import { useState } from 'react';
import { AmountField, SelectField, TextField } from '../components/common';
import { formatIdr, parseAmount, parseIntStrict, todayKey } from '../domain/formatters';
import { ACCOUNT_TYPES, Account, AccountType, newId } from '../domain/models';
import { useBudget } from '../state/store';
import { useUi } from '../state/ui';
import { ModalFrame, SaveCancel, useFormAction } from './ModalFrame';

const COLORS = ['#2563EB', '#3E55D8', '#18805B', '#0EA5E9', '#F59E0B', '#EE4D2D', '#C5454D', '#7C3AED', '#475569'];

const ColorPicker = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <div>
    <div className="field-label" style={{ marginBottom: 8 }}>
      Color
    </div>
    <div className="color-row">
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Color ${color}`}
          className={`color-swatch ${value.toLowerCase() === color.toLowerCase() ? 'selected' : ''}`}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
        />
      ))}
      <input type="color" aria-label="Custom color" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  </div>
);

const dayHint = (day: number | null) => (day !== null && (day < 1 || day > 31) ? 'Must be 1-31' : null);

export const AccountModal = ({ existing }: { existing?: Account }) => {
  const store = useBudget();
  const { closeModal, toast } = useUi();
  const { error, run } = useFormAction();

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<AccountType>(existing?.type ?? 'cash');
  const [opening, setOpening] = useState(existing ? existing.openingBalance.toFixed(2) : '0');
  const [limit, setLimit] = useState(existing ? existing.creditLimit.toFixed(2) : '0');
  const [statementDay, setStatementDay] = useState(existing?.statementDay?.toString() ?? '');
  const [dueDay, setDueDay] = useState(existing?.dueDay?.toString() ?? '');
  const [color, setColor] = useState(existing?.color ?? '#2563EB');
  const [hidden, setHidden] = useState(existing?.hiddenFromTotal ?? false);

  const isPaylater = type === 'paylater';
  const parsedOpening = parseAmount(opening);
  const parsedLimit = parseAmount(limit);
  const sDay = parseIntStrict(statementDay);
  const dDay = parseIntStrict(dueDay);
  const linkedTransactions = existing ? store.activeTransactions.filter((tx) => tx.accountId === existing.id).length : 0;
  const isValid =
    !!name.trim() &&
    (!isPaylater || (parsedLimit >= 0 && (sDay === null || (sDay >= 1 && sDay <= 31)) && (dDay === null || (dDay >= 1 && dDay <= 31))));

  const save = () => {
    if (!isValid) return;
    const fields = {
      name: name.trim(),
      type,
      openingBalance: parsedOpening,
      creditLimit: parsedLimit,
      statementDay: sDay,
      dueDay: dDay,
      color,
      hiddenFromTotal: hidden,
    };
    const ok = run(() =>
      existing
        ? store.updateAccount(existing.id, fields)
        : store.addAccount({ id: newId('account'), icon: 'wallet', deletedAt: null, ...fields }),
    );
    if (ok) {
      toast(existing ? 'Account updated.' : `Account "${fields.name}" added.`);
      closeModal();
    }
  };

  return (
    <ModalFrame
      title={existing ? 'Edit account' : 'Add account'}
      error={error}
      onClose={closeModal}
      onSubmit={save}
      footer={<SaveCancel onCancel={closeModal} onSave={save} disabled={!isValid} />}
    >
      <TextField label="Account name" value={name} onChange={setName} placeholder="e.g. BCA, GoPay, Cash" />
      <SelectField
        label="Type"
        value={type}
        onChange={(value) => setType(value as AccountType)}
        options={ACCOUNT_TYPES.map((item) => ({ value: item.value, label: item.label }))}
      />
      <AmountField
        label="Opening balance (IDR)"
        value={opening}
        onChange={setOpening}
        hint={
          existing && linkedTransactions > 0
            ? `⚠️ Changing the opening balance shifts the current balance directly (${linkedTransactions} existing transactions).`
            : parsedOpening > 0
              ? `Nominal: ${formatIdr(parsedOpening)}`
              : null
        }
      />
      {isPaylater && (
        <>
          <AmountField label="Credit limit (IDR)" value={limit} onChange={setLimit} hint={parsedLimit > 0 ? `Limit: ${formatIdr(parsedLimit)}` : null} />
          <div className="two-col">
            <TextField label="Statement day" inputMode="numeric" value={statementDay} onChange={setStatementDay} placeholder="1–31" hint={dayHint(sDay)} />
            <TextField label="Due day" inputMode="numeric" value={dueDay} onChange={setDueDay} placeholder="1–31" hint={dayHint(dDay)} />
          </div>
        </>
      )}
      <ColorPicker value={color} onChange={setColor} />
      {!isPaylater && (
        <IonToggle checked={hidden} onIonChange={(event) => setHidden(event.detail.checked)} justify="space-between">
          Hide this account from dashboard total
        </IonToggle>
      )}
    </ModalFrame>
  );
};

export const TransferModal = () => {
  const store = useBudget();
  const { closeModal, toast } = useUi();
  const { error, run } = useFormAction();
  const accounts = store.liquidAccounts;

  const [from, setFrom] = useState(accounts[0]?.id ?? '');
  const [to, setTo] = useState(accounts[1]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState('');

  const fromAccount = store.account(from);
  const toAccount = store.account(to);
  const fromBalance = fromAccount ? store.balanceFor(fromAccount) : 0;
  const toBalance = toAccount ? store.balanceFor(toAccount) : 0;
  const parsed = parseAmount(amount);
  const isValid = !!from && !!to && from !== to && parsed > 0;
  const options = accounts.map((item) => ({ value: item.id, label: item.name }));

  const save = () => {
    if (!isValid) return;
    const ok = run(() =>
      store.addTransfer({ id: newId('transfer'), fromAccountId: from, toAccountId: to, amount: parsed, date, note: note.trim(), deletedAt: null }),
    );
    if (ok) {
      toast(`Transferred ${formatIdr(parsed)}.`);
      closeModal();
    }
  };

  return (
    <ModalFrame
      title="Transfer funds"
      error={error}
      onClose={closeModal}
      onSubmit={save}
      footer={<SaveCancel onCancel={closeModal} onSave={save} disabled={!isValid} />}
    >
      <SelectField label={fromAccount ? `From account (Balance: ${formatIdr(fromBalance)})` : 'From account'} value={from} onChange={setFrom} options={options} />
      <SelectField label={toAccount ? `To account (Balance: ${formatIdr(toBalance)})` : 'To account'} value={to} onChange={setTo} options={options} />
      {from && from === to && <div className="form-error">Source and destination accounts must be different.</div>}
      <AmountField
        label="Amount (IDR)"
        value={amount}
        onChange={setAmount}
        hint={
          parsed > 0
            ? fromAccount && parsed > fromBalance
              ? `⚠️ Amount exceeds sender balance (${formatIdr(fromBalance)})`
              : `Nominal: ${formatIdr(parsed)}`
            : null
        }
      />
      <TextField label="Date" type="date" value={date} onChange={setDate} />
      <TextField label="Note (Optional)" value={note} onChange={setNote} placeholder="What was this move for?" />
      {isValid && fromAccount && toAccount && (
        <div className="preview-card">
          <p className="eyebrow">TRANSFER PREVIEW</p>
          <p className="small-text">
            <strong>
              {fromAccount.name} → {toAccount.name}
            </strong>{' '}
            for <strong>{formatIdr(parsed)}</strong>
          </p>
          <p className="small-text muted">
            {fromAccount.name}: {formatIdr(fromBalance)} → {formatIdr(fromBalance - parsed)} • {toAccount.name}: {formatIdr(toBalance)} →{' '}
            {formatIdr(toBalance + parsed)}
          </p>
        </div>
      )}
    </ModalFrame>
  );
};

export const OnboardingModal = () => {
  const store = useBudget();
  const { closeModal, openModal, toast } = useUi();
  const { error, run } = useFormAction();
  const [name, setName] = useState(store.accounts[0]?.name ?? 'Cash wallet');
  const [opening, setOpening] = useState('0');
  const parsed = parseAmount(opening);

  const complete = (thenAddTransaction: boolean) => {
    const ok = run(() => {
      const first = store.accounts[0];
      if (first) store.updateAccount(first.id, { name: name.trim() || 'Cash wallet', openingBalance: parsed });
    });
    if (!ok) return;
    if (thenAddTransaction) {
      openModal({ type: 'transaction', txType: parsed > 0 ? 'income' : 'expense' });
    } else {
      toast('Your account is ready.');
      closeModal();
    }
  };

  return (
    <ModalFrame title="Welcome to Budgetie! 👋" error={error} onClose={closeModal} onSubmit={() => complete(false)}>
      <p className="muted" style={{ margin: 0 }}>
        Your financial data is 100% private and stored locally on this device. No servers, no tracking.
      </p>
      <div className="preview-card">
        <p className="eyebrow">STEP 1: PRIMARY ACCOUNT</p>
        <strong>Set up your starting wallet or bank account</strong>
        <p className="small-text muted">Give your main account a recognizable name and starting balance.</p>
      </div>
      <TextField label="Account name" value={name} onChange={setName} placeholder="e.g. Cash, BCA, GoPay" />
      <AmountField label="Opening balance (IDR)" value={opening} onChange={setOpening} hint={parsed > 0 ? `Current balance: ${formatIdr(parsed)}` : null} />
      <div className="onboarding-ctas">
        <SaveButton label="Save & Record first transaction" onClick={() => complete(true)} primary />
        <SaveButton label="Save & Go to dashboard" onClick={() => complete(false)} />
        <SaveButton label="Skip for now" onClick={closeModal} quiet />
      </div>
    </ModalFrame>
  );
};

const SaveButton = ({ label, onClick, primary, quiet }: { label: string; onClick: () => void; primary?: boolean; quiet?: boolean }) => (
  <IonButton expand="block" fill={primary ? 'solid' : quiet ? 'clear' : 'outline'} onClick={onClick}>
    {label}
  </IonButton>
);
