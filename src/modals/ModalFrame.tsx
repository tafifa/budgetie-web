import { IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/react';
import { closeOutline } from 'ionicons/icons';
import { ReactNode, useState } from 'react';
import { cleanError } from '../domain/models';

export const ModalFrame = ({
  title,
  error,
  onClose,
  onSubmit,
  footer,
  children,
}: {
  title: string;
  error?: string | null;
  onClose: () => void;
  onSubmit?: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) => (
  <>
    <IonHeader>
      <IonToolbar>
        <IonTitle>{title}</IonTitle>
        <IonButtons slot="end">
          <IonButton onClick={onClose} aria-label="Close dialog">
            <IonIcon slot="icon-only" icon={closeOutline} />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent className="ion-padding">
      <form
        className="modal-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.();
        }}
      >
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {children}
        {/* lets Enter submit the form */}
        <button type="submit" hidden />
      </form>
    </IonContent>
    {footer && (
      <IonFooter>
        <div className="modal-footer-actions">{footer}</div>
      </IonFooter>
    )}
  </>
);

export const SaveCancel = ({
  onCancel,
  onSave,
  disabled = false,
  saveLabel = 'Save',
  danger = false,
}: {
  onCancel: () => void;
  onSave: () => void;
  disabled?: boolean;
  saveLabel?: string;
  danger?: boolean;
}) => (
  <>
    <IonButton fill="outline" onClick={onCancel}>
      Cancel
    </IonButton>
    <IonButton disabled={disabled} color={danger ? 'danger' : 'primary'} onClick={onSave}>
      {saveLabel}
    </IonButton>
  </>
);

/** Runs a store action and turns validation errors into a form message. Returns true on success. */
export const useFormAction = () => {
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => void) => {
    try {
      action();
      setError(null);
      return true;
    } catch (caught) {
      setError(cleanError(caught));
      return false;
    }
  };
  return { error, run };
};
