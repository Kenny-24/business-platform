const { getLayoutMetrics } = require('../../utils/layout')
const {
  getQuoteRequest,
  respondQuoteRequest,
  listAddresses
} = require('../../services/user-service')

const DELIVERY_SLOTS = [
  '09:00-12:00',
  '12:00-15:00',
  '15:00-18:00',
  '18:00-20:00'
]

function getWindowInfoSafe() {
  try {
    if (typeof wx.getWindowInfo === 'function') return wx.getWindowInfo()
  } catch (error) {}

  try {
    return wx.getSystemInfoSync()
  } catch (error) {
    return {}
  }
}

function buildLayout(hasBottomAction = false) {
  const metrics = getLayoutMetrics()
  const windowInfo = getWindowInfoSafe()
  const width = Number(metrics.windowWidth || 375)
  const safeArea = windowInfo.safeArea || null
  const screenHeight = Number(windowInfo.screenHeight || windowInfo.windowHeight || 0)
  const safeBottom = safeArea && Number.isFinite(Number(safeArea.bottom))
    ? Math.max(0, screenHeight - Number(safeArea.bottom))
    : 0
  const bottomActionHeight = hasBottomAction
    ? Math.ceil((106 * width) / 750 + safeBottom)
    : 0

  return {
    contentHeight: metrics.contentHeight,
    scrollHeight: Math.max(260, metrics.contentHeight - bottomActionHeight),
    horizontalPadding: width <= 350 ? 14 : width >= 768 ? 28 : 18,
    compactLayout: width <= 350,
    wideLayout: width >= 720,
    bottomActionHeight
  }
}

