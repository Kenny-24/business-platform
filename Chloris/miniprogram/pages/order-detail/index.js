const { getLayoutMetrics } = require('../../utils/layout')
const {
  getOrderDetail,
  respondDeliverySchedule,
  refreshLogistics,
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

function formatDeliverySchedule(deliveryDate, deliverySlot, fallback = '待商家确认') {
  const dateText = String(deliveryDate || '').trim()
  const slotText = String(deliverySlot || '').trim()

  if (dateText && slotText && dateText === slotText) return dateText
  if (dateText && slotText) return `${dateText} · ${slotText}`
  return dateText || slotText || fallback
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
    scheduleSubmitting: false,
    logisticsRefreshing: false,
    order: null
  },

  onLoad(options = {}) {
    const id = String(options.id || '')
    this.setData({ ...buildLayout(), id })

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
      const isQuoteOrder = String(order.sourceType || '') === 'quoteRequest'
      const hasDeliverySchedule = order.deliveryScheduleStatus !== 'notRequired'
        || Boolean(order.requestedDeliveryDate || order.confirmedDeliveryDate || order.proposedDeliveryDate)

      this.setData({
        loading: false,
        order: {
          ...order,
          isQuoteOrder,
          hasDeliverySchedule,
          createdAtText: formatDateTime(order.createdAt),
          deliveryScheduleText: formatDeliverySchedule(order.deliveryDate, order.deliverySlot),
          requestedScheduleText: formatDeliverySchedule(
            order.requestedDeliveryDate,
            order.requestedDeliverySlot,
            '未填写'
          ),
          confirmedScheduleText: formatDeliverySchedule(
            order.confirmedDeliveryDate,
            order.confirmedDeliverySlot,
            ''
          ),
          proposedScheduleText: formatDeliverySchedule(
            order.proposedDeliveryDate,
            order.proposedDeliverySlot,
            ''
          ),
          hasLogistics: Boolean(order.logisticsCompanyName && order.trackingNo),
          logisticsUpdatedAtText: formatDateTime(order.logisticsUpdatedAt),
          logisticsTrace: (order.logisticsTrace || []).map((item) => ({
            ...item,
            displayTime: item.time || ''
          })),
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

  acceptDeliverySchedule() {
    const order = this.data.order
    if (!order || !order.canRespondDeliverySchedule || this.data.scheduleSubmitting) return

    wx.showModal({
      title: '确认配送时间',
      content: `确认接受商家建议的 ${order.proposedScheduleText} 吗？`,
      confirmText: '确认时间',
      cancelText: '再看看',
      confirmColor: '#6f8050',
      success: (result) => {
        if (result.confirm) this.submitDeliverySchedule('accept')
      }
    })
  },

  rejectDeliverySchedule() {
    const order = this.data.order
    if (!order || !order.canRespondDeliverySchedule || this.data.scheduleSubmitting) return

    wx.showModal({
      title: '暂不接受调整',
      content: '拒绝后订单不会取消，商家会通过客服继续与你沟通新的配送时间。',
      confirmText: '暂不接受',
      cancelText: '返回',
      confirmColor: '#8c6b69',
      success: (result) => {
        if (result.confirm) this.submitDeliverySchedule('reject')
      }
    })
  },

  async submitDeliverySchedule(decision) {
    if (this.data.scheduleSubmitting) return
    this.setData({ scheduleSubmitting: true })
    wx.showLoading({ title: '正在同步', mask: true })

    try {
      await respondDeliverySchedule(this.data.id, decision)
      wx.hideLoading()
      wx.showToast({
        title: decision === 'accept' ? '时间已确认' : '已反馈商家',
        icon: 'success'
      })
      await this.loadOrder(false)
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '操作失败', icon: 'none' })
    } finally {
      this.setData({ scheduleSubmitting: false })
    }
  },

  copyTrackingNo() {
    const order = this.data.order
    if (!order || !order.trackingNo) return
    wx.setClipboardData({ data: order.trackingNo })
  },

  async refreshCurrentLogistics() {
    const order = this.data.order
    if (!order || !order.trackingNo || this.data.logisticsRefreshing) return
    this.setData({ logisticsRefreshing: true })
    wx.showLoading({ title: '查询物流', mask: true })
    try {
      const result = await refreshLogistics(order._id)
      wx.hideLoading()
      if (result.configured === false) {
        wx.showToast({ title: '物流接口尚未配置', icon: 'none' })
      } else {
        wx.showToast({ title: '物流已更新', icon: 'success' })
      }
      await this.loadOrder(false)
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '物流查询失败', icon: 'none' })
    } finally {
      this.setData({ logisticsRefreshing: false })
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
          await cancelOrder(order._id, result.content || '顾客主动取消')
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
    const order = this.data.order
    if (order && order.hasDeliverySchedule && order.deliveryScheduleStatus !== 'confirmed') {
      wx.showToast({ title: '请先等待配送时间确认', icon: 'none' })
      return
    }

    wx.showModal({
      title: '付款说明',
      content: '商家确认库存与配送安排后，会与你确认付款方式。付款完成后，订单状态将更新为制作中。需要售后时，请保留订单信息和商品照片。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#6f8050'
    })
  }
})
