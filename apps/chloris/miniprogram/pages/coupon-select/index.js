const { getLayoutMetrics } = require('../../utils/layout')
const { listCheckoutCoupons } = require('../../services/order-service')

function layout() {
  const metrics = getLayoutMetrics()
  return { contentHeight: metrics.contentHeight, horizontalPadding: Number(metrics.horizontalPadding || 18) }
}

function expiry(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`
}

Page({
  data: { ...layout(), loading: true, items: [], selectedCouponId: '' },
  onLoad() {
    const context = wx.getStorageSync('huayu_coupon_select_context_v1') || {}
    this._items = context.items || []
    this.setData({ selectedCouponId: String(context.selectedCouponId || '') })
    this.load()
  },
  onResize() { this.setData(layout()) },
  async load() {
    try {
      const result = await listCheckoutCoupons(this._items)
      this.setData({
        loading: false,
        items: (result.items || []).map((item) => ({ ...item, expiryText: expiry(item.expiresAt) }))
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '优惠券加载失败', icon: 'none' })
    }
  },
  choose(event) {
    const id = String(event.currentTarget.dataset.id || '')
    const item = this.data.items.find((coupon) => coupon._id === id)
    if (!item || !item.canUse) return
    wx.setStorageSync('huayu_selected_coupon_v1', item)
    wx.navigateBack()
  },
  clear() {
    wx.setStorageSync('huayu_selected_coupon_v1', { clear: true })
    wx.navigateBack()
  }
})
