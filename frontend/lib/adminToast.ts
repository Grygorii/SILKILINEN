'use client';

// Tiny event-based toast for admin pages. Pages call toast() directly —
// no context/provider plumbing needed because AdminToastHost (mounted once
// in AdminLayout) listens on window. Replaces the old blocking alert()
// pattern: errors and confirmations now appear as dismissable notices in
// the corner instead of freezing the whole tab.

export type ToastKind = 'success' | 'error' | 'info';

export const ADMIN_TOAST_EVENT = 'silkilinen-admin-toast';

export function toast(message: string, kind: ToastKind = 'success') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_TOAST_EVENT, { detail: { message, kind } }));
}
