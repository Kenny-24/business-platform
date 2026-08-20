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
    horizontalPadding: Number(metrics.horizontalPadding || (width <= 350 ? 14 : width >= 768 ? 28 : 18)),
    compactLayout: Boolean(metrics.isSmallScreen || width <= 350),
    wideLayout: Boolean(metrics.isWideScreen || width >= 720)
  }
}

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatDeliverySchedule(deliveryDate, deliverySlot, fallback = '未选择') {
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
    label: '时间已选定',
    description: '将按你选择的配送时间安排制作与配送'
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
  },
  cancelled: {
    label: '配送已取消',
    description: '订单已取消，不再安排制作与配送'
  },
  refunded: {
    label: '配送已终止',
    description: '订单已退款，不再安排制作与配送'
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
  const orderStatus = String(order.status || '')
  const isPickup = String(order.deliveryMethodId || '') === 'pickup'

  if (orderStatus === 'cancelled') {
    return [
      { key: 'created', title: '订单已创建', state: 'done' },
      { key: 'cancelled', title: '订单已取消', state: 'current' }
    ]
  }

  if (orderStatus === 'refunded') {
    return [
      { key: 'created', title: '订单已创建', state: 'done' },
      { key: 'refunded', title: '订单已退款', state: 'current' }
    ]
  }

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
      { key: 'submitted', title: '订单已创建', state: 'done' },
      { key: 'merchant', title: '时间已选定', state: 'done' },
      {
        key: 'delivery',
        title: completed
          ? (isPickup ? '取货已完成' : '配送已完成')
          : delivering
            ? (isPickup ? '等待到店取货' : '正在配送')
            : (isPickup ? '等待门店备货' : '等待配送'),
        state: completed ? 'done' : 'current'
      }
    ]
  }

  return [
    { key: 'submitted', title: '订单已创建', state: 'done' },
    { key: 'payment', title: '等待付款', state: 'current' },
    { key: 'final', title: '付款后开始制作', state: 'pending' }
  ]
}

function buildDeliveryPresentation(order, values) {
  const status = String(order.deliveryScheduleStatus || 'pendingMerchantConfirm')
  const orderStatus = String(order.status || '')
  const isPickup = String(order.deliveryMethodId || '') === 'pickup'
  const fulfillmentName = isPickup ? '自提' : '配送'
  const requested = values.requestedScheduleText
  const confirmed = values.confirmedScheduleText
  const proposed = values.proposedScheduleText

  if (orderStatus === 'cancelled' || orderStatus === 'refunded') {
    const refunded = orderStatus === 'refunded'
    const originalSchedule = confirmed || requested || values.deliveryScheduleText

    return {
      deliveryTone: 'cancelled',
      deliveryHeadline: refunded ? '订单已退款' : `${fulfillmentName}安排已取消`,
      deliveryMainLabel: originalSchedule && originalSchedule !== '未填写' && originalSchedule !== '未选择'
        ? `原计划${fulfillmentName}时间`
        : `${fulfillmentName}安排`,
      deliveryMainValue: originalSchedule && originalSchedule !== '未填写' && originalSchedule !== '未选择'
        ? originalSchedule
        : '未安排',
      deliveryCaption: refunded
        ? `订单已经退款，不会继续制作或安排${fulfillmentName}。`
        : `订单已经取消，不会继续制作或安排${fulfillmentName}。`,
      deliverySecondaryLabel: '',
      deliverySecondaryValue: '',
      deliverySteps: buildDeliverySteps(order, status)
    }
  }

  const base = {
    deliveryTone: 'pending',
    deliveryHeadline: `${fulfillmentName}时间已选定`,
    deliveryMainLabel: '你的期望',
    deliveryMainValue: requested,
    deliveryCaption: `付款完成后，将按所选时间安排制作与${fulfillmentName}。`,
    deliverySecondaryLabel: '',
    deliverySecondaryValue: '',
    deliverySteps: buildDeliverySteps(order, status)
  }

  if (status === 'confirmed') {
    return {
      ...base,
      deliveryTone: 'confirmed',
      deliveryHeadline: `${fulfillmentName}时间已选定`,
      deliveryMainLabel: `预计${fulfillmentName}时间`,
      deliveryMainValue: confirmed || requested,
      deliveryCaption: `付款完成后，将按这个时间安排制作与${fulfillmentName}。`
    }
  }

  if (status === 'customerConfirmationRequired') {
    return {
      ...base,
      deliveryTone: 'action',
      deliveryHeadline: `商家建议调整${fulfillmentName}时间`,
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
      deliveryHeadline: `正在重新协商${fulfillmentName}时间`,
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
      deliveryHeadline: `${fulfillmentName}安排`,
      deliveryMainLabel: '日期时间',
      deliveryMainValue: values.deliveryScheduleText,
      deliveryCaption: `该订单无需额外确认${fulfillmentName}时间。`,
      deliverySteps: []
    }
  }

  if (requested === '未填写') {
    return {
      ...base,
      deliveryHeadline: `等待补充${fulfillmentName}时间`,
      deliveryMainLabel: `期望${fulfillmentName}时间`,
      deliveryMainValue: '暂未填写',
      deliveryCaption: `商家会与你联系，补充并确认具体${fulfillmentName}安排。`
    }
  }

  return base
}

