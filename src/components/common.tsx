import {
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonToolbar,
} from '@ionic/react';
import { downloadOutline } from 'ionicons/icons';
import { ReactNode } from 'react';
import { formatIdr } from '../domain/formatters';
import { exportBackup } from '../services/backup';
import { useBudget } from '../state/store';
import { useUi } from '../state/ui';

export const AppHeader = () => {
  const store = useBudget();
  const { toast } = useUi();
  const onExport = () => exportBackup(store).catch(() => toast('Could not export the backup.', 'danger'));
  return (
    <IonHeader className="ion-no-border">
      <IonToolbar className="app-toolbar">
        <div className="brand-lockup" slot="start">
          <img src="images/budgetie.png" alt="" />
          <strong>Budgetie</strong>
        </div>
        <IonButtons slot="end">
          <span className="local-pill">●  Local &amp; private</span>
          <IonButton onClick={onExport} aria-label="Export backup" title="Export backup">
            <IonIcon slot="icon-only" icon={downloadOutline} />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
  );
};

export const PageHeading = ({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) => (
  <div className="page-heading">
    <div>
      <p className="eyebrow">BUDGETIE</p>
      <h1>{title}</h1>
      <p className="muted">{subtitle}</p>
    </div>
    {action}
  </div>
);

export const CardSection = ({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <section className="card section-card">
    <div className="section-card-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

export const TextAction = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <IonButton fill="clear" size="small" onClick={onClick}>
    {children}
  </IonButton>
);

export const EmptyState = ({
  title,
  description,
  actionLabel = 'Get started',
  onAction,
  icon = '✦',
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
}) => (
  <div className="empty-state">
    <div className="empty-icon">{icon}</div>
    <strong>{title}</strong>
    <p className="muted">{description}</p>
    {onAction && (
      <IonButton fill="outline" size="small" onClick={onAction}>
        {actionLabel}
      </IonButton>
    )}
  </div>
);

export type Tone = 'positive' | 'negative' | 'warning' | 'neutral';

export const MetricCard = ({
  label,
  value,
  display,
  icon,
  tone,
}: {
  label: string;
  value?: number;
  display?: string;
  icon: string;
  tone: Tone;
}) => (
  <div className="metric-card card">
    <div className={`metric-icon tone-${tone}`}>{icon}</div>
    <div>
      <p className="muted">{label}</p>
      <strong>{display ?? formatIdr(value ?? 0)}</strong>
    </div>
  </div>
);

// ---- form fields ----

export const TextField = ({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = 'text',
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string | null;
  type?: 'text' | 'date' | 'search';
  inputMode?: 'decimal' | 'numeric' | 'text';
}) => (
  <IonInput
    label={label}
    labelPlacement="stacked"
    fill="outline"
    type={type}
    inputmode={inputMode}
    value={value}
    placeholder={placeholder}
    helperText={hint ?? undefined}
    onIonInput={(event) => onChange(String(event.detail.value ?? ''))}
  />
);

/** Amount in IDR; accepts "1.250.000", "1,250,000" or plain digits. */
export const AmountField = (props: { label: string; value: string; onChange: (v: string) => void; hint?: string | null; placeholder?: string }) => (
  <TextField {...props} inputMode="decimal" placeholder={props.placeholder ?? '0'} />
);

export interface Option {
  value: string;
  label: string;
}

export const SelectField = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) => (
  <IonSelect
    label={label}
    labelPlacement="stacked"
    fill="outline"
    interface="popover"
    value={options.length ? value : undefined}
    placeholder={options.length ? 'Choose…' : 'No options available'}
    disabled={!options.length}
    onIonChange={(event) => onChange(String(event.detail.value ?? ''))}
  >
    {options.map((option) => (
      <IonSelectOption key={option.value} value={option.value}>
        {option.label}
      </IonSelectOption>
    ))}
  </IonSelect>
);
