import { IonButton, useIonActionSheet } from '@ionic/react';
import { formatDate, formatIdr, monthKey } from '../domain/formatters';
import { Account, Budget, PaylaterInstallment, PaylaterPlan, Transfer, TransactionRecord, accountTypeLabel, calculationModeLabel, cleanError } from '../domain/models';
import { useBudget } from '../state/store';
import { useUi } from '../state/ui';
import { CardSection } from './common';

/** Tap a row to edit or archive it. Paylater-linked transactions are read-only. */
export const TransactionList = ({ records }: { records: TransactionRecord[] }) => {
  const store = useBudget();
  const { openModal, toast } = useUi();
  const [presentSheet] = useIonActionSheet();

  const onSelect = (record: TransactionRecord) => {
    if (record.sourceType === 'paylater_installment') {
      toast('Linked to a paylater installment, so it cannot be edited directly.', 'info');
      return;
    }
    presentSheet({
      header: record.note || store.category(record.categoryId)?.name || 'Transaction',
      subHeader: `${record.type === 'income' ? '+' : '-'}${formatIdr(record.amount)} • ${formatDate(record.date)}`,
      buttons: [
        { text: 'Edit', handler: () => openModal({ type: 'transaction', existing: record }) },
        {
          text: 'Archive',
          role: 'destructive',
          handler: () => {
            try {
              store.archiveTransaction(record.id);
              toast('Transaction archived.', 'info');
            } catch (error) {
              toast(cleanError(error), 'danger');
            }
          },
        },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
  };

  return (
    <div className="row-list">
      {records.map((record) => {
        const category = store.category(record.categoryId);
        const account = store.accountById(record.accountId);
        const isIncome = record.type === 'income';
        const isLinked = record.sourceType === 'paylater_installment';
        const accountName = account ? (account.deletedAt ? `${account.name} (Archived)` : account.name) : 'Archived account';
        return (
          <button key={record.id} type="button" className="data-row" onClick={() => onSelect(record)}>
            <div className={`row-symbol tone-${isIncome ? 'positive' : 'negative'}`}>{isIncome ? '↗' : '↘'}</div>
            <div className="row-main">
              <div className="row-title">
                <strong>{record.note || category?.name || 'Transaction'}</strong>
                {isLinked && <span className="status-pill warning">Paylater</span>}
              </div>
              <small className="muted">
                {category?.name ?? 'Category'} • {accountName} • {formatDate(record.date)}
              </small>
            </div>
            <div className={`row-value ${record.type}`}>
              {isIncome ? '+' : '-'}
              {formatIdr(record.amount)}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export const TransferList = ({ transfers }: { transfers: Transfer[] }) => {
  const store = useBudget();
  const { toast } = useUi();
  const [presentSheet] = useIonActionSheet();

  const onSelect = (transfer: Transfer) =>
    presentSheet({
      header: 'Transfer',
      subHeader: `${formatIdr(transfer.amount)} • ${formatDate(transfer.date)}`,
      buttons: [
        {
          text: 'Archive',
          role: 'destructive',
          handler: () => {
            store.archiveTransfer(transfer.id);
            toast('Transfer archived.', 'info');
          },
        },
        { text: 'Cancel', role: 'cancel' },
      ],
    });

  return (
    <div className="row-list">
      {transfers.map((transfer) => (
        <button key={transfer.id} type="button" className="data-row" onClick={() => onSelect(transfer)}>
          <div className="row-symbol tone-neutral">⇄</div>
          <div className="row-main">
            <div className="row-title">
              <strong>
                {store.accountById(transfer.fromAccountId)?.name ?? 'Account'} → {store.accountById(transfer.toAccountId)?.name ?? 'Account'}
              </strong>
            </div>
            <small className="muted">
              {formatDate(transfer.date)}
              {transfer.note ? ` • ${transfer.note}` : ''}
            </small>
          </div>
          <div className="row-value">{formatIdr(transfer.amount)}</div>
        </button>
      ))}
    </div>
  );
};

export const budgetStatus = (ratio: number) =>
  ratio >= 1
    ? { label: 'Over budget', tone: 'danger' as const }
    : ratio >= 0.8
      ? { label: 'Near limit', tone: 'warning' as const }
      : { label: 'Safe', tone: 'safe' as const };

export const BudgetRow = ({ budget, showMonth = false }: { budget: Budget; showMonth?: boolean }) => {
  const store = useBudget();
  const { openModal, toast } = useUi();
  const category = store.category(budget.categoryId);
  const spent = store.spendingFor(budget.categoryId, budget.periodMonth);
  const ratio = budget.limitAmount === 0 ? 0 : spent / budget.limitAmount;
  const status = budgetStatus(ratio);
  const remaining = budget.limitAmount - spent;

  return (
    <div className="budget-row">
      <div className="budget-row-heading">
        <div>
          <strong>{category?.name ?? 'Category'}</strong>
          {showMonth && <small className="muted"> • {budget.periodMonth}</small>}
        </div>
        <div className="row-actions">
          <span className={`status-pill ${status.tone}`}>
            {status.label} ({Math.round(ratio * 100)}%)
          </span>
          <IonButton fill="clear" size="small" onClick={() => openModal({ type: 'budget', existing: budget })}>
            Edit
          </IonButton>
          <IonButton
            fill="clear"
            size="small"
            color="danger"
            onClick={() => {
              store.archiveBudget(budget.id);
              toast('Budget archived.', 'info');
            }}
          >
            Archive
          </IonButton>
        </div>
      </div>
      <div className="progress-track">
        <div className={`progress-value ${status.tone}`} style={{ width: `${Math.min(Math.max(ratio * 100, 0), 100)}%` }} />
      </div>
      <div className="budget-row-foot">
        <span>
          {formatIdr(spent)} spent <span className="muted">of {formatIdr(budget.limitAmount)}</span>
        </span>
        <span className={remaining >= 0 ? 'muted' : 'danger-text'}>
          {remaining >= 0 ? `${formatIdr(remaining)} left` : `${formatIdr(-remaining)} over`}
        </span>
      </div>
    </div>
  );
};

export const AccountCard = ({ account, onArchive }: { account: Account; onArchive: () => void }) => {
  const store = useBudget();
  const { openModal, toast } = useUi();
  const isPaylater = account.type === 'paylater';
  const balance = isPaylater ? store.totalOutstandingForAccount(account.id) : store.balanceFor(account);

  return (
    <div className="account-card card">
      <div className="account-card-top">
        <span className="account-icon" style={{ backgroundColor: account.color }}>
          {isPaylater ? '◷' : '◈'}
        </span>
        <div>
          <strong>{account.name}</strong>
          <small className="muted">{accountTypeLabel(account.type)}</small>
        </div>
        <IonButton fill="clear" size="small" onClick={() => openModal({ type: 'account', existing: account })}>
          Edit
        </IonButton>
      </div>
      <div>
        <span className="eyebrow muted">{isPaylater ? 'OUTSTANDING DEBT' : 'AVAILABLE BALANCE'}</span>
        <h3 className={isPaylater && balance > 0 ? 'danger-text' : ''}>{formatIdr(balance)}</h3>
      </div>
      {isPaylater ? (
        <p className="muted small-text" style={{ margin: 0 }}>
          Credit limit: {formatIdr(account.creditLimit)}
        </p>
      ) : (
        <div>
          <span className={`status-pill ${account.hiddenFromTotal ? 'warning' : 'safe'}`}>
            {account.hiddenFromTotal ? 'Excluded from total' : 'Included in total'}
          </span>
        </div>
      )}
      <div className="row-actions">
        {!isPaylater && (
          <IonButton
            fill="clear"
            size="small"
            onClick={() => {
              store.toggleAccountVisibility(account.id);
              toast(account.hiddenFromTotal ? 'Account excluded from total.' : 'Account included in total.', 'info');
            }}
          >
            {account.hiddenFromTotal ? 'Include in total' : 'Exclude from total'}
          </IonButton>
        )}
        <IonButton fill="clear" size="small" color="danger" onClick={onArchive}>
          Archive
        </IonButton>
      </div>
    </div>
  );
};

const InstallmentRow = ({ installment }: { installment: PaylaterInstallment }) => {
  const store = useBudget();
  const { openModal } = useUi();
  const overdue = store.isOverdue(installment);
  return (
    <div className="installment-row">
      <div className={`installment-number ${installment.status}`}>{installment.installmentNo}</div>
      <div className="row-main">
        <strong>{formatIdr(installment.amount)}</strong>
        <small className={overdue ? 'danger-text' : 'muted'}>
          Due {formatDate(installment.dueDate)}
          {overdue ? ' • overdue' : ''}
        </small>
      </div>
      {installment.status === 'paid' ? (
        <span className="status-pill safe">Paid</span>
      ) : (
        <IonButton fill="outline" size="small" onClick={() => openModal({ type: 'pay', installmentId: installment.id })}>
          Mark paid
        </IonButton>
      )}
    </div>
  );
};

export const PlanCard = ({ plan }: { plan: PaylaterPlan }) => {
  const store = useBudget();
  const { toast } = useUi();
  const items = store.activeInstallments
    .filter((item) => item.planId === plan.id)
    .sort((a, b) => a.installmentNo - b.installmentNo);
  const unpaid = items.filter((item) => item.status === 'unpaid');
  const completed = plan.status === 'completed';

  return (
    <CardSection
      title={plan.itemName}
      subtitle={`${store.accountById(plan.accountId)?.name ?? 'Paylater'} • ${calculationModeLabel(plan.mode)} • ${plan.tenorMonths} months`}
      action={
        <div className="row-actions">
          <span className={`status-pill ${completed ? 'safe' : 'warning'}`}>{completed ? 'Completed' : `${unpaid.length} left`}</span>
          <IonButton
            fill="clear"
            size="small"
            color="danger"
            onClick={() => {
              store.archivePlan(plan.id);
              toast('Paylater plan archived.', 'info');
            }}
          >
            Archive
          </IonButton>
        </div>
      }
    >
      <div className="plan-summary">
        <div>
          <small className="muted">Monthly</small>
          <strong>{formatIdr(plan.monthlyInstallment)}</strong>
        </div>
        <div>
          <small className="muted">Total price</small>
          <strong>{formatIdr(plan.totalPrice)}</strong>
        </div>
        {plan.interestPercent !== null && (
          <div>
            <small className="muted">Fee</small>
            <strong>{plan.interestPercent}%</strong>
          </div>
        )}
      </div>
      {items.map((installment) => (
        <InstallmentRow key={installment.id} installment={installment} />
      ))}
    </CardSection>
  );
};

/** Unpaid installments due in `month`. */
export const obligationsFor = (installments: PaylaterInstallment[], month: string) =>
  installments.filter((item) => item.status === 'unpaid' && monthKey(item.dueDate) === month);
