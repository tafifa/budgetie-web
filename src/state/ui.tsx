import { useIonToast } from '@ionic/react';
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { Account, Budget, TransactionRecord, TransactionType } from '../domain/models';
import { ImportPreview } from '../domain/store';

export type ModalRequest =
  | { type: 'transaction'; existing?: TransactionRecord; txType?: TransactionType }
  | { type: 'account'; existing?: Account }
  | { type: 'transfer' }
  | { type: 'budget'; existing?: Budget }
  | { type: 'category' }
  | { type: 'plan' }
  | { type: 'pay'; installmentId: string }
  | { type: 'import'; source: string; preview: ImportPreview }
  | { type: 'onboarding' };

export type ToastTone = 'success' | 'info' | 'warning' | 'danger';

interface UiContextValue {
  modal: (ModalRequest & { key: number }) | null;
  openModal: (request: ModalRequest) => void;
  closeModal: () => void;
  toast: (message: string, tone?: ToastTone) => void;
}

const UiContext = createContext<UiContextValue | null>(null);

const TOAST_ICON: Record<ToastTone, string> = { success: '✓', info: 'ℹ', warning: '⚠', danger: '✕' };

export const UiProvider = ({ children }: { children: ReactNode }) => {
  const [modal, setModal] = useState<UiContextValue['modal']>(null);
  const [presentToast] = useIonToast();

  const openModal = useCallback((request: ModalRequest) => setModal({ ...request, key: Date.now() }), []);
  const closeModal = useCallback(() => setModal(null), []);
  const toast = useCallback(
    (message: string, tone: ToastTone = 'success') =>
      presentToast({
        message: `${TOAST_ICON[tone]}  ${message}`,
        duration: 2600,
        position: 'top',
        cssClass: `budgetie-toast toast-${tone}`,
        buttons: [{ text: '×', role: 'cancel' }],
      }),
    [presentToast],
  );

  const value = useMemo(() => ({ modal, openModal, closeModal, toast }), [modal, openModal, closeModal, toast]);
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
};

export const useUi = () => {
  const value = useContext(UiContext);
  if (!value) throw new Error('useUi must be used inside UiProvider');
  return value;
};
