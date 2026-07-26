const ORDER_STATUS_ITEMS = [
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
  { key: 'coupons', label: '优惠券' }
]

const SERVICE_GRID_ITEMS = [
  {
    key: 'quoteRequests',
    label: '定制报价',
    icon: '/images/icons/profile/quoteRequests.png'
  },
  {
    key: 'importantDates',
    label: '我的 BIG DAY',
    icon: '/images/icons/profile/importantDates.png'
  },
  {
    key: 'addresses',
    label: '收货地址',
    icon: '/images/icons/profile/addresses.png'
  },
  {
    key: 'customerService',
    label: '联系客服',
    icon: '/images/icons/profile/customerService.png'
  },
  {
    key: 'coupons',
    label: '优惠券',
    icon: '/images/icons/profile/coupons.png'
  },
  {
    key: 'flowerCare',
    label: '鲜花护理',
    icon: '/images/icons/profile/flowerCare.png'
  }
]

const SERVICE_ITEMS = SERVICE_GRID_ITEMS

module.exports = {
  ORDER_STATUS_ITEMS,
  ASSET_ITEMS,
  SERVICE_ITEMS,
  SERVICE_GRID_ITEMS
}
