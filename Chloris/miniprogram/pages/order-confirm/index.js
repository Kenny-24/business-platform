const {
  getLayoutMetrics
} = require('../../utils/layout')
const {
  listAddresses
} = require('../../services/user-service')
const {
  getCheckoutDraft,
  getCheckoutOptions,
  previewOrder,
  createOrder,
  clearCheckoutDraft,
  removeOrderedItems
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

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function tomorrow() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return formatDate(date)
}

function maxDate(days = 30) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

Page({
  data: {
    contentHeight: 520,
    horizontalPadding: 18,
    compactLayout: false,
    wideLayout: false,
    loading: true,
    submitting: false,
    draft: null,
    options: {
      packagingOptions: [],
      deliveryMethods: [],
      deliverySlots: []
    },
    address: null,
    deliveryMethodId: 'delivery',
    packagingId: 'basic',
    deliveryDate: '',
    deliverySlot: '',
    deliverySlotIndex: 0,
    minDate: '',
    maxDate: '',
    cardMessage: '',
    buyerMessage: '',
    preview: null
  },

  onLoad() {
    this.setData({
      ...buildLayout(),
      minDate: formatDate(new Date()),
      maxDate: maxDate(30),
      deliveryDate: formatDate(new Date())
    })

    this.initialize()
  },

  onShow() {
    const selected = wx.getStorageSync('huayu_selected_address_v1')

    if (selected && selected._id) {
      wx.removeStorageSync('huayu_selected_address_v1')
      this.setData({ address: selected })
      this.refreshPreview()
    }
  },

  onResize() {
    this.setData(buildLayout())
  },

  async initialize() {
    const draft = getCheckoutDraft()

    if (!draft || !Array.isArray(draft.items) || !draft.items.length) {
      wx.showModal({
        title: '无法结算',
        content: '没有找到待结算商品，请返回购物车重新选择。',
        showCancel: false,
        success: () => wx.navigateBack({ delta: 1 })
      })
      return
    }

    this.setData({
      draft,
      deliveryMethodId: 'delivery',
      packagingId: draft.packagingId || 'basic'
    })

    try {
      const [options, addresses] = await Promise.all([
        getCheckoutOptions(),
        listAddresses()
      ])

      const deliverySlots = options.deliverySlots || []
      const draftDate = /^\d{4}-\d{2}-\d{2}$/.test(String(draft.deliveryDate || ''))
        ? String(draft.deliveryDate)
        : formatDate(new Date())
      const draftSlot = deliverySlots.includes(String(draft.deliverySlot || ''))
        ? String(draft.deliverySlot)
        : (deliverySlots[0] || '')

      this.setData({
        options,
        address: addresses.defaultAddress || null,
        deliveryDate: draftDate,
        deliverySlot: draftSlot,
        deliverySlotIndex: Math.max(0, deliverySlots.indexOf(draftSlot)),
        loading: false
      })

      await this.refreshPreview()
    } catch (error) {
      console.error('订单确认初始化失败：', error)
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '结算信息加载失败', icon: 'none' })
    }
  },

  buildPayload() {
    return {
      items: this.data.draft.items,
      addressId: this.data.address && this.data.address._id || '',
      deliveryMethodId: this.data.deliveryMethodId,
      packagingId: this.data.packagingId,
      deliveryDate: this.data.deliveryDate,
      deliverySlot: this.data.deliverySlot,
      cardMessage: this.data.cardMessage,
      buyerMessage: this.data.buyerMessage
    }
  },

  async refreshPreview() {
    if (!this.data.draft || this.data.loading) return

    try {
      const preview = await previewOrder(this.buildPayload())
      this.setData({ preview })
    } catch (error) {
      console.error('订单预览失败：', error)
      wx.showToast({ title: error.message || '订单预览失败', icon: 'none' })
    }
  },

  chooseAddress() {
    wx.navigateTo({
      url: '/pages/address-list/index?select=1'
    })
  },

  chooseDeliveryMethod() {
    wx.showToast({ title: '目前仅支持配送到家', icon: 'none' })
  },

  choosePackaging() {
    const items = this.data.options.packagingOptions || []

    wx.showActionSheet({
      itemList: items.map((item) => {
        const fee = Number(item.feeFen || 0) > 0
          ? ` ¥${Number(item.feeFen) / 100}`
          : ' 免费'
        return `${item.name}${fee}`
      }),
      success: (result) => {
        const selected = items[result.tapIndex]
        if (!selected) return

        this.setData({ packagingId: selected.id })
        this.refreshPreview()
      }
    })
  },

  changeDate(event) {
    this.setData({ deliveryDate: event.detail.value })
    this.refreshPreview()
  },

  changeSlot(event) {
    const index = Number(event.detail.value || 0)
    const deliverySlot = this.data.options.deliverySlots[index] || ''
    this.setData({ deliverySlot, deliverySlotIndex: index })
    this.refreshPreview()
  },

  updateCardMessage(event) {
    this.setData({ cardMessage: event.detail.value })
  },

  updateBuyerMessage(event) {
    this.setData({ buyerMessage: event.detail.value })
  },

  async submitOrder() {
    if (this.data.submitting) return

    if (!this.data.address) {
      wx.showToast({ title: '请先选择收货地址', icon: 'none' })
      return
    }

    if (!this.data.deliveryDate || !this.data.deliverySlot) {
      wx.showToast({ title: '请选择配送日期和时间', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    try {
      const order = await createOrder(this.buildPayload())
      const productIds = (this.data.draft.items || []).map((item) => item.productId)

      removeOrderedItems(productIds)
      clearCheckoutDraft()

      wx.redirectTo({
        url: `/pages/order-result/index?id=${encodeURIComponent(order._id)}&orderNo=${encodeURIComponent(order.orderNo)}`
      })
    } catch (error) {
      wx.showToast({ title: error.message || '提交订单失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
