import { formatIdr } from '../domain/formatters';
import { expenseTotalsByBucket } from '../domain/store';
import { useBudget } from '../state/store';
import { EmptyState } from './common';

/** Top five expense categories for the month. */
export const SpendingBars = ({ month, onAddExpense }: { month: string; onAddExpense: () => void }) => {
  const store = useBudget();
  const rows = store.activeCategories
    .filter((category) => category.type === 'expense')
    .map((category) => ({ category, amount: store.spendingFor(category.id, month) }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  if (!rows.length) {
    return (
      <EmptyState
        title="No spending yet"
        description="Your category breakdown will appear after an expense."
        onAction={onAddExpense}
      />
    );
  }
  const max = rows[0].amount;
  return (
    <div className="bar-list">
      {rows.slice(0, 5).map(({ category, amount }) => (
        <div key={category.id} className="bar-item">
          <div className="bar-label">
            <span>{category.name}</span>
            <span className="muted">{formatIdr(amount)}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.min(Math.max((amount / max) * 100, 8), 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Expense trend in five-day blocks. */
export const TrendBars = ({ month }: { month: string }) => {
  const store = useBudget();
  const totals = expenseTotalsByBucket(store, month);
  const max = Math.max(0, ...totals);
  return (
    <div className="trend-chart" role="img" aria-label="Expense trend in five-day blocks">
      {totals.map((total, index) => (
        <div key={index} className="trend-column" title={`Day ${index * 5 + 1}: ${formatIdr(total)}`}>
          <div className="trend-bar-track">
            <div className="trend-bar" style={{ height: `${max === 0 ? 8 : Math.min(Math.max((total / max) * 100, 8), 100)}%` }} />
          </div>
          <small className="muted">{index * 5 + 1}</small>
        </div>
      ))}
    </div>
  );
};
