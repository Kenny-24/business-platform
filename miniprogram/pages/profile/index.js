const {
  getLayoutMetrics
} = require('../../utils/layout')
const {
  clearHomeDataCache
} = require('../../services/home-data')
const {
  getProfileOverview
} = require('../../services/profile-overview')
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
    avatarSize: width <= 350 ? 62 : width >= 768 ? 84 : 72,
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

  return ''
}

Page({
  data: {
    contentHeight: 520,
    horizontalPadding: 18,
    avatarSize: 72,
    wideLayout: false,
    compactLayout: false,
    loading: true,
    loggedIn: false,
    profile: {
      nickname: '花予用户',
      avatarUrl: '',
      memberLevel: '普通会员',
      description: '正在同步会员资料'
    },
    orderItems: [],
    assetItems: [],
    serviceItems: []
  },

  onLoad() {
    this.updateLayout()
  },

  onShow() {
    this.refreshOverview()
  },

  onResize() {
    this.updateLayout()
  },

  updateLayout() {
    this.setData(buildLayout())
  },

  async refreshOverview() {
    this.setData({ loading: true })

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
        profile: overview.profile,
        orderItems,
        assetItems,
        serviceItems
      })
    } catch (error) {
      console.error('用户中心加载失败：', error)
      this.setData({
        loading: false,
        'profile.description': '数据暂未同步，点击设置可重试'
      })

      wx.showToast({
        title: error.message || '用户数据加载失败',
        icon: 'none'
      })
    }
  },

  openProfile() {
    wx.navigateTo({
      url: '/pages/profile-edit/index'
    })
  },

  openAllOrders() {
    wx.navigateTo({
      url: '/pages/order-list/index?status=all'
    })
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
      wx.navigateTo({
        url: '/pages/atlas/index?tab=favorites'
      })
      return
    }

    const messages = {
      points: '积分流水将在支付版本接入',
      coupons: '优惠券将在营销版本接入'
    }

    wx.showToast({
      title: messages[key] || '该功能将在后续开放',
      icon: 'none'
    })
  },

  openService(event) {
    const key = String(event.currentTarget.dataset.key || '')

    if (key === 'importantDates') {
      wx.switchTab({
        url: '/pages/calendar/index'
      })
      return
    }

    if (key === 'addresses') {
      wx.navigateTo({
        url: '/pages/address-list/index'
      })
      return
    }

    if (key === 'settings') {
      this.openSettings()
      return
    }

    if (key === 'customerService') {
      wx.showModal({
        title: '客服与售后',
        content: '订单售后、在线客服和配送说明将在正式营业前统一配置。',
        showCancel: false,
        confirmText: '知道了',
        confirmColor: '#6f8050'
      })
    }
  },

  openSettings() {
    wx.showActionSheet({
      itemList: [
        '刷新用户与订单数据',
        '清除商品缓存',
        '关于花予'
      ],
      success: (result) => {
        if (result.tapIndex === 0) {
          this.refreshOverview()
          return
        }

        if (result.tapIndex === 1) {
          clearHomeDataCache()
          wx.showToast({ title: '缓存已清除', icon: 'success' })
          return
        }

        wx.showModal({
          title: '关于花予',
          content: '花予，认真对待每一个重要日子。',
          showCancel: false,
          confirmText: '知道了',
          confirmColor: '#6f8050'
        })
      }
    })
  }
})
