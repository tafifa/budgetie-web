import { IonButton, IonContent, IonPage } from '@ionic/react';
import { useState } from 'react';
import { AppHeader, CardSection, EmptyState, PageHeading, SelectField } from '../components/common';
import { BudgetRow } from '../components/rows';
import { monthKey, monthOptions } from '../domain/formatters';
import { useBudget } from '../state/store';
import { useUi } from '../state/ui';

const INFO = [
  { label: 'Safe', value: 'Under 80%', description: 'The budget is comfortably on track.' },
  { label: 'Near limit', value: '80–99.99%', description: 'A soft warning before you cross the line.' },
  { label: 'Over budget', value: '100%+', description: 'A clear signal to pause and review.' },
];

const BudgetsPage = () => {
  const store = useBudget();
  const { openModal } = useUi();
  const current = monthKey();
  const [selected, setSelected] = useState(current);
  const addBudget = () => openModal({ type: 'budget' });

  const budgets =
    selected === 'all'
      ? [...store.activeBudgets].sort((a, b) => b.periodMonth.localeCompare(a.periodMonth))
      : store.activeBudgets.filter((budget) => budget.periodMonth === selected);
  const hasExpenseCategory = store.activeCategories.some((category) => category.type === 'expense');

  return (
    <IonPage>
      <AppHeader />
      <IonContent>
        <div className="page-content">
          <PageHeading
            title="Budgets"
            subtitle="Give each category a gentle boundary for the month."
            action={<IonButton onClick={addBudget}>+ Set budget</IonButton>}
          />
          <div style={{ maxWidth: 260 }}>
            <SelectField
              label="Filter by period"
              value={selected}
              onChange={setSelected}
              options={[{ value: 'all', label: 'All periods' }, ...monthOptions(6, 2)]}
            />
          </div>

          {selected !== current && selected !== 'all' && (
            <div className="card notice-card">
              <p className="eyebrow">HISTORICAL RECORD</p>
              <p className="muted small-text">
                Viewing budgets for {selected}. Spending progress reflects transactions from that period.
              </p>
            </div>
          )}

          {budgets.length ? (
            <CardSection
              title={selected === 'all' ? 'All budgets' : `Budgets for ${selected}`}
              subtitle="Progress is calculated from expense transactions only."
            >
              {budgets.map((budget) => (
                <BudgetRow
                  key={budget.id}
                  budget={budget}
                  showMonth={selected === 'all' || budget.periodMonth !== current}
                />
              ))}
            </CardSection>
          ) : (
            <div className="card">
              <EmptyState
                title={selected === 'all' ? 'No budgets set' : `No budgets set for ${selected}`}
                description={
                  hasExpenseCategory
                    ? 'Set a monthly spending limit on frequent expense categories like Food, Transport, or Bills.'
                    : 'Add an expense category first, then set your budget boundary.'
                }
                actionLabel="+ Set budget limit"
                onAction={addBudget}
              />
            </div>
          )}

          <CardSection title="How it works">
            <div className="info-grid">
              {INFO.map((item) => (
                <div key={item.label} className="info-item">
                  <span className="status-pill safe">{item.label}</span>
                  <strong>{item.value}</strong>
                  <small className="muted">{item.description}</small>
                </div>
              ))}
            </div>
          </CardSection>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default BudgetsPage;
