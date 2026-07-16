const ORDER_STATUS_ITEMS = [
  {
    key: 'pendingConfirm',
    label: '待确认',
    glyph: '单'
  },
  {
    key: 'pendingPayment',
    label: '待付款',
    glyph: '付'
  },
  {
    key: 'making',
    label: '制作中',
    glyph: '制'
  },
  {
    key: 'delivering',
    label: '配送中',
    glyph: '送'
  },
  {
    key: 'completed',
    label: '已完成',
    glyph: '成'
  }
]

const ASSET_ITEMS = [
  {
    key: 'points',
    label: '积分'
  },
  {
    key: 'coupons',
    label: '优惠券'
  },
  {
    key: 'favorites',
    label: '收藏'
  }
]

const SERVICE_ITEMS = [
  {
    key: 'addresses',
    label: '收货地址',
    glyph: '址'
  },
  {
    key: 'importantDates',
    label: '重要日期',
    glyph: '日'
  },
  {
    key: 'customerService',
    label: '客服与售后',
    glyph: '客'
  },
  {
    key: 'settings',
    label: '设置',
    glyph: '设'
  }
]

module.exports = {
  ORDER_STATUS_ITEMS,
  ASSET_ITEMS,
  SERVICE_ITEMS
}
