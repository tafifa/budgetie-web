import { IonButton, IonContent, IonPage } from '@ionic/react';
import { AppHeader, EmptyState, MetricCard, PageHeading } from '../components/common';
import { PlanCard } from '../components/rows';
import { monthKey } from '../domain/formatters';
import { useBudget } from '../state/store';
import { useUi } from '../state/ui';

const PaylaterPage = () => {
  const store = useBudget();
  const { openModal } = useUi();
  const currentMonth = monthKey();
  const addPlan = () => openModal({ type: 'plan' });

  const unpaid = store.activeInstallments
    .filter((item) => item.status === 'unpaid')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdue = unpaid.filter((item) => store.isOverdue(item));
  const dueThisMonth = unpaid.filter((item) => !store.isOverdue(item) && monthKey(item.dueDate) === currentMonth);

  // Plans with the earliest unpaid installment first; completed plans last.
  const earliestDue = (planId: string) => unpaid.find((item) => item.planId === planId)?.dueDate;
  const plans = [...store.activePlans].sort((a, b) => {
    const left = earliestDue(a.id);
    const right = earliestDue(b.id);
    if (!left && !right) return 0;
    if (!left) return 1;
    if (!right) return -1;
    return left.localeCompare(right);
  });
  const hasPaylaterAccount = store.activeAccounts.some((account) => account.type === 'paylater');

  return (
    <IonPage>
      <AppHeader />
      <IonContent>
        <div className="page-content">
          <PageHeading
            title="Paylater"
            subtitle="Track future obligations without mixing them into today’s spending."
            action={<IonButton onClick={addPlan}>+ Add plan</IonButton>}
          />

          <div className="metric-grid">
            <MetricCard label="Total outstanding" value={store.totalPaylaterOutstanding} icon="◷" tone="warning" />
            <MetricCard
              label="Unpaid installments"
              display={`${unpaid.length} item${unpaid.length === 1 ? '' : 's'}`}
              icon="≡"
              tone="neutral"
            />
            <MetricCard
              label="Overdue / Due this month"
              display={`${overdue.length} overdue • ${dueThisMonth.length} this mo`}
              icon="!"
              tone={overdue.length ? 'negative' : 'positive'}
            />
          </div>

          {plans.length === 0 ? (
            <div className="card">
              {hasPaylaterAccount ? (
                <EmptyState
                  title="No paylater plans"
                  description="Add a plan to see tenor, due dates, and payment status."
                  actionLabel="+ Add plan"
                  onAction={addPlan}
                />
              ) : (
                <EmptyState
                  title="No Paylater account yet"
                  description="Create a Paylater or Credit account first to track credit limit and installment plans."
                  actionLabel="+ Create paylater account"
                  onAction={() => openModal({ type: 'account' })}
                />
              )}
            </div>
          ) : (
            <>
              {overdue.length > 0 && (
                <div className="card notice-card">
                  <p className="eyebrow danger-text">ACTION REQUIRED</p>
                  <p className="danger-text">
                    <strong>{overdue.length} installment(s) are past due.</strong> Pay these first to avoid late fees.
                  </p>
                </div>
              )}
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default PaylaterPage;
