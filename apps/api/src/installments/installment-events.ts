/**
 * Events emitted by the nightly installment sweep. The notifications module
 * subscribes via `@OnEvent` to remind buyers before a due date and after one
 * passes — keeping the installment engine decoupled from how reminders are
 * delivered (in-app, SMS, push).
 */

export const INSTALLMENT_DUE_SOON = 'installment.due_soon';
export const INSTALLMENT_OVERDUE = 'installment.overdue';

export interface InstallmentReminderEvent {
  buyerId: string;
  planId: string;
  installmentId: string;
  sequence: number;
  amount: number;
  currency: string;
  /** Due date as an ISO `YYYY-MM-DD` string. */
  dueDate: string;
}
