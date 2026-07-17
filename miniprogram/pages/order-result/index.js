const {
  getLayoutMetrics
} = require('../../utils/layout')

Page({
  data: {
    contentHeight: 520,
    id: '',
    orderNo: ''
  },

  onLoad(options = {}) {
    const metrics = getLayoutMetrics()
    this.setData({
      contentHeight: metrics.contentHeight,
      id: String(options.id || ''),
      orderNo: String(options.orderNo || '')
    })
  },

  viewOrder() {
    if (!this.data.id) return

    wx.redirectTo({
      url: `/pages/order-detail/index?id=${encodeURIComponent(this.data.id)}`
    })
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
