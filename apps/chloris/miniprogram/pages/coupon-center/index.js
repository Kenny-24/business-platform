const { getLayoutMetrics } = require('../../utils/layout')
const {
  listClaimableCoupons,
  claimCoupon
} = require('../../services/user-service')

const COUPON_UPDATE_STORAGE_KEY = 'huayuCouponClaimUpdatedAt'

function buildLayout() {
  const metrics = getLayoutMetrics()
  return {
    contentHeight: metrics.contentHeight,
    horizontalPadding: Number(metrics.horizontalPadding || 18)
  }
}

Page({
  data: {
    ...buildLayout(),
    loading: true,
    claimingId: '',
    items: []
  },

  onLoad() {
    this.loadCoupons()
  },

  onShow() {
    if (this._hasShown) this.loadCoupons(true)
    this._hasShown = true
  },

  onResize() {
    this.setData(buildLayout())
  },

  async loadCoupons(silent = false) {
    if (!silent) this.setData({ loading: true })
    try {
      const result = await listClaimableCoupons()
      this.setData({
        loading: false,
        items: result.items || []
      })
    } catch (error) {
      this.setData({ loading: false })
      if (!silent) {
        wx.showToast({ title: error.message || '领券活动加载失败', icon: 'none' })
      }
    }
  },

  async receiveCoupon(event) {
    const couponId = String(event.currentTarget.dataset.id || '')
    if (!couponId || this.data.claimingId) return

    const item = this.data.items.find((row) => row._id === couponId)
    if (!item || !item.canClaim) return

    this.setData({ claimingId: couponId })
    try {
      const result = await claimCoupon(couponId)
      wx.showToast({
        title: result.message || '领取成功',
        icon: 'success',
        duration: 1400
      })
      wx.setStorageSync(COUPON_UPDATE_STORAGE_KEY, Date.now())
      await this.loadCoupons(true)
    } catch (error) {
      wx.showToast({ title: error.message || '领取失败', icon: 'none' })
      await this.loadCoupons(true)
    } finally {
      this.setData({ claimingId: '' })
    }
  },

  openMyCoupons() {
    wx.navigateTo({ url: '/pages/coupons/index' })
  }
})
