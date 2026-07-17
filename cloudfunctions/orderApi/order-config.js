const PACKAGING_OPTIONS = [
  {
    id: 'basic',
    name: '基础包装',
    description: '简约环保包装',
    feeFen: 0,
    enabled: true,
    sort: 100
  },
  {
    id: 'cream',
    name: '奶油色雾面包装',
    description: '适合日常送礼',
    feeFen: 1200,
    enabled: true,
    sort: 90
  },
  {
    id: 'giftBox',
    name: '礼盒包装',
    description: '适合生日与纪念日',
    feeFen: 2800,
    enabled: true,
    sort: 80
  }
]

const DELIVERY_METHODS = [
  {
    id: 'delivery',
    name: '配送到家',
    description: '配送费由商家确认订单时填写',
    feeFen: 0,
    feePending: true
  },
  {
    id: 'pickup',
    name: '到店自取',
    description: '自取地址与时间由商家确认',
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
    label: '待确认',
    description: '商家正在确认花材库存与配送时间'
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
  PACKAGING_OPTIONS,
  DELIVERY_METHODS,
  DELIVERY_SLOTS,
  STATUS_META
}
