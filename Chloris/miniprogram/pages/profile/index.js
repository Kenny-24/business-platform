const { getLayoutMetrics } = require('../../utils/layout')
const { getProfileOverview } = require('../../services/profile-overview')
const {
  ORDER_STATUS_ITEMS,
  ASSET_ITEMS,
  SERVICE_ITEMS
} = require('../../data/profile-config')

function buildLayout() {
  const metrics = getLayoutMetrics()
  const width = Number(metrics.windowWidth || 375)

  return {
    contentHeight: metrics.contentHeight,
    horizontalPadding: width <= 350 ? 14 : width >= 768 ? 30 : 18,
    avatarSize: width <= 350 ? 64 : width >= 768 ? 86 : 74,
    wideLayout: width >= 720,
    compactLayout: width <= 350
  }
}

function serviceValue(key, overview) {
  if (key === 'addresses') {
    const count = Number(overview.counts.addresses || 0)
    return count > 0 ? `${count}个` : '未添加'
  }

  if (key === 'importantDates') {
    const count = Number(overview.counts.importantDates || 0)
    return count > 0 ? `${count}个` : '未添加'
  }

  if (key === 'quoteRequests') {
    const pending = Number(overview.counts.quotePendingDecision || 0)
    const total = Number(overview.counts.quoteRequests || 0)
    if (pending > 0) return `${pending}条待确认`
    return total > 0 ? `${total}条记录` : '暂无'
  }

  return ''
}

Page({
  data: {
    contentHeight: 520,
    horizontalPadding: 18,
    avatarSize: 74,
    wideLayout: false,
    compactLayout: false,
    loading: true,
    loggedIn: false,
    profile: {
      nickname: 'Chloris 用户',
      avatarUrl: '',
      description: '欢迎回到 Chloris'
    },
    orderItems: [],
    assetItems: [],
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
      const assetItems = ASSET_ITEMS.map((item) => ({
        ...item,
        value: Number(overview.assets[item.key] || 0)
      }))
      const serviceItems = SERVICE_ITEMS.map((item) => ({
        ...item,
        value: serviceValue(item.key, overview)
      }))

      this.setData({
        loading: false,
        loggedIn: overview.loggedIn,
        profile: {
          ...overview.profile,
          description: '欢迎回到 Chloris'
        },
        orderItems,
        assetItems,
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

  openAsset(event) {
    const key = String(event.currentTarget.dataset.key || '')

    if (key === 'favorites') {
      wx.navigateTo({ url: '/pages/atlas/index?tab=favorites' })
      return
    }

    const messages = {
      points: '积分可在结算页查看可抵扣金额',
      coupons: '当前暂无可用优惠券'
    }

    wx.showToast({
      title: messages[key] || '暂无可用内容',
      icon: 'none'
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
    }
  }
})
