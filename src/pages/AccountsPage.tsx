import { IonButton, IonContent, IonPage, useIonAlert } from '@ionic/react';
import { AppHeader, CardSection, EmptyState, PageHeading } from '../components/common';
import { AccountCard, TransferList } from '../components/rows';
import { Account } from '../domain/models';
import { useBudget } from '../state/store';
import { useUi } from '../state/ui';

const AccountsPage = () => {
  const store = useBudget();
  const { openModal, toast } = useUi();
  const [presentAlert] = useIonAlert();
  const addAccount = () => openModal({ type: 'account' });
  const openTransfer = () => openModal({ type: 'transfer' });

  const confirmArchive = (account: Account) => {
    const transactions = store.activeTransactions.filter((tx) => tx.accountId === account.id).length;
    const transfers = store.activeTransfers.filter(
      (transfer) => transfer.fromAccountId === account.id || transfer.toAccountId === account.id,
    ).length;
    const plans = store.activePlans.filter((plan) => plan.accountId === account.id).length;
    presentAlert({
      header: 'Archive account?',
      subHeader: account.name,
      message:
        `Past transactions and balances stay in history, but this account will no longer be offered for new ` +
        `transactions or transfers. Linked: ${transactions} transaction(s), ${transfers} transfer(s)` +
        (plans ? `, ${plans} paylater plan(s).` : '.'),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Yes, archive account',
          role: 'destructive',
          handler: () => {
            store.archiveAccount(account.id);
            toast('Account archived. Historical records preserved.', 'info');
          },
        },
      ],
    });
  };

  const transfers = [...store.activeTransfers].reverse().slice(0, 5);

  return (
    <IonPage>
      <AppHeader />
      <IonContent>
        <div className="page-content">
          <PageHeading
            title="Accounts"
            subtitle="See your real balance across every place money lives."
            action={<IonButton onClick={addAccount}>+ Add account</IonButton>}
          />
          <div className="account-grid">
            {store.activeAccounts.map((account) => (
              <AccountCard key={account.id} account={account} onArchive={() => confirmArchive(account)} />
            ))}
          </div>
          <CardSection
            title="Move money"
            subtitle="Transfers change account balances but never count as income or expense."
            action={
              <IonButton fill="outline" size="small" onClick={openTransfer}>
                Transfer funds
              </IonButton>
            }
          >
            {transfers.length ? (
              <TransferList transfers={transfers} />
            ) : store.liquidAccounts.length < 2 ? (
              <EmptyState
                title="Need a second account"
                description="Create another bank, e-wallet, or cash account before you can transfer funds."
                actionLabel="+ Add second account"
                onAction={addAccount}
              />
            ) : (
              <EmptyState
                title="No transfers yet"
                description="Move money between your own accounts when needed without affecting income or expense."
                actionLabel="Transfer funds"
                onAction={openTransfer}
              />
            )}
          </CardSection>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AccountsPage;