function dateText(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function buildAddressOption(item) {
  const fullAddress = String(item.fullAddress || [
    item.province,
    item.city,
    item.district,
    item.detail
  ].filter(Boolean).join('')).trim()
  const person = [item.receiverName, item.phoneMasked || item.phone].filter(Boolean).join(' · ')
  return {
    id: String(item._id || ''),
    label: person || '收货地址',
    description: fullAddress || '地址信息待完善',
    isDefault: item.isDefault === true
  }
}

Page({
  data: {
    contentHeight: 520,
    scrollHeight: 520,
    horizontalPadding: 18,
    compactLayout: false,
    wideLayout: false,
    bottomActionHeight: 0,
    hasBottomAction: false,
    id: '',
    loading: true,
    submitting: false,
    item: null,
    currentImage: 1,
    customerSessionFrom: '',

    deliveryEditorVisible: false,
    addressLoading: false,
    addressOptions: [],
    selectedAddress: null,
    deliverySlots: DELIVERY_SLOTS,
    selectedDeliverySlot: DELIVERY_SLOTS[0],
    minDeliveryDate: '',
    maxDeliveryDate: '',
    deliveryForm: {
      addressIndex: 0,
      requestedDeliveryDate: '',
      deliverySlotIndex: 0,
      requestedDeliveryNote: ''
    }
  },

  onLoad(options = {}) {
    const id = String(options.id || '')
    const today = new Date()
    this.setData({
      ...buildLayout(false),
      id,
      minDeliveryDate: dateText(addDays(today, 1)),
      maxDeliveryDate: dateText(addDays(today, 180)),
      'deliveryForm.requestedDeliveryDate': dateText(addDays(today, 1))
    })

    if (!id) {
      wx.showToast({ title: '报价参数不完整', icon: 'none' })
      return
    }
    this.loadItem()
  },

  onShow() {
    if (this.data.id && this.data.item && !this.data.deliveryEditorVisible) {
      this.loadItem(false)
    }
  },

  onResize() {
    this.setData(buildLayout(this.data.hasBottomAction))
  },

  async loadItem(showLoading = true) {
    if (showLoading) this.setData({ loading: true })
    try {
      const sourceItem = await getQuoteRequest(this.data.id)
      const quotedPriceFen = this.getQuotePriceFen(sourceItem)
      const canDecide = this.canOperateQuote(sourceItem) && !sourceItem.orderId
      const item = {
        ...sourceItem,
        canDecide,
        canAccept: canDecide && quotedPriceFen > 0,
        canReject: canDecide
      }
      const hasBottomAction = canDecide || Boolean(item.orderId)

      this.setData({
        ...buildLayout(hasBottomAction),
        loading: false,
        item,
        hasBottomAction,
        customerSessionFrom: JSON.stringify({
          source: 'quoteDetail',
          requestNo: item.requestNo || ''
        })
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '报价详情加载失败', icon: 'none' })
    }
  },

  changeImage(event) {
    this.setData({ currentImage: Number(event.detail.current || 0) + 1 })
  },

  previewImage(event) {
    const current = String(event.currentTarget.dataset.src || '')
    const urls = (this.data.item && this.data.item.images) || []
    if (!current || !urls.length) return
    wx.previewImage({ current, urls })
  },

  canOperateQuote(item) {
    if (!item) return false
    const status = String(item.status || '').trim()
    const label = String(item.statusLabel || '').trim()
    return status === 'quoted' || item.canDecide === true || /待你确认|待用户确认|商户已报价/.test(label)
  },

  getQuotePriceFen(item) {
    if (!item) return 0
    const candidates = [
      Number(item.quotedPriceFen),
      Number(item.quotedPriceYuan) * 100,
      Number(String(item.quotedPrice || '').replace(/[^0-9.]/g, '')) * 100,
      Number(String(item.quotedPriceText || '').replace(/[^0-9.]/g, '')) * 100
    ]
    const matched = candidates.find((value) => Number.isFinite(value) && value > 0)
    return matched ? Math.round(matched) : 0
  },

  rejectQuote() {
    if (this.data.submitting) {
      wx.showToast({ title: '正在处理，请稍候', icon: 'none' })
      return
    }

    const item = this.data.item
    if (!this.canOperateQuote(item)) {
      wx.showToast({ title: '当前报价状态已变化，请刷新后重试', icon: 'none' })
      this.loadItem(false)
      return
    }

    wx.showModal({
      title: '拒绝本次报价',
      content: '拒绝后该报价将结束。如需求发生变化，可以重新提交新的定制需求。',
      confirmText: '确认拒绝',
      confirmColor: '#9b6667',
      success: (result) => {
        if (result.confirm) this.submitDecision('reject')
      },
      fail: () => wx.showToast({ title: '确认窗口打开失败，请重试', icon: 'none' })
    })
  },

  async acceptQuote() {
    if (this.data.submitting || this.data.addressLoading) {
      wx.showToast({ title: '正在处理，请稍候', icon: 'none' })
      return
    }

    const item = this.data.item
    if (!item || !this.canOperateQuote(item)) {
      wx.showToast({ title: '当前报价状态不能生成订单', icon: 'none' })
      this.loadItem(false)
      return
    }

    if (this.getQuotePriceFen(item) <= 0) {
      wx.showToast({ title: '报价金额尚未同步，请刷新后重试', icon: 'none' })
      return
    }

    this.setData({ addressLoading: true })
    wx.showLoading({ title: '正在读取地址', mask: true })

    try {
      const result = await listAddresses()
      const options = (result.items || []).map(buildAddressOption).filter((row) => row.id)
      wx.hideLoading()

      if (!options.length) {
        wx.showModal({
          title: '请先添加收货地址',
          content: '生成定制订单前，需要选择收货地址和期望配送时间。',
          confirmText: '去添加',
          cancelText: '稍后',
          success: (modalResult) => {
            if (modalResult.confirm) wx.navigateTo({ url: '/pages/address-list/index' })
          }
        })
        return
      }

      const defaultIndex = Math.max(0, options.findIndex((row) => row.isDefault))
      this.setData({
        deliveryEditorVisible: true,
        addressOptions: options,
        selectedAddress: options[defaultIndex],
        selectedDeliverySlot: DELIVERY_SLOTS[0],
        'deliveryForm.addressIndex': defaultIndex,
        'deliveryForm.deliverySlotIndex': 0
      })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '地址加载失败', icon: 'none' })
    } finally {
      this.setData({ addressLoading: false })
    }
  },

  closeDeliveryEditor() {
    if (this.data.submitting) return
    this.setData({ deliveryEditorVisible: false })
  },

  preventEditorClose() {},

  onAddressChange(event) {
    const index = Number(event.detail.value || 0)
    this.setData({
      'deliveryForm.addressIndex': index,
      selectedAddress: this.data.addressOptions[index] || null
    })
  },

  onDeliveryDateChange(event) {
    this.setData({ 'deliveryForm.requestedDeliveryDate': String(event.detail.value || '') })
  },

  onDeliverySlotChange(event) {
    const index = Number(event.detail.value || 0)
    this.setData({
      'deliveryForm.deliverySlotIndex': index,
      selectedDeliverySlot: this.data.deliverySlots[index] || ''
    })
  },

  onDeliveryNoteInput(event) {
    this.setData({ 'deliveryForm.requestedDeliveryNote': String(event.detail.value || '') })
  },

  confirmDeliveryAndCreate() {
    if (this.data.submitting) return

    const form = this.data.deliveryForm
    const address = this.data.addressOptions[Number(form.addressIndex || 0)]
    const slot = this.data.deliverySlots[Number(form.deliverySlotIndex || 0)]
    const deliveryDate = String(form.requestedDeliveryDate || '')

    if (!address || !address.id) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' })
      return
    }
    if (!deliveryDate) {
      wx.showToast({ title: '请选择配送日期', icon: 'none' })
      return
    }
    if (!slot) {
      wx.showToast({ title: '请选择配送时段', icon: 'none' })
      return
    }

    const quotedPriceFen = this.getQuotePriceFen(this.data.item)
    const priceText = (quotedPriceFen / 100).toFixed(2).replace(/\.00$/, '')
    wx.showModal({
      title: '确认生成订单',
      content: `报价 ¥${priceText}，期望于 ${deliveryDate} ${slot} 配送。商家确认时间后即可按流程付款。`,
      confirmText: '确认生成',
      cancelText: '再检查',
      confirmColor: '#6f7d55',
      success: (result) => {
        if (!result.confirm) return
        this.submitDecision('accept', {
          addressId: address.id,
          requestedDeliveryDate: deliveryDate,
          requestedDeliverySlot: slot,
          requestedDeliveryNote: String(form.requestedDeliveryNote || '').trim()
        })
      }
    })
  },

  async submitDecision(decision, delivery = {}) {
    if (this.data.submitting) return

    this.setData({ submitting: true })
    wx.showLoading({
      title: decision === 'accept' ? '正在生成订单' : '正在提交',
      mask: true
    })

    try {
      const result = await respondQuoteRequest(this.data.id, decision, delivery)

      if (decision === 'accept') {
        if (!result || !result.orderId) {
          throw new Error('订单生成结果异常，请刷新后查看或联系客服')
        }

        this.setData({ deliveryEditorVisible: false })
        wx.hideLoading()
        wx.showToast({ title: '订单已生成', icon: 'success', duration: 1200 })
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/order-detail/index?id=${encodeURIComponent(result.orderId)}`,
            fail: () => wx.navigateTo({ url: '/pages/order-list/index?status=pendingPayment' })
          })
        }, 650)
        return
      }

      wx.hideLoading()
      wx.showToast({ title: '已拒绝报价', icon: 'success' })
      await this.loadItem(false)
    } catch (error) {
      wx.hideLoading()
      console.error('[quote-detail] 报价操作失败：', error)
      wx.showModal({
        title: '操作未完成',
        content: error.message || '生成订单失败，请稍后重试。',
        showCancel: false,
        confirmText: '知道了'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  viewOrder() {
    const id = this.data.item && this.data.item.orderId
    if (!id) {
      wx.showToast({ title: '订单信息尚未同步', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/order-detail/index?id=${encodeURIComponent(id)}` })
  }
})
