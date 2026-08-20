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

function formatDateTime(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}


function slotStartTimestamp(dateString, slot) {
  const start = String(slot || '').split('-')[0]
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ''))) return 0
  return new Date(`${dateString}T${start}:00+08:00`).getTime()
}

function firstAllowedSlot(slots, dateString, earliestAt) {
  const earliest = new Date(earliestAt || 0).getTime()
  if (!Number.isFinite(earliest) || !earliest) return slots[0] || ''
  return slots.find((slot) => slotStartTimestamp(dateString, slot) >= earliest) || ''
}

function normalizeDeliverySelection({ slots, draftDate, draftSlot, minDate, maxDate, earliestAt }) {
  let date = draftDate
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < minDate) date = minDate
  if (maxDate && date > maxDate) date = maxDate

  const allowedFirst = firstAllowedSlot(slots, date, earliestAt)
  const currentAllowed = slots.includes(draftSlot) && (
    !earliestAt || slotStartTimestamp(date, draftSlot) >= new Date(earliestAt).getTime()
  )
  const slot = currentAllowed ? draftSlot : (allowedFirst || slots[0] || '')
  return { date, slot, index: Math.max(0, slots.indexOf(slot)) }
}

function getEarliestDeliveryTime() {
  const date = new Date()
  date.setHours(date.getHours() + 2)
  return formatDateTime(date)
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

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const DELIVERY_WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function dateFromValue(value) {
  return new Date(`${value}T00:00:00+08:00`)
}

function formatPickerDateLabel(value, todayValue) {
  const date = dateFromValue(value)
  const weekday = DELIVERY_WEEKDAYS[date.getDay()] || ''
  const tomorrowValue = formatDate(addDays(dateFromValue(todayValue), 1))

  if (value === todayValue) return `今天（${weekday}）`
  if (value === tomorrowValue) return `明天（${weekday}）`
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}（${weekday}）`
}

function availableSlotsForDate(slots, dateValue, earliestAt) {
  const numeric = Number(earliestAt)
  const parsed = earliestAt ? new Date(earliestAt).getTime() : 0
  const earliest = Number.isFinite(numeric) && numeric > 0
    ? numeric
    : (Number.isFinite(parsed) ? parsed : 0)
  return (slots || []).filter((slot) => !earliest || slotStartTimestamp(dateValue, slot) >= earliest)
}

function buildPickerDateOptions(minDate, maxDate, slots, earliestAt, selectedDate) {
  const result = []
  if (!minDate || !maxDate) return result

  const todayValue = formatDate(new Date())
  let cursor = dateFromValue(minDate)
  const end = dateFromValue(maxDate)
  let guard = 0

  while (cursor.getTime() <= end.getTime() && guard < 370) {
    const value = formatDate(cursor)
    if (availableSlotsForDate(slots, value, earliestAt).length) {
      result.push({
        value,
        label: formatPickerDateLabel(value, todayValue),
        selected: value === selectedDate
      })
    }
    cursor = addDays(cursor, 1)
    guard += 1
  }

  return result
}

function buildPickerSlotOptions(slots, dateValue, earliestAt, selectedSlot) {
  return availableSlotsForDate(slots, dateValue, earliestAt).map((value) => ({
    value,
    selected: value === selectedSlot
  }))
}

function formatDeliveryTimeText(dateValue, slotValue) {
  if (!dateValue || !slotValue) return '请选择时间'
  return `${formatPickerDateLabel(dateValue, formatDate(new Date()))}  ${slotValue}`
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
      pickupLocations: [],
      deliverySlots: [],
      coupons: []
    },
    address: null,
    deliveryMethodId: 'delivery',
    pickupLocationId: '',
    pickupLocation: null,
    deliveryDate: '',
    deliverySlot: '',
    deliverySlotIndex: 0,
    deliveryTimeText: '请选择时间',
    deliveryPickerVisible: false,
    deliveryPickerDates: [],
    deliveryPickerSlots: [],
    pendingDeliveryDate: '',
    pendingDeliverySlot: '',
    minDate: '',
    earliestDeliveryTime: '',
    earliestDeliveryAt: '',
    maxDate: '',
    cardMessage: '',
    buyerMessage: '',
    selectedCouponId: '',
    selectedCoupon: null,
    preview: null
  },

  onLoad() {
    this.setData({
      ...buildLayout(),
      minDate: formatDate(new Date()),
      maxDate: maxDate(30),
      deliveryDate: formatDate(new Date()),
      earliestDeliveryTime: getEarliestDeliveryTime()
    })

    this.initialize()
  },

  onShow() {
    const selected = wx.getStorageSync('huayu_selected_address_v1')

    if (selected && selected._id) {
      wx.removeStorageSync('huayu_selected_address_v1')
      this.setData({ address: selected })
      if (this.data.deliveryMethodId === 'delivery') this.refreshPreview()
    }

    const selectedCoupon = wx.getStorageSync('huayu_selected_coupon_v1')
    if (selectedCoupon && selectedCoupon._id) {
      wx.removeStorageSync('huayu_selected_coupon_v1')
      this.setData({
        selectedCouponId: selectedCoupon._id,
        selectedCoupon
      })
      if (this.data.draft) this.refreshPreview()
    } else if (selectedCoupon && selectedCoupon.clear === true) {
      wx.removeStorageSync('huayu_selected_coupon_v1')
      this.setData({ selectedCouponId: '', selectedCoupon: null })
      if (this.data.draft) this.refreshPreview()
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

    try {
      const [options, addresses] = await Promise.all([
        getCheckoutOptions(draft.items),
        listAddresses()
      ])

      const deliveryMethods = (options.deliveryMethods || []).map((item) => ({
        ...item,
        name: item.id === 'pickup' ? '到店自取' : '配送到家',
        description: item.id === 'pickup' ? '免配送费，自行到店领取' : '配送至指定收货地址'
      }))
      const pickupLocations = options.pickupLocations || []
      const requestedMethodId = String(draft.deliveryMethodId || 'delivery')
      const deliveryMethodId = deliveryMethods.some((item) => item.id === requestedMethodId)
        ? requestedMethodId
        : 'delivery'
      const pickupLocation = pickupLocations[0] || null
      const deliverySlots = options.deliverySlots || []
      const coupons = options.coupons || []
      const recommendedCouponId = String(draft.couponId || options.recommendedCouponId || '')
      const selectedCoupon = coupons.find((item) => item._id === recommendedCouponId && item.canUse) || null
      const constraints = options.deliveryConstraints || {}
      const draftDate = /^\d{4}-\d{2}-\d{2}$/.test(String(draft.deliveryDate || ''))
        ? String(draft.deliveryDate)
        : formatDate(new Date())
      const draftSlot = deliverySlots.includes(String(draft.deliverySlot || ''))
        ? String(draft.deliverySlot)
        : (deliverySlots[0] || '')
      const minDeliveryDate = constraints.minDate || this.data.minDate
      const maxDeliveryDate = constraints.maxDate || this.data.maxDate
      const selection = normalizeDeliverySelection({
        slots: deliverySlots,
        draftDate,
        draftSlot,
        minDate: minDeliveryDate,
        maxDate: maxDeliveryDate,
        earliestAt: constraints.earliestAt
      })

      this.setData({
        draft,
        options: {
          ...options,
          deliveryMethods,
          pickupLocations,
          deliverySlots,
          coupons
        },
        selectedCouponId: selectedCoupon && selectedCoupon._id || '',
        selectedCoupon,
        deliveryMethodId,
        pickupLocationId: pickupLocation && pickupLocation.id || '',
        pickupLocation,
        address: addresses.defaultAddress || null,
        minDate: minDeliveryDate,
        maxDate: maxDeliveryDate,
        earliestDeliveryAt: constraints.earliestAt || '',
        earliestDeliveryTime: constraints.earliestAt
          ? formatDateTime(new Date(constraints.earliestAt))
          : this.data.earliestDeliveryTime,
        deliveryDate: selection.date,
        deliverySlot: selection.slot,
        deliverySlotIndex: selection.index,
        deliveryTimeText: formatDeliveryTimeText(selection.date, selection.slot),
        cardMessage: String(draft.cardMessage || ''),
        buyerMessage: String(draft.buyerMessage || ''),
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
      addressId: this.data.deliveryMethodId === 'delivery'
        ? this.data.address && this.data.address._id || ''
        : '',
      deliveryMethodId: this.data.deliveryMethodId,
      pickupLocationId: this.data.deliveryMethodId === 'pickup'
        ? this.data.pickupLocationId
        : '',
      deliveryDate: this.data.deliveryDate,
      deliverySlot: this.data.deliverySlot,
      cardMessage: this.data.cardMessage,
      buyerMessage: this.data.buyerMessage,
      couponId: this.data.selectedCouponId
    }
  },

  async refreshPreview() {
    if (!this.data.draft || this.data.loading) return

    try {
      const preview = await previewOrder(this.buildPayload())
      this.setData({
        preview,
        selectedCoupon: preview.selectedCoupon || null,
        selectedCouponId: preview.selectedCoupon && preview.selectedCoupon._id || '',
        pickupLocation: preview.pickupLocation || this.data.pickupLocation,
        pickupLocationId: preview.pickupLocation && preview.pickupLocation.id || this.data.pickupLocationId
      })
    } catch (error) {
      console.error('订单预览失败：', error)
      wx.showToast({ title: error.message || '订单预览失败', icon: 'none' })
    }
  },

  selectDeliveryMethod(event) {
    const deliveryMethodId = String(event.currentTarget.dataset.id || 'delivery')
    if (deliveryMethodId === this.data.deliveryMethodId) return

    if (deliveryMethodId === 'pickup' && !(this.data.options.pickupLocations || []).length) {
      wx.showToast({ title: '暂时没有可用的自提门店', icon: 'none' })
      return
    }

    const pickupLocation = deliveryMethodId === 'pickup'
      ? (this.data.pickupLocation || this.data.options.pickupLocations[0] || null)
      : this.data.pickupLocation

    this.setData({
      deliveryMethodId,
      pickupLocation,
      pickupLocationId: pickupLocation && pickupLocation.id || ''
    })
    this.refreshPreview()
  },

  chooseAddress() {
    if (this.data.deliveryMethodId !== 'delivery') return
    wx.navigateTo({ url: '/pages/address-list/index?select=1' })
  },

  choosePickupLocation() {
    if (this.data.deliveryMethodId !== 'pickup') return
    const items = this.data.options.pickupLocations || []
    if (!items.length) {
      wx.showToast({ title: '暂时没有可用的自提门店', icon: 'none' })
      return
    }

    wx.showActionSheet({
      itemList: items.map((item) => `${item.name} · ${item.address}`),
      success: (result) => {
        const selected = items[result.tapIndex]
        if (!selected) return
        this.setData({
          pickupLocationId: selected.id,
          pickupLocation: selected
        })
        this.refreshPreview()
      }
    })
  },

  openDeliveryTimePicker() {
    const slots = this.data.options.deliverySlots || []
    const dateOptions = buildPickerDateOptions(
      this.data.minDate,
      this.data.maxDate,
      slots,
      this.data.earliestDeliveryAt,
      this.data.deliveryDate
    )
    const pendingDeliveryDate = dateOptions.some((item) => item.value === this.data.deliveryDate)
      ? this.data.deliveryDate
      : (dateOptions[0] && dateOptions[0].value || '')
    const availableSlots = availableSlotsForDate(slots, pendingDeliveryDate, this.data.earliestDeliveryAt)
    const pendingDeliverySlot = availableSlots.includes(this.data.deliverySlot)
      ? this.data.deliverySlot
      : (availableSlots[0] || '')

    this.setData({
      deliveryPickerVisible: true,
      pendingDeliveryDate,
      pendingDeliverySlot,
      deliveryPickerDates: dateOptions.map((item) => ({ ...item, selected: item.value === pendingDeliveryDate })),
      deliveryPickerSlots: buildPickerSlotOptions(slots, pendingDeliveryDate, this.data.earliestDeliveryAt, pendingDeliverySlot)
    })
  },

  closeDeliveryTimePicker() {
    this.setData({ deliveryPickerVisible: false })
  },

  stopDeliveryPickerTap() {},

  selectPickerDate(event) {
    const pendingDeliveryDate = String(event.currentTarget.dataset.value || '')
    if (!pendingDeliveryDate) return

    const slots = this.data.options.deliverySlots || []
    const availableSlots = availableSlotsForDate(slots, pendingDeliveryDate, this.data.earliestDeliveryAt)
    const pendingDeliverySlot = availableSlots.includes(this.data.pendingDeliverySlot)
      ? this.data.pendingDeliverySlot
      : (availableSlots[0] || '')

    this.setData({
      pendingDeliveryDate,
      pendingDeliverySlot,
      deliveryPickerDates: this.data.deliveryPickerDates.map((item) => ({
        ...item,
        selected: item.value === pendingDeliveryDate
      })),
      deliveryPickerSlots: buildPickerSlotOptions(slots, pendingDeliveryDate, this.data.earliestDeliveryAt, pendingDeliverySlot)
    })
  },

  selectPickerSlot(event) {
    const pendingDeliverySlot = String(event.currentTarget.dataset.value || '')
    if (!pendingDeliverySlot) return

    this.setData({
      pendingDeliverySlot,
      deliveryPickerSlots: this.data.deliveryPickerSlots.map((item) => ({
        ...item,
        selected: item.value === pendingDeliverySlot
      }))
    })
  },

  confirmDeliveryTimePicker() {
    const deliveryDate = this.data.pendingDeliveryDate
    const deliverySlot = this.data.pendingDeliverySlot
    if (!deliveryDate || !deliverySlot) {
      wx.showToast({
        title: this.data.deliveryMethodId === 'pickup'
          ? '请选择自提日期和时段'
          : '请选择配送日期和时段',
        icon: 'none'
      })
      return
    }

    this.setData({
      deliveryPickerVisible: false,
      deliveryDate,
      deliverySlot,
      deliverySlotIndex: Math.max(0, (this.data.options.deliverySlots || []).indexOf(deliverySlot)),
      deliveryTimeText: formatDeliveryTimeText(deliveryDate, deliverySlot)
    })
    this.refreshPreview()
  },

  changeDate(event) {
    const deliveryDate = event.detail.value
    const slots = this.data.options.deliverySlots || []
    const selection = normalizeDeliverySelection({
      slots,
      draftDate: deliveryDate,
      draftSlot: this.data.deliverySlot,
      minDate: this.data.minDate,
      maxDate: this.data.maxDate,
      earliestAt: this.data.earliestDeliveryAt
    })
    this.setData({
      deliveryDate: selection.date,
      deliverySlot: selection.slot,
      deliverySlotIndex: selection.index,
      deliveryTimeText: formatDeliveryTimeText(selection.date, selection.slot)
    })
    this.refreshPreview()
  },

  changeSlot(event) {
    const index = Number(event.detail.value || 0)
    const deliverySlot = this.data.options.deliverySlots[index] || ''
    this.setData({
      deliverySlot,
      deliverySlotIndex: index,
      deliveryTimeText: formatDeliveryTimeText(this.data.deliveryDate, deliverySlot)
    })
    this.refreshPreview()
  },

  chooseCoupon() {
    if (!this.data.draft) return
    wx.setStorageSync('huayu_coupon_select_context_v1', {
      items: this.data.draft.items || [],
      selectedCouponId: this.data.selectedCouponId
    })
    wx.navigateTo({ url: '/pages/coupon-select/index' })
  },

  updateCardMessage(event) {
    const cardMessage = event.detail.value
    this.setData({ cardMessage })
    if (this.data.draft) this.data.draft.cardMessage = cardMessage
  },

  updateBuyerMessage(event) {
    const buyerMessage = event.detail.value
    this.setData({ buyerMessage })
    if (this.data.draft) this.data.draft.buyerMessage = buyerMessage
  },

  async submitOrder() {
    if (this.data.submitting) return

    if (this.data.deliveryMethodId === 'delivery' && !this.data.address) {
      wx.showToast({ title: '请先选择收货地址', icon: 'none' })
      return
    }

    if (this.data.deliveryMethodId === 'pickup' && !this.data.pickupLocationId) {
      wx.showToast({ title: '请选择自提门店', icon: 'none' })
      return
    }

    if (!this.data.deliveryDate || !this.data.deliverySlot) {
      wx.showToast({
        title: this.data.deliveryMethodId === 'pickup'
          ? '请选择预约自提时间'
          : '请选择配送日期和时间',
        icon: 'none'
      })
      return
    }

    this.setData({ submitting: true })

    try {
      const order = await createOrder(this.buildPayload())
      const productIds = (this.data.draft.items || []).map((item) => item.productId)

      removeOrderedItems(productIds)
      clearCheckoutDraft()

      wx.redirectTo({
        url: `/pages/order-detail/index?id=${encodeURIComponent(order._id)}&autoPay=1`
      })
    } catch (error) {
      wx.showToast({ title: error.message || '提交订单失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
