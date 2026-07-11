/**
 * Shared Blueprint toaster singleton — import { toast } and call toast.success(...) etc.
 * Blueprint v6's OverlayToaster.create is async, so we memoize the promise.
 */
import { OverlayToaster, type Toaster, type IconName } from '@blueprintjs/core';

let toasterPromise: Promise<Toaster> | null = null;
function getToaster(): Promise<Toaster> {
  if (!toasterPromise) toasterPromise = OverlayToaster.create({ position: 'top' });
  return toasterPromise;
}

async function show(message: string, intent: 'success' | 'danger' | 'warning' | 'none', icon?: IconName) {
  (await getToaster()).show({ message, intent, icon });
}

export const toast = {
  success: (message: string) => void show(message, 'success', 'tick'),
  danger: (message: string) => void show(message, 'danger', 'error'),
  warning: (message: string) => void show(message, 'warning', 'warning-sign'),
  info: (message: string) => void show(message, 'none'),
};
