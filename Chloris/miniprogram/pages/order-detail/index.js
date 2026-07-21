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

const DELIVERY_SCHEDULE_STATUS_META = {
  notRequired: {
    label: '无需二次确认',
    description: '该订单无需额外确认配送时间'
  },
  pendingMerchantConfirm: {
    label: '待商家确认',
    description: '商家正在确认你选择的配送时间'
  },
  customerConfirmationRequired: {
    label: '待你确认调整',
    description: '商家提出了新的配送时间，请确认是否接受'
  },
  confirmed: {
    label: '时间已确认',
    description: '最终配送时间已经确认'
  },
  adjustmentRejected: {
    label: '调整未接受',
    description: '你暂未接受商家建议，商家会继续与你沟通'
  }
}

function normalizeDeliveryScheduleMeta(order = {}) {
  const status = String(order.deliveryScheduleStatus || 'pendingMerchantConfirm').trim()
    || 'pendingMerchantConfirm'
  const fallback = DELIVERY_SCHEDULE_STATUS_META[status]
    || DELIVERY_SCHEDULE_STATUS_META.pendingMerchantConfirm
  const label = String(order.deliveryScheduleStatusLabel || '').trim()
  const description = String(order.deliveryScheduleStatusDescription || '').trim()

  return {
    deliveryScheduleStatus: status,
    deliveryScheduleStatusLabel: label || fallback.label,
    deliveryScheduleStatusDescription: description || fallback.description
  }
}

function buildDeliverySteps(order, status) {
  if (status === 'customerConfirmationRequired') {
    return [
      { key: 'submitted', title: '需求已提交', state: 'done' },
      { key: 'merchant', title: '商家已调整', state: 'done' },
      { key: 'customer', title: '等待你确认', state: 'current' }
    ]
  }

  if (status === 'adjustmentRejected') {
    return [
      { key: 'submitted', title: '需求已提交', state: 'done' },
      { key: 'merchant', title: '重新沟通中', state: 'current' },
      { key: 'final', title: '确认最终时间', state: 'pending' }
    ]
  }

  if (status === 'confirmed') {
    const orderStatus = String(order.status || '')
    const completed = orderStatus === 'completed'
    const delivering = orderStatus === 'delivering'

    return [
      { key: 'submitted', title: '需求已提交', state: 'done' },
      { key: 'merchant', title: '时间已确认', state: 'done' },
      {
        key: 'delivery',
        title: completed
          ? '配送已完成'
          : delivering
            ? '正在配送'
            : '等待配送',
        state: completed ? 'done' : 'current'
      }
    ]
  }

  return [
    { key: 'submitted', title: '需求已提交', state: 'done' },
    { key: 'merchant', title: '商家确认中', state: 'current' },
    { key: 'final', title: '形成最终安排', state: 'pending' }
  ]
}

function buildDeliveryPresentation(order, values) {
  const status = String(order.deliveryScheduleStatus || 'pendingMerchantConfirm')
  const requested = values.requestedScheduleText
  const confirmed = values.confirmedScheduleText
  const proposed = values.proposedScheduleText

  const base = {
    deliveryTone: 'pending',
    deliveryHeadline: '正在确认配送时间',
    deliveryMainLabel: '你的期望',
    deliveryMainValue: requested,
    deliveryCaption: '商家确认库存与配送能力后，会形成最终安排。',
    deliverySecondaryLabel: '',
    deliverySecondaryValue: '',
    deliverySteps: buildDeliverySteps(order, status)
  }

  if (status === 'confirmed') {
    return {
      ...base,
      deliveryTone: 'confirmed',
      deliveryHeadline: '配送时间已确认',
      deliveryMainLabel: '最终配送时间',
      deliveryMainValue: confirmed || requested,
      deliveryCaption: '商家将按这个时间准备并安排配送。'
    }
  }

  if (status === 'customerConfirmationRequired') {
    return {
      ...base,
      deliveryTone: 'action',
      deliveryHeadline: '商家建议调整配送时间',
      deliveryMainLabel: '商家建议',
      deliveryMainValue: proposed || '等待商家补充',
      deliveryCaption: '请核对新的时间安排，并在页面底部确认或反馈。',
      deliverySecondaryLabel: '你原来的期望',
      deliverySecondaryValue: requested
    }
  }

  if (status === 'adjustmentRejected') {
    return {
      ...base,
      deliveryTone: 'rejected',
      deliveryHeadline: '正在重新协商配送时间',
      deliveryMainLabel: '你的期望',
      deliveryMainValue: requested,
      deliveryCaption: '你暂未接受上次调整，商家会继续与你沟通。',
      deliverySecondaryLabel: proposed ? '上次商家建议' : '',
      deliverySecondaryValue: proposed
    }
  }

  if (status === 'notRequired') {
    return {
      ...base,
      deliveryTone: 'neutral',
      deliveryHeadline: '配送安排',
      deliveryMainLabel: '日期时间',
      deliveryMainValue: values.deliveryScheduleText,
      deliveryCaption: '该订单无需额外确认配送时间。',
      deliverySteps: []
    }
  }

  if (requested === '未填写') {
    return {
      ...base,
      deliveryHeadline: '等待补充配送时间',
      deliveryMainLabel: '期望配送时间',
      deliveryMainValue: '暂未填写',
      deliveryCaption: '商家会与你联系，补充并确认具体配送安排。'
    }
  }

  return base
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
      const deliveryScheduleMeta = normalizeDeliveryScheduleMeta(order)
      const normalizedOrder = { ...order, ...deliveryScheduleMeta }
      const isQuoteOrder = String(normalizedOrder.sourceType || '') === 'quoteRequest'
      const hasDeliverySchedule = normalizedOrder.deliveryScheduleStatus !== 'notRequired'
        || Boolean(normalizedOrder.requestedDeliveryDate || normalizedOrder.confirmedDeliveryDate || normalizedOrder.proposedDeliveryDate)
      const deliveryScheduleText = formatDeliverySchedule(normalizedOrder.deliveryDate, normalizedOrder.deliverySlot)
      const requestedScheduleText = formatDeliverySchedule(
        normalizedOrder.requestedDeliveryDate,
        normalizedOrder.requestedDeliverySlot,
        '未填写'
      )
      const confirmedScheduleText = formatDeliverySchedule(
        normalizedOrder.confirmedDeliveryDate,
        normalizedOrder.confirmedDeliverySlot,
        ''
      )
      const proposedScheduleText = formatDeliverySchedule(
        normalizedOrder.proposedDeliveryDate,
        normalizedOrder.proposedDeliverySlot,
        ''
      )
      const deliveryPresentation = buildDeliveryPresentation(normalizedOrder, {
        deliveryScheduleText,
        requestedScheduleText,
        confirmedScheduleText,
        proposedScheduleText
      })

      this.setData({
        loading: false,
        order: {
          ...normalizedOrder,
          isQuoteOrder,
          hasDeliverySchedule,
          createdAtText: formatDateTime(order.createdAt),
          deliveryScheduleText,
          requestedScheduleText,
          confirmedScheduleText,
          proposedScheduleText,
          ...deliveryPresentation,
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

  copyDeliveryAddress() {
    const order = this.data.order
    const address = order && order.address
    if (!address) return

    const content = [
      address.receiverName,
      address.phone,
      address.fullAddress
    ].filter(Boolean).join(' ')

    if (!content) return
    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({ title: '地址已复制', icon: 'success' })
      }
    })
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
