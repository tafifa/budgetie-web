import { IonButton, IonContent, IonPage, IonSelect, IonSelectOption } from '@ionic/react';
import { useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { SpendingBars, TrendBars } from '../components/charts';
import { AppHeader, CardSection, EmptyState, MetricCard, TextAction } from '../components/common';
import { BudgetRow, TransactionList, obligationsFor } from '../components/rows';
import { formatIdr, monthKey, monthLabel, monthOptions } from '../domain/formatters';
import { cleanError } from '../domain/models';
import { exportBackup } from '../services/backup';
import { useBudget } from '../state/store';
import { useUi } from '../state/ui';

const DashboardPage = () => {
  const store = useBudget();
  const { openModal, toast } = useUi();
  const history = useHistory();
  const [month, setMonth] = useState(monthKey());
  const fileInput = useRef<HTMLInputElement>(null);

  const current = monthKey();
  const isHistory = month !== current;
  const label = monthLabel(month);
  const income = store.incomeForMonth(month);
  const expense = store.expenseForMonth(month);
  const obligations = obligationsFor(store.activeInstallments, month);
  const recent = store.activeTransactions
    .filter((item) => monthKey(item.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date));
  const budgets = store.activeBudgets.filter((item) => item.periodMonth === month);
  const overBudget = budgets.filter((item) => store.spendingFor(item.categoryId, month) >= item.limitAmount).length;
  const addTransaction = () => openModal({ type: 'transaction' });
  const period = (base: string) => `${base} (${isHistory ? label : 'This month'})`;

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const source = await file.text();
      openModal({ type: 'import', source, preview: store.previewImport(source) });
    } catch (error) {
      toast(`Import rejected: ${cleanError(error)}`, 'danger');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <IonPage>
      <AppHeader />
      <IonContent>
        <div className="page-content">
          <div className="welcome-row">
            <div>
              <p className="eyebrow">OVERVIEW • {label.toUpperCase()}</p>
              <h1>{isHistory ? 'Historical overview' : 'Good day, keep going.'}</h1>
              <p className="muted">
                {isHistory ? `Viewing recorded finances for ${label}.` : 'A calm view of what is happening with your money.'}
              </p>
            </div>
            <div className="heading-actions">
              <IonSelect
                label="Period"
                labelPlacement="stacked"
                fill="outline"
                interface="popover"
                value={month}
                onIonChange={(event) => setMonth(String(event.detail.value))}
              >
                {monthOptions(6).map((option) => (
                  <IonSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </IonSelectOption>
                ))}
              </IonSelect>
              <IonButton onClick={addTransaction}>+ Add transaction</IonButton>
            </div>
          </div>

          {isHistory && (
            <div className="card notice-card">
              <p className="eyebrow">PAST PERIOD</p>
              <p className="muted small-text">
                You are browsing past data for {label}. Income, spending, and paylater due below reflect this period, while
                total balance reflects your current asset holdings today.
              </p>
            </div>
          )}

          <div className="hero-balance card">
            <div>
              <p className="inverse-muted">Current available balance (Today)</p>
              <h2>{formatIdr(store.totalAssetBalance)}</h2>
              <p className="inverse-muted">Across visible bank, e-wallet, and cash accounts</p>
            </div>
            <div className="balance-orb">↗</div>
          </div>

          <div className="metric-grid">
            <MetricCard label={period('Income')} value={income} icon="↗" tone="positive" />
            <MetricCard label={period('Spent')} value={expense} icon="↘" tone="negative" />
            <MetricCard
              label={period('Paylater due')}
              value={obligations.reduce((sum, item) => sum + item.amount, 0)}
              icon="◷"
              tone="warning"
            />
          </div>

          <div className="dashboard-grid">
            <CardSection
              title="Spending pulse"
              subtitle="This month by category"
              action={<TextAction onClick={() => history.push('/transactions')}>View all</TextAction>}
            >
              <SpendingBars month={month} onAddExpense={addTransaction} />
            </CardSection>

            <CardSection
              title="Budget health"
              subtitle={
                budgets.length
                  ? `${overBudget} ${overBudget === 1 ? 'category' : 'categories'} over limit`
                  : 'Set a limit to stay intentional'
              }
              action={<TextAction onClick={() => history.push('/budgets')}>Manage</TextAction>}
            >
              {budgets.length ? (
                budgets.slice(0, 4).map((budget) => <BudgetRow key={budget.id} budget={budget} />)
              ) : (
                <EmptyState
                  title={`No budgets for ${month}`}
                  description="Set a boundary for your monthly expenses to keep spending intentional."
                  actionLabel="+ Set budget"
                  onAction={() => openModal({ type: 'budget' })}
                />
              )}
            </CardSection>

            <CardSection title="Weekly rhythm" subtitle="Expense trend in five-day blocks">
              <TrendBars month={month} />
            </CardSection>
          </div>

          <CardSection
            title="Recent transactions"
            subtitle={recent.length ? 'Latest money movement' : 'Your latest activity will appear here'}
            action={<TextAction onClick={() => history.push('/transactions')}>See history</TextAction>}
          >
            {recent.length ? (
              <TransactionList records={recent.slice(0, 5)} />
            ) : (
              <EmptyState
                title={`No transactions in ${month}`}
                description="Record an income or expense to see your financial pulse update."
                actionLabel="+ Add transaction"
                onAction={addTransaction}
              />
            )}
          </CardSection>

          <CardSection
            title="Data & Backup safety"
            subtitle="Everything stays on this device. Export regularly to keep your financial records secure."
          >
            <div className="backup-row" style={{ marginBottom: 12 }}>
              <span className="status-pill safe">● Local storage active</span>
              <span className="small-text muted">
                {store.activeAccounts.length} accounts • {store.activeTransactions.length} transactions •{' '}
                {store.activeBudgets.length} budgets • {store.activePlans.length} plans
              </span>
            </div>
            <div className="backup-row">
              <IonButton onClick={() => exportBackup(store).catch(() => toast('Could not export the backup.', 'danger'))}>
                Export JSON backup
              </IonButton>
              <IonButton fill="outline" onClick={() => fileInput.current?.click()}>
                Restore JSON backup
              </IonButton>
              <input
                ref={fileInput}
                type="file"
                className="file-input-hidden"
                accept="application/json,.json"
                aria-label="Import JSON backup"
                onChange={(event) => onImportFile(event.target.files?.[0])}
              />
            </div>
          </CardSection>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default DashboardPage;
