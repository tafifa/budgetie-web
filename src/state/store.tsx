import { createContext, ReactNode, useContext, useSyncExternalStore } from 'react';
import { BudgetStore, StorageBackend } from '../domain/store';

const browserStorage: StorageBackend = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};

const StoreContext = createContext<BudgetStore | null>(null);

export const createBrowserStore = () => {
  const store = new BudgetStore(browserStorage);
  store.load();
  return store;
};

export const StoreProvider = ({ store, children }: { store: BudgetStore; children: ReactNode }) => (
  <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
);

/** Returns the store and re-renders the caller after every save. */
export const useBudget = (): BudgetStore => {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useBudget must be used inside StoreProvider');
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
};
