export const ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PREPARING', 'SHIPPED', 'CANCELLED', 'REFUNDING'],
  PREPARING: ['SHIPPED', 'CANCELLED', 'REFUNDING'],
  SHIPPED: ['COMPLETED', 'REFUNDING'],
  COMPLETED: ['REFUNDING'],
  REFUNDING: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

export function isKnownOrderStatus(status: string) {
  return Object.prototype.hasOwnProperty.call(ORDER_TRANSITIONS, status);
}

export function canTransitionOrder(current: string, next: string) {
  if (!isKnownOrderStatus(current) || !isKnownOrderStatus(next)) return false;
  return current === next || ORDER_TRANSITIONS[current].includes(next);
}

export function shouldRestoreStock(current: string, next: string) {
  return next === 'CANCELLED' && current !== 'CANCELLED';
}
