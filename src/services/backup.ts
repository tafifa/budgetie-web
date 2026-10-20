import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { todayKey } from '../domain/formatters';
import { BudgetStore } from '../domain/store';

/** Web: downloads a JSON file. Native (Capacitor): writes to cache and opens the share sheet. */
export const exportBackup = async (store: BudgetStore) => {
  const fileName = `budgetie-backup-${todayKey()}.json`;
  const payload = store.exportJson();

  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: payload,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: 'Budgetie backup', url: uri, dialogTitle: 'Save your Budgetie backup' });
    return;
  }

  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};
