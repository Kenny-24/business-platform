const {
  getLayoutMetrics
} = require('../../utils/layout')
const {
  listOrders
} = require('../../services/order-service')
const {
  ORDER_TABS
} = require('../../data/order-config')

function buildLayout() {
  const metrics = getLayoutMetrics()
  const width = Number(metrics.windowWidth || 375)

  return {
    contentHeight: metrics.contentHeight,
    horizontalPadding: width <= 350 ? 14 : width >= 768 ? 28 : 18,
    compactLayout: width <= 350,
    wideLayout: width >= 720
  }
}

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return [
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  ].join(' ')
}

function formatDeliverySchedule(deliveryDate, deliverySlot) {
  const dateText = String(deliveryDate || '').trim()
  const slotText = String(deliverySlot || '').trim()

  if (dateText && slotText && dateText === slotText) return dateText
  if (dateText && slotText) return `${dateText} · ${slotText}`
  return dateText || slotText || '待商家确认'
}

Page({
  data: {
    contentHeight: 520,
    horizontalPadding: 18,
    compactLayout: false,
    wideLayout: false,
    loading: true,
    refreshing: false,
    activeStatus: 'all',
    tabs: ORDER_TABS,
    items: [],
    counts: {}
  },

  onLoad(options = {}) {
    const status = String(options.status || 'all')
    const activeStatus = ORDER_TABS.some((item) => item.key === status)
      ? status
      : 'all'

    this.setData({
      ...buildLayout(),
      activeStatus
    })
  },

  onShow() {
    this.loadOrders()
  },

  onResize() {
    this.setData(buildLayout())
  },

  selectTab(event) {
    const activeStatus = String(event.currentTarget.dataset.key || 'all')
    if (activeStatus === this.data.activeStatus) return

    this.setData({ activeStatus })
    this.loadOrders()
  },

  async onRefresh() {
    if (this.data.refreshing) return
    this.setData({ refreshing: true })

    try {
      await this.loadOrders(false)
    } finally {
      this.setData({ refreshing: false })
    }
  },

  async loadOrders(showLoading = true) {
    if (showLoading) this.setData({ loading: true })

    try {
      const result = await listOrders(this.data.activeStatus)
      this.setData({
        loading: false,
        counts: result.counts || {},
        items: (result.items || []).map((item) => ({
          ...item,
          createdAtText: formatDateTime(item.createdAt),
          firstItem: item.items && item.items[0] || null,
          moreItemCount: Math.max(0, Number(item.items && item.items.length || 0) - 1),
          deliveryScheduleText: formatDeliverySchedule(item.deliveryDate, item.deliverySlot)
        }))
      })
    } catch (error) {
      console.error('订单列表加载失败：', error)
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '订单加载失败', icon: 'none' })
    }
  },

  openOrder(event) {
    const id = String(event.currentTarget.dataset.id || '')
    if (!id) return

    wx.navigateTo({
      url: `/pages/order-detail/index?id=${encodeURIComponent(id)}`
    })
  },

  goShopping() {
    wx.switchTab({ url: '/pages/category/index' })
  }
})
