import { IonModal } from '@ionic/react';
import { useEffect, useRef } from 'react';
import { useBudget } from '../state/store';
import { ModalRequest, useUi } from '../state/ui';
import { AccountModal, OnboardingModal, TransferModal } from './AccountModals';
import { BudgetModal, ImportModal, PayModal, PlanModal } from './PlanModals';
import { CategoryModal, TransactionModal } from './TransactionModals';

const renderModal = (request: ModalRequest) => {
  switch (request.type) {
    case 'transaction':
      return <TransactionModal existing={request.existing} txType={request.txType} />;
    case 'account':
      return <AccountModal existing={request.existing} />;
    case 'transfer':
      return <TransferModal />;
    case 'budget':
      return <BudgetModal existing={request.existing} />;
    case 'category':
      return <CategoryModal />;
    case 'plan':
      return <PlanModal />;
    case 'pay':
      return <PayModal installmentId={request.installmentId} />;
    case 'import':
      return <ImportModal source={request.source} preview={request.preview} />;
    case 'onboarding':
      return <OnboardingModal />;
  }
};

/** Single modal outlet. Each request gets a fresh key, so form state resets on every open. */
const ModalHost = () => {
  const store = useBudget();
  const { modal, openModal, closeModal } = useUi();
  // Keep rendering the last content while the closing animation runs.
  const last = useRef(modal);
  if (modal) last.current = modal;
  const shown = modal ?? last.current;

  useEffect(() => {
    if (store.isFirstRun) openModal({ type: 'onboarding' });
    // first launch only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <IonModal className="budgetie-modal" isOpen={modal !== null} onDidDismiss={closeModal}>
      {shown && <div key={shown.key} className="ion-page">{renderModal(shown)}</div>}
    </IonModal>
  );
};

export default ModalHost;
