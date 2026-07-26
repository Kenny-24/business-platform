const { getLayoutMetrics } = require('../../utils/layout')
const { getProfileOverview } = require('../../services/profile-overview')
const {
  ORDER_STATUS_ITEMS,
  SERVICE_GRID_ITEMS
} = require('../../data/profile-config')

const FALLBACK_MERCHANT = {
  name: 'Chloris 花艺',
  wechat: '',
  wechatQrUrl: '',
  profileCoverUrl: '/images/brand/profile-cover.jpg',
  logoUrl: '/images/brand/chloris-loading-logo.png'
}

function buildLayout() {
  const metrics = getLayoutMetrics()
  const width = Number(metrics.windowWidth || 375)
  return {
    contentHeight: metrics.windowHeight,
    horizontalPadding: Number(metrics.horizontalPadding || (width <= 350 ? 14 : width >= 768 ? 30 : 17)),
    wideLayout: Boolean(metrics.isWideScreen || width >= 720),
    compactLayout: width <= 350
  }
}

function serviceValue(key, overview) {
  if (key === 'addresses') {
    const count = Number(overview.counts.addresses || 0)
    return count > 0 ? `${count}` : ''
  }

  if (key === 'importantDates') {
    const count = Number(overview.counts.importantDates || 0)
    return count > 0 ? `${count}` : ''
  }

  if (key === 'quoteRequests') {
    const pending = Number(overview.counts.quotePendingDecision || 0)
    const total = Number(overview.counts.quoteRequests || 0)
    if (pending > 0) return `${pending}`
    return total > 0 ? `${total}` : ''
  }

  if (key === 'coupons') {
    const count = Number(overview.assets.coupons || 0)
    return count > 0 ? `${count}` : ''
  }

  return ''
}

Page({
  data: {
    contentHeight: 667,
    horizontalPadding: 17,
    wideLayout: false,
    compactLayout: false,
    loading: true,
    loggedIn: false,
    showWechatQr: false,
    profile: {
      nickname: 'Chloris 用户',
      avatarUrl: '',
      description: '欢迎回到 Chloris'
    },
    merchant: FALLBACK_MERCHANT,
    orderItems: [],
    serviceItems: []
  },

  onLoad() {
    this.updateLayout()
  },

  onShow() {
    this.refreshOverview({ silent: this._hasLoaded === true })
    this._hasLoaded = true
  },

  onResize() {
    this.updateLayout()
  },

  updateLayout() {
    this.setData(buildLayout())
  },

  async refreshOverview(options = {}) {
    if (!options.silent) this.setData({ loading: true })

    try {
      const overview = await getProfileOverview()
      const orderItems = ORDER_STATUS_ITEMS.map((item) => {
        const count = Number(overview.orderCounts[item.key] || 0)
        return {
          ...item,
          count,
          showCount: count > 0
        }
      })
      const serviceItems = SERVICE_GRID_ITEMS.map((item) => ({
        ...item,
        value: serviceValue(item.key, overview),
        showValue: Boolean(serviceValue(item.key, overview))
      }))

      this.setData({
        loading: false,
        loggedIn: overview.loggedIn,
        profile: {
          ...overview.profile,
          description: '欢迎回到 Chloris'
        },
        merchant: {
          name: String(overview.merchant && overview.merchant.name || FALLBACK_MERCHANT.name),
          wechat: String(overview.merchant && overview.merchant.wechat || ''),
          wechatQrUrl: String(overview.merchant && overview.merchant.wechatQrUrl || ''),
          profileCoverUrl: String(overview.merchant && overview.merchant.profileCoverUrl || FALLBACK_MERCHANT.profileCoverUrl),
          logoUrl: String(overview.merchant && overview.merchant.logoUrl || FALLBACK_MERCHANT.logoUrl)
        },
        orderItems,
        serviceItems
      })
    } catch (error) {
      console.error('用户中心加载失败：', error)
      this.setData({
        loading: false,
        'profile.description': '数据暂未同步，重新进入页面可刷新'
      })

      if (!options.silent) {
        wx.showToast({
          title: error.message || '用户数据加载失败',
          icon: 'none'
        })
      }
    }
  },

  openProfile() {
    wx.navigateTo({ url: '/pages/profile-edit/index' })
  },

  openAllOrders() {
    wx.navigateTo({ url: '/pages/order-list/index?status=all' })
  },

  openOrder(event) {
    const status = String(event.currentTarget.dataset.key || 'all')
    wx.navigateTo({
      url: `/pages/order-list/index?status=${encodeURIComponent(status)}`
    })
  },

  openMerchantWechat() {
    const merchant = this.data.merchant || {}
    if (!merchant.wechatQrUrl && !merchant.wechat) {
      wx.showToast({
        title: '商家微信暂未配置',
        icon: 'none'
      })
      return
    }

    this.setData({ showWechatQr: true })
  },

  closeMerchantWechat() {
    this.setData({ showWechatQr: false })
  },

  stopPropagation() {},

  previewWechatQr() {
    const url = String(this.data.merchant.wechatQrUrl || '')
    if (!url) return

    wx.previewImage({
      current: url,
      urls: [url]
    })
  },

  copyMerchantWechat() {
    const wechat = String(this.data.merchant.wechat || '').trim()
    if (!wechat) {
      wx.showToast({
        title: '商家微信号暂未填写',
        icon: 'none'
      })
      return
    }

    wx.setClipboardData({
      data: wechat,
      success() {
        wx.showToast({ title: '微信号已复制', icon: 'success' })
      }
    })
  },

  openService(event) {
    const key = String(event.currentTarget.dataset.key || '')

    if (key === 'importantDates') {
      wx.switchTab({ url: '/pages/calendar/index' })
      return
    }

    if (key === 'addresses') {
      wx.navigateTo({ url: '/pages/address-list/index' })
      return
    }

    if (key === 'quoteRequests') {
      wx.navigateTo({ url: '/pages/quote-list/index' })
      return
    }

    if (key === 'flowerCare') {
      wx.navigateTo({ url: '/pages/flower-care/index' })
      return
    }

    if (key === 'coupons') {
      wx.showToast({
        title: '当前暂无可用优惠券',
        icon: 'none'
      })
    }
  }
})
