import { IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { homeOutline, pieChartOutline, swapVerticalOutline, timeOutline, walletOutline } from 'ionicons/icons';
import { Redirect, Route } from 'react-router-dom';
import { BudgetStore } from './domain/store';
import ModalHost from './modals/ModalHost';
import AccountsPage from './pages/AccountsPage';
import BudgetsPage from './pages/BudgetsPage';
import DashboardPage from './pages/DashboardPage';
import PaylaterPage from './pages/PaylaterPage';
import TransactionsPage from './pages/TransactionsPage';
import { StoreProvider } from './state/store';
import { UiProvider } from './state/ui';

setupIonicReact();

// Same paths as the original app, so existing links and bookmarks keep working.
const TABS = [
  { tab: 'dashboard', href: '/', label: 'Overview', icon: homeOutline },
  { tab: 'transactions', href: '/transactions', label: 'Transactions', icon: swapVerticalOutline },
  { tab: 'accounts', href: '/accounts', label: 'Accounts', icon: walletOutline },
  { tab: 'budgets', href: '/budgets', label: 'Budgets', icon: pieChartOutline },
  { tab: 'paylater', href: '/paylater', label: 'Paylater', icon: timeOutline },
];

const App = ({ store }: { store: BudgetStore }) => (
  <IonApp>
    <StoreProvider store={store}>
      <UiProvider>
        <IonReactRouter>
          <IonTabs>
            <IonRouterOutlet>
              <Route exact path="/" component={DashboardPage} />
              <Route exact path="/transactions" component={TransactionsPage} />
              <Route exact path="/accounts" component={AccountsPage} />
              <Route exact path="/budgets" component={BudgetsPage} />
              <Route exact path="/paylater" component={PaylaterPage} />
              <Route render={() => <Redirect to="/" />} />
            </IonRouterOutlet>
            <IonTabBar slot="bottom" aria-label="Main navigation">
              {TABS.map((item) => (
                <IonTabButton key={item.tab} tab={item.tab} href={item.href}>
                  <IonIcon aria-hidden="true" icon={item.icon} />
                  <IonLabel>{item.label}</IonLabel>
                </IonTabButton>
              ))}
            </IonTabBar>
          </IonTabs>
        </IonReactRouter>
        <ModalHost />
      </UiProvider>
    </StoreProvider>
  </IonApp>
);

export default App;
