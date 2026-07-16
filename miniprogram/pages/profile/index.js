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
  const width = Number(
    metrics.windowWidth || 375
  )

  return {
    contentHeight:
      metrics.contentHeight,
    horizontalPadding:
      width <= 350
        ? 14
        : width >= 768
          ? 30
          : 18,
    avatarSize:
      width <= 350
        ? 62
        : width >= 768
          ? 84
          : 72,
    wideLayout:
      width >= 720,
    compactLayout:
      width <= 350
  }
}

function serviceValue(
  key,
  overview
) {
  if (key === 'addresses') {
    const count =
      overview.counts.addresses

    return count > 0
      ? `${count}个`
      : '未添加'
  }

  if (key === 'importantDates') {
    const count =
      overview.counts.importantDates

    return count > 0
      ? `${count}个`
      : '未添加'
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
    loggedIn: false,
    profile: {
      nickname: '登录 / 注册',
      avatarUrl: '',
      memberLevel: '',
      description:
        '登录后查看订单、积分和收藏'
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

  refreshOverview() {
    try {
      const overview =
        getProfileOverview()

      const orderItems =
        ORDER_STATUS_ITEMS.map(
          (item) => {
            const count =
              Number(
                overview.orderCounts[
                  item.key
                ] || 0
              )

            return {
              ...item,
              count,
              showCount: count > 0
            }
          }
        )

      const assetItems =
        ASSET_ITEMS.map(
          (item) => ({
            ...item,
            value:
              Number(
                overview.assets[
                  item.key
                ] || 0
              )
          })
        )

      const serviceItems =
        SERVICE_ITEMS.map(
          (item) => ({
            ...item,
            value:
              serviceValue(
                item.key,
                overview
              )
          })
        )

      this.setData({
        loggedIn:
          overview.loggedIn,
        profile:
          overview.profile,
        orderItems,
        assetItems,
        serviceItems
      })
    } catch (error) {
      console.error(
        '用户中心加载失败：',
        error
      )

      wx.showToast({
        title: '数据加载失败',
        icon: 'none'
      })
    }
  },

  openProfile() {
    if (!this.data.loggedIn) {
      wx.showModal({
        title: '登录花予',
        content:
          '顾客微信登录将在订单与支付功能接入时启用。',
        showCancel: false,
        confirmText: '知道了',
        confirmColor: '#6f8050'
      })
      return
    }

    wx.showToast({
      title:
        '个人资料将在用户系统接入后开放',
      icon: 'none'
    })
  },

  openAllOrders() {
    wx.showToast({
      title:
        '订单列表将在订单功能接入后开放',
      icon: 'none'
    })
  },

  openOrder(event) {
    const label = String(
      event.currentTarget.dataset.label ||
      '订单'
    )

    wx.showToast({
      title:
        `${label}将在订单功能接入后开放`,
      icon: 'none'
    })
  },

  openAsset(event) {
    const key = String(
      event.currentTarget.dataset.key ||
      ''
    )

    const messages = {
      points:
        '积分明细将在积分流水接入后开放',
      coupons:
        '优惠券将在营销功能接入后开放',
      favorites:
        '收藏将在商品详情接入后开放'
    }

    wx.showToast({
      title:
        messages[key] ||
        '该功能将在后续开放',
      icon: 'none'
    })
  },

  openService(event) {
    const key = String(
      event.currentTarget.dataset.key ||
      ''
    )

    if (key === 'importantDates') {
      wx.switchTab({
        url: '/pages/calendar/index'
      })
      return
    }

    if (key === 'settings') {
      this.openSettings()
      return
    }

    if (key === 'addresses') {
      wx.showToast({
        title:
          '地址将在结算功能接入后开放',
        icon: 'none'
      })
      return
    }

    if (key === 'customerService') {
      wx.showModal({
        title: '客服与售后',
        content:
          '在线客服、配送说明和售后服务将在正式营业前配置。',
        showCancel: false,
        confirmText: '知道了',
        confirmColor: '#6f8050'
      })
    }
  },

  openSettings() {
    wx.showActionSheet({
      itemList: [
        '刷新数据',
        '清除商品缓存',
        '关于花予'
      ],
      success: (result) => {
        if (result.tapIndex === 0) {
          this.refreshOverview()

          wx.showToast({
            title: '已刷新',
            icon: 'success'
          })
          return
        }

        if (result.tapIndex === 1) {
          clearHomeDataCache()

          wx.showToast({
            title: '缓存已清除',
            icon: 'success'
          })
          return
        }

        wx.showModal({
          title: '关于花予',
          content:
            '花予，认真对待每一个重要日子。',
          showCancel: false,
          confirmText: '知道了',
          confirmColor: '#6f8050'
        })
      }
    })
  }
})