function normalizeDirectPaymentOrder(order = {}) {
  const rawStatus = String(order.status || 'pendingPayment').trim() || 'pendingPayment'
  const status = rawStatus === 'pendingConfirm' ? 'pendingPayment' : rawStatus
  const paymentStatus = String(order.paymentStatus || 'unpaid').trim() || 'unpaid'
  const requestedDate = String(order.requestedDeliveryDate || order.deliveryDate || '').trim()
  const requestedSlot = String(order.requestedDeliverySlot || order.deliverySlot || '').trim()
  const confirmedDate = String(order.confirmedDeliveryDate || requestedDate).trim()
  const confirmedSlot = String(order.confirmedDeliverySlot || requestedSlot).trim()
  const isUnpaid = !['paid', 'offlinePaid'].includes(paymentStatus)
  const isCancelled = status === 'cancelled'
  const isRefunded = status === 'refunded'
  const isTerminal = isCancelled || isRefunded
  const hasSelectedSchedule = Boolean(requestedDate || requestedSlot)
  const isPickup = String(order.deliveryMethodId || '') === 'pickup'
  const fulfillmentName = isPickup ? '自提' : '配送'

  let deliveryScheduleStatus = hasSelectedSchedule ? 'confirmed' : 'notRequired'
  let deliveryScheduleStatusLabel = hasSelectedSchedule ? '时间已选定' : '无需二次确认'
  let deliveryScheduleStatusDescription = hasSelectedSchedule
    ? `将按你选择的${fulfillmentName}时间安排制作与${fulfillmentName}`
    : `该订单无需额外确认${fulfillmentName}时间`

  if (isCancelled) {
    deliveryScheduleStatus = 'cancelled'
    deliveryScheduleStatusLabel = `${fulfillmentName}已取消`
    deliveryScheduleStatusDescription = `订单已取消，不再安排制作与${fulfillmentName}`
  } else if (isRefunded) {
    deliveryScheduleStatus = 'refunded'
    deliveryScheduleStatusLabel = `${fulfillmentName}已终止`
    deliveryScheduleStatusDescription = `订单已退款，不再安排制作与${fulfillmentName}`
  }

  let paymentStatusText = ['paid', 'offlinePaid'].includes(paymentStatus) ? '已付款' : '未付款'
  if (isCancelled) paymentStatusText += ' · 已取消'
  if (isRefunded) paymentStatusText = '已退款'

  return {
    ...order,
    status,
    statusLabel: status === 'pendingPayment' ? '待付款' : order.statusLabel,
    statusDescription: status === 'pendingPayment'
      ? '订单已创建，请完成付款'
      : isCancelled
        ? (order.statusDescription || '订单已经取消')
        : isRefunded
          ? (order.statusDescription || '订单已经退款')
          : order.statusDescription,
    paymentStatus,
    paymentStatusText,
    isPickup,
    deliveryMethodName: isPickup ? '到店自取' : (order.deliveryMethodName || '配送到家'),
    requestedDeliveryDate: requestedDate,
    requestedDeliverySlot: requestedSlot,
    confirmedDeliveryDate: confirmedDate,
    confirmedDeliverySlot: confirmedSlot,
    deliveryScheduleStatus,
    deliveryScheduleStatusLabel,
    deliveryScheduleStatusDescription,
    deliveryConfirmed: !isTerminal && hasSelectedSchedule,
    isCancelled,
    isRefunded,
    isTerminal,
    canRespondDeliverySchedule: false,
    canPay: !isTerminal && status === 'pendingPayment' && isUnpaid,
    canCancel: !isTerminal && status === 'pendingPayment'
  }
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
    order: null,
    autoPay: false,
    autoPayHandled: false
  },

  onLoad(options = {}) {
    const id = String(options.id || '')
    const autoPay = String(options.autoPay || '') === '1'
    this.setData({ ...buildLayout(), id, autoPay })

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
      const rawOrder = await getOrderDetail(this.data.id)
      const order = normalizeDirectPaymentOrder(rawOrder)
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
      const logisticsTrace = (order.logisticsTrace || []).map((item) => ({
        ...item,
        displayTime: item.time || ''
      }))
      const latestLogistics = logisticsTrace[0] || null
      const orderStatus = String(normalizedOrder.status || '')
      const showLogisticsEntry = !normalizedOrder.isPickup
        && !['cancelled', 'rejected'].includes(orderStatus)
        && (['delivering', 'completed'].includes(orderStatus) || Boolean(order.trackingNo))

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
          hasLogistics: Boolean(order.trackingNo),
          showLogisticsEntry,
          logisticsCompanyName: '顺丰速运',
          trackingNo: String(order.trackingNo || '').trim(),
          logisticsStateLabel: String(order.logisticsStateLabel || '').trim()
            || (order.trackingNo ? '等待物流更新' : '等待商家录入运单'),
          logisticsUpdatedAtText: formatDateTime(order.logisticsUpdatedAt),
          logisticsTrace,
          latestLogistics,
          latestLogisticsContext: latestLogistics
            ? String(latestLogistics.context || '物流状态已更新')
            : (order.trackingNo ? '运单已录入，等待顺丰更新物流轨迹' : '商家正在录入顺丰运单号'),
          latestLogisticsTime: latestLogistics
            ? String(latestLogistics.displayTime || '')
            : (formatDateTime(order.logisticsUpdatedAt) || '物流信息将在发货后显示'),
          logs: (order.logs || []).map((item) => ({
            ...item,
            createdAtText: formatDateTime(item.createdAt)
          }))
        }
      })

      if (this.data.autoPay && !this.data.autoPayHandled && normalizedOrder.canPay) {
        this.setData({ autoPayHandled: true })
        setTimeout(() => this.payOrder(), 120)
      }
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

  openLogisticsPage() {
    const order = this.data.order
    if (!order || !order._id) return
    wx.navigateTo({ url: `/pages/logistics/index?id=${encodeURIComponent(order._id)}` })
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


  copyPickupLocation() {
    const order = this.data.order
    const pickup = order && order.pickupLocation
    if (!pickup) return

    const content = [
      pickup.name,
      pickup.address,
      pickup.phone,
      pickup.businessHours
    ].filter(Boolean).join(' ')

    if (!content) return
    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({ title: '门店信息已复制', icon: 'success' })
      }
    })
  },

  async refreshCurrentLogistics() {
    const order = this.data.order
    if (!order || !order.trackingNo || this.data.logisticsRefreshing) return
    this.setData({ logisticsRefreshing: true })
    wx.showLoading({ title: '查询物流', mask: true })
    try {
      const result = await refreshLogistics(order._id, true)
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
    if (!order || !order.canPay) return

    wx.showModal({
      title: '立即付款',
      content: '订单已进入待付款。当前项目尚未接入微信支付商户接口；接入商户号后，此按钮可直接调起微信支付。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#111111'
    })
  }
})
