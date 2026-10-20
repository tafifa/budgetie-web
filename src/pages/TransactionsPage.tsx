import { IonButton, IonContent, IonPage, IonSearchbar } from '@ionic/react';
import { useState } from 'react';
import { AppHeader, CardSection, EmptyState, PageHeading, SelectField, TextAction } from '../components/common';
import { TransactionList } from '../components/rows';
import { transactionTypeLabel } from '../domain/models';
import { useBudget } from '../state/store';
import { useUi } from '../state/ui';

const TransactionsPage = () => {
  const store = useBudget();
  const { openModal } = useUi();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const addTransaction = () => openModal({ type: 'transaction' });

  const needle = query.toLowerCase();
  const records = store.activeTransactions
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((record) => {
      const category = store.category(record.categoryId);
      const matchesQuery =
        !needle || record.note.toLowerCase().includes(needle) || (category?.name.toLowerCase().includes(needle) ?? false);
      return (
        matchesQuery &&
        (typeFilter === 'all' || record.type === typeFilter) &&
        (accountFilter === 'all' || record.accountId === accountFilter) &&
        store.accountById(record.accountId) !== undefined
      );
    });

  const resetFilters = () => {
    setQuery('');
    setTypeFilter('all');
    setAccountFilter('all');
  };

  return (
    <IonPage>
      <AppHeader />
      <IonContent>
        <div className="page-content">
          <PageHeading
            title="Transactions"
            subtitle="Keep every income and expense in one clear timeline."
            action={<IonButton onClick={addTransaction}>+ Add</IonButton>}
          />

          <div className="filter-row card">
            <IonSearchbar
              value={query}
              placeholder="Search note or category…"
              aria-label="Search transactions"
              debounce={0}
              onIonInput={(event) => setQuery(String(event.detail.value ?? ''))}
            />
            <SelectField
              label="Type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: 'all', label: 'All types' },
                { value: 'income', label: 'Income' },
                { value: 'expense', label: 'Expense' },
              ]}
            />
            <SelectField
              label="Account"
              value={accountFilter}
              onChange={setAccountFilter}
              options={[
                { value: 'all', label: 'All accounts' },
                ...store.accounts.map((item) => ({
                  value: item.id,
                  label: item.deletedAt ? `${item.name} (Archived)` : item.name,
                })),
              ]}
            />
          </div>

          {records.length ? (
            <CardSection
              title={`${records.length} transaction${records.length === 1 ? '' : 's'}`}
              subtitle="Tap a transaction to edit or archive it."
            >
              <TransactionList records={records} />
            </CardSection>
          ) : store.activeTransactions.length === 0 ? (
            <div className="card">
              <EmptyState
                title="No transactions recorded yet"
                description="Start tracking your money by recording your first income or expense."
                actionLabel="+ Add transaction"
                onAction={addTransaction}
              />
            </div>
          ) : (
            <div className="card">
              <EmptyState
                icon="🔍"
                title="No matching transactions"
                description="No records match your active search or filters."
                actionLabel="Reset filters"
                onAction={resetFilters}
              />
            </div>
          )}

          <CardSection
            title="Categories"
            subtitle="Default categories can be extended with your own."
            action={<TextAction onClick={() => openModal({ type: 'category' })}>+ New category</TextAction>}
          >
            <div className="chip-list">
              {store.activeCategories.map((category) => (
                <span key={category.id} className={`chip ${category.type}`}>
                  {category.name} • {transactionTypeLabel(category.type)}
                </span>
              ))}
            </div>
          </CardSection>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default TransactionsPage;
