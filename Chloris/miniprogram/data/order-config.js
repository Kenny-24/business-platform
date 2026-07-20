const ORDER_TABS = [
  { key: 'all', label: '全部' },
  { key: 'pendingConfirm', label: '待确认' },
  { key: 'pendingPayment', label: '待付款' },
  { key: 'making', label: '制作中' },
  { key: 'delivering', label: '配送中' },
  { key: 'afterSale', label: '售后' }
]

const STATUS_LABELS = {
  pendingConfirm: '待确认',
  pendingPayment: '待付款',
  making: '制作中',
  delivering: '配送中',
  completed: '已完成',
  cancelled: '已取消',
  refundPending: '退款中',
  refunded: '已退款',
  afterSale: '售后'
}

module.exports = {
  ORDER_TABS,
  STATUS_LABELS
}
