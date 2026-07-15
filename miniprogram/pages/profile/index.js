const { getPoints } = require('../../services/storage')

Page({
  data: {
    points: 320,
    orders: [
      { icon: '/images/profile/icons/order-confirm.png', label: '待确认' },
      { icon: '/images/profile/icons/order-pay.png', label: '待付款' },
      { icon: '/images/profile/icons/order-making.png', label: '制作中' },
      { icon: '/images/profile/icons/order-delivery.png', label: '配送中' },
      { icon: '/images/profile/icons/order-complete.png', label: '已完成' }
    ],
    menus: [
      { icon: '/images/profile/icons/location.png', label: '收货地址', value: '3个地址' },
      { icon: '/images/profile/icons/heart.png', label: '我的收藏', value: '16个收藏' },
      { icon: '/images/profile/icons/date.png', label: '重要日期', value: '4个提醒' },
      { icon: '/images/profile/icons/service.png', label: '客服中心', value: '' },
      { icon: '/images/profile/icons/settings.png', label: '设置', value: '' }
    ]
  },

  onShow() {
    this.setData({ points: getPoints() })
  },

  openMenu(e) {
    wx.showToast({
      title: `${e.currentTarget.dataset.label}将在下一版接入`,
      icon: 'none'
    })
  }
})
