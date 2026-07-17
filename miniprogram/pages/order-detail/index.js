const {
  getLayoutMetrics
} = require('../../utils/layout')
const {
  getOrderDetail,
  cancelOrder
} = require('../../services/order-service')

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

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

Page({
  data: {
    contentHeight: 520,
    horizontalPadding: 18,
    compactLayout: false,
    wideLayout: false,
    id: '',
    loading: true,
    cancelling: false,
    order: null
  },

  onLoad(options = {}) {
    const id = String(options.id || '')
    this.setData({
      ...buildLayout(),
      id
    })

    if (!id) {
      wx.showToast({ title: '订单参数不完整', icon: 'none' })
      return
    }

    this.loadOrder()
  },

  onShow() {
    if (this.data.id && this.data.order) this.loadOrder(false)
  },

  onResize() {
    this.setData(buildLayout())
  },

  async loadOrder(showLoading = true) {
    if (showLoading) this.setData({ loading: true })

    try {
      const order = await getOrderDetail(this.data.id)

      this.setData({
        loading: false,
        order: {
          ...order,
          createdAtText: formatDateTime(order.createdAt),
          logs: (order.logs || []).map((item) => ({
            ...item,
            createdAtText: formatDateTime(item.createdAt)
          }))
        }
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '订单加载失败', icon: 'none' })
    }
  },

  cancelOrder() {
    const order = this.data.order
    if (!order || !order.canCancel || this.data.cancelling) return

    wx.showModal({
      title: '取消订单',
      editable: true,
      placeholderText: '可填写取消原因',
      confirmText: '确认取消',
      confirmColor: '#7d665c',
      success: async (result) => {
        if (!result.confirm) return

        this.setData({ cancelling: true })

        try {
          await cancelOrder(
            order._id,
            result.content || '顾客主动取消'
          )
          wx.showToast({ title: '订单已取消', icon: 'success' })
          this.loadOrder(false)
        } catch (error) {
          wx.showToast({ title: error.message || '取消失败', icon: 'none' })
        } finally {
          this.setData({ cancelling: false })
        }
      }
    })
  },

  payOrder() {
    wx.showModal({
      title: '微信支付尚未接入',
      content: '订单与后台接单流程已经可用。微信支付、库存锁定和退款将在下一版本接入。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#6f8050'
    })
  }
})
