const DELIVERY_METHODS = [
  {
    id: 'delivery',
    name: '配送到家',
    description: '填写收货地址并选择配送日期与时段',
    feeFen: 0,
    feePending: false
  },
  {
    id: 'pickup',
    name: '到店自取',
    description: '选择合作工作室，并按预约时间到店取花',
    feeFen: 0,
    feePending: false
  }
]

const DELIVERY_SLOTS = [
  '09:00-12:00',
  '12:00-15:00',
  '15:00-18:00',
  '18:00-20:00'
]

const STATUS_META = {
  pendingConfirm: {
    label: '待付款',
    description: '历史订单状态已自动按待付款处理'
  },
  pendingPayment: {
    label: '待付款',
    description: '订单已确认，等待完成付款'
  },
  making: {
    label: '制作中',
    description: '花艺师正在为你制作'
  },
  delivering: {
    label: '配送中',
    description: '鲜花正在送往收货地址'
  },
  completed: {
    label: '已完成',
    description: '订单已经完成'
  },
  cancelled: {
    label: '已取消',
    description: '订单已经取消'
  },
  refundPending: {
    label: '退款中',
    description: '退款申请正在处理'
  },
  refunded: {
    label: '已退款',
    description: '退款已经完成'
  }
}

module.exports = {
  DELIVERY_METHODS,
  DELIVERY_SLOTS,
  STATUS_META
}
