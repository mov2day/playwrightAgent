export const QUICK_ACTIONS = ['approve', 'reject', 'continue', 'cancel'] as const;

export type QuickAction = (typeof QUICK_ACTIONS)[number];

export function isQuickAction(value: string): value is QuickAction {
  return (QUICK_ACTIONS as readonly string[]).includes(value);
}
