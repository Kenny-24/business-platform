const ORDER_STATUS_ITEMS = [
  {
    key: 'pendingConfirm',
    label: '待确认',
    icon: '/images/icons/profile/pendingConfirm.png'
  },
  {
    key: 'pendingPayment',
    label: '待付款',
    icon: '/images/icons/profile/pendingPayment.png'
  },
  {
    key: 'making',
    label: '制作中',
    icon: '/images/icons/profile/making.png'
  },
  {
    key: 'delivering',
    label: '配送中',
    icon: '/images/icons/profile/delivering.png'
  },
  {
    key: 'afterSale',
    label: '售后',
    icon: '/images/icons/profile/afterSale.png'
  }
]

const ASSET_ITEMS = [
  { key: 'points', label: '积分' },
  { key: 'coupons', label: '优惠券' },
  { key: 'favorites', label: '收藏' }
]

const SERVICE_ITEMS = [
  {
    key: 'addresses',
    label: '收货地址',
    description: '管理配送联系人与地址',
    icon: '/images/icons/profile/addresses.png'
  },
  {
    key: 'importantDates',
    label: '我的 BIG DAY',
    description: '记录生日、纪念日和重要时刻',
    icon: '/images/icons/profile/importantDates.png'
  },
  {
    key: 'quoteRequests',
    label: '定制报价',
    description: '查看报价、确认方案与订单',
    icon: '/images/icons/profile/quoteRequests.png'
  },
  {
    key: 'customerService',
    label: '客服',
    description: '订单、配送与定制问题',
    icon: '/images/icons/profile/customerService.png'
  }
]

module.exports = {
  ORDER_STATUS_ITEMS,
  ASSET_ITEMS,
  SERVICE_ITEMS
}
