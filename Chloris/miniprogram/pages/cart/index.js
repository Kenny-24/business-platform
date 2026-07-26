const {
  getCart,
  setCart
} = require('../../services/storage')
const {
  fetchHomeData
} = require('../../services/home-data')
const {
  getLayoutMetrics
} = require('../../utils/layout')
const {
  DELIVERY_OPTIONS
} = require('../../data/cart-options')
const {
  listAddresses
} = require('../../services/user-service')
const {
  getCheckoutOptions,
  previewOrder,
  createOrder,
  clearCheckoutDraft,
  removeOrderedItems
} = require('../../services/order-service')

const DELIVERY_KEY =
  'huayu_cart_delivery_v1'
const DELIVERY_DATE_KEY =
  'chloris_cart_delivery_date_v1'
const DELIVERY_SLOT_KEY =
  'chloris_cart_delivery_slot_v1'
const CARD_MESSAGE_KEY =
  'chloris_cart_card_message_v1'
const BUYER_MESSAGE_KEY =
  'chloris_cart_buyer_message_v1'

const DELIVERY_SLOTS = [
  '09:00-12:00',
  '12:00-15:00',
  '15:00-18:00',
  '18:00-20:00'
]

function toNumber(value, fallback = 0) {
  const parsed = Number(value)

  return Number.isFinite(parsed)
    ? parsed
    : fallback
}

function formatFen(value) {
  const yuan =
    Math.max(
      0,
      Math.round(toNumber(value))
    ) / 100

  if (Number.isInteger(yuan)) {
    return String(yuan)
  }

  return yuan
    .toFixed(2)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
}

function formatYuan(value) {
  return formatFen(
    Math.round(
      toNumber(value) * 100
    )
  )
}


function formatDate(date) {
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

function dateInRange(value, minDate, maxDate) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
    && value >= minDate
    && value <= maxDate
}

function deliverySlotStartTimestamp(dateString, slot) {
  const start = String(slot || '').split('-')[0]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateString || '')) || !/^\d{2}:\d{2}$/.test(start)) return 0
  return new Date(`${dateString}T${start}:00+08:00`).getTime()
}

function firstAllowedDeliverySlot(dateString, earliestAt) {
  return DELIVERY_SLOTS.find((slot) => deliverySlotStartTimestamp(dateString, slot) >= earliestAt) || ''
}

function buildInitialDeliverySelection(storedDate, storedSlot) {
  const now = new Date()
  const earliestAt = now.getTime() + 2 * 60 * 60 * 1000
  const today = formatDate(now)
  let minDate = today
  if (!firstAllowedDeliverySlot(minDate, earliestAt)) minDate = formatDate(addDays(now, 1))
  const maxDate = formatDate(addDays(now, 365))
  const date = dateInRange(storedDate, minDate, maxDate) ? storedDate : minDate
  const storedAllowed = DELIVERY_SLOTS.includes(storedSlot) && deliverySlotStartTimestamp(date, storedSlot) >= earliestAt
  const slot = storedAllowed ? storedSlot : (firstAllowedDeliverySlot(date, earliestAt) || DELIVERY_SLOTS[0])
  return { earliestAt, today, minDate, maxDate, date, slot }
}


function normalizeDeliverySelection({
  slots,
  draftDate,
  draftSlot,
  minDate,
  maxDate,
  earliestAt
}) {
  const availableSlots = Array.isArray(slots) && slots.length
    ? slots
    : DELIVERY_SLOTS
  let date = String(draftDate || '')

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < minDate) {
    date = minDate
  }

  if (maxDate && date > maxDate) {
    date = maxDate
  }

  const earliest = new Date(earliestAt || 0).getTime()
  const allowed = availableSlotsForDate(availableSlots, date, earliest)
  const slot = allowed.includes(draftSlot)
    ? draftSlot
    : (allowed[0] || availableSlots[0] || '')

  return {
    date,
    slot,
    index: Math.max(0, availableSlots.indexOf(slot))
  }
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
  return (slots || []).filter((slot) => !earliest || deliverySlotStartTimestamp(dateValue, slot) >= earliest)
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
    label: value,
    selected: value === selectedSlot
  }))
}

function formatDeliveryTimeText(dateValue, slotValue) {
  if (!dateValue || !slotValue) return '请选择时间'
  return `${formatPickerDateLabel(dateValue, formatDate(new Date()))}  ${slotValue}`
}

function deliveryDateText(value, today) {
  if (!value) return '请选择日期'
  if (value === today) return `今天 · ${Number(value.slice(5, 7))}月${Number(value.slice(8, 10))}日`

  const tomorrow = formatDate(addDays(new Date(`${today}T00:00:00`), 1))
  if (value === tomorrow) return `明天 · ${Number(value.slice(5, 7))}月${Number(value.slice(8, 10))}日`

  return `${Number(value.slice(5, 7))}月${Number(value.slice(8, 10))}日`
}

function getProductId(item) {
  return String(
    item && (item.id || item._id) || ''
  )
}

function readStorage(key, fallback) {
  try {
    return wx.getStorageSync(key) || fallback
  } catch (error) {
    return fallback
  }
}

function saveStorage(key, value) {
  try {
    wx.setStorageSync(key, value)
  } catch (error) {
    console.warn(
      '购物车配置保存失败：',
      error
    )
  }
}

function findOption(
  options,
  id,
  fallbackId
) {
  return (
    options.find(
      (item) => item.id === id
    ) ||
    options.find(
      (item) => item.id === fallbackId
    ) ||
    options[0] ||
    {
      id: '',
      name: '',
      description: '',
      feeFen: 0
    }
  )
}

function mergeDeliveryMethods(serverMethods) {
  const serverMap = new Map(
    (Array.isArray(serverMethods) ? serverMethods : [])
      .filter((item) => item && item.id)
      .map((item) => [String(item.id), item])
  )

  return DELIVERY_OPTIONS.map((fallback) => {
    const server = serverMap.get(fallback.id) || {}
    return {
      ...fallback,
      ...server,
      name: fallback.name,
      shortDescription: fallback.shortDescription
    }
  })
}

function buildLayout() {
  const metrics = getLayoutMetrics()
  const width = toNumber(metrics.windowWidth, 375)
  const contentHeight = toNumber(metrics.contentHeight, 520)

  return {
    contentHeight,
    horizontalPadding: toNumber(metrics.horizontalPadding, width <= 350 ? 14 : width >= 768 ? 28 : 18),
    productImageSize: width <= 320
      ? 72
      : width <= 350
        ? 78
        : width >= 768
          ? 104
          : 86,
    deliveryPickerHeight: Math.max(260, Math.min(430, Math.round(contentHeight * 0.52))),
    wideLayout: Boolean(metrics.isWideScreen || width >= 720),
    compactLayout: Boolean(metrics.isSmallScreen || width <= 350),
    narrowLayout: Boolean(metrics.isNarrowScreen || width <= 320)
  }
}

function normalizeCloudProduct(item) {
  const price = Math.max(
    0,
    toNumber(item.price)
  )

  return {
    id: getProductId(item),
    _id: getProductId(item),
    type: String(item.type || ''),
    name: String(item.name || ''),
    image: String(item.image || ''),
    price,
    priceFen: Math.max(
      0,
      Math.round(
        toNumber(
          item.priceFen,
          price * 100
        )
      )
    ),
    unit: String(item.unit || '件'),
    stock: Math.max(
      0,
      Math.round(
        toNumber(item.stock)
      )
    ),
    onSale: item.onSale !== false,
    salesMode: String(item.salesMode || 'spot'),
    deliveryStartDate: String(item.deliveryStartDate || ''),
    deliveryEndDate: String(item.deliveryEndDate || ''),
    festivalCampaignId: String(item.festivalCampaignId || '')
  }
}

Page({
  data: {
    cart: [],
    refresherTriggered: false,
    editing: false,
    syncing: false,
    syncText: '',
    cartTitle: '0件商品',
    allSelected: false,
    selectedCount: 0,
    selectedItemCount: 0,
    goodsTotalFen: 0,
    totalFen: 0,
    goodsTotalText: '0',
    deliveryFeeText: '结算页确认',
    totalText: '0',
    checkoutButtonText: '结算',
    checkoutHint: '确认地址后即可付款',
    submitting: false,
    checkoutLoading: false,
    checkoutOptions: {
      deliveryMethods: [],
      pickupLocations: [],
      deliverySlots: DELIVERY_SLOTS
    },
    address: null,
    pickupLocationId: '',
    pickupLocation: null,
    preview: null,
    cardMessage: '',
    buyerMessage: '',
    deliveryOptions: [],
    selectedDeliveryId: 'delivery',
    selectedDelivery: {
      name: '配送到家',
      description: '请选择预期送达日期与时段'
    },
    deliverySlots: DELIVERY_SLOTS,
    deliverySlotIndex: 0,
    selectedDeliveryDate: '',
    selectedDeliveryDateText: '请选择日期',
    selectedDeliverySlot: DELIVERY_SLOTS[0],
    minDeliveryDate: '',
    maxDeliveryDate: '',
    earliestDeliveryAt: 0,
    sameDaySelected: true,
    selectedDeliveryTimeText: '请选择配送时间',
    deliveryPickerVisible: false,
    deliveryPickerDates: [],
    deliveryPickerSlots: [],
    pendingDeliveryDate: '',
    pendingDeliverySlot: '',
    contentHeight: 520,
    horizontalPadding: 18,
    productImageSize: 88,
    wideLayout: false,
    compactLayout: false,
    narrowLayout: false,
    deliveryPickerHeight: 320
  },

  onLoad() {
    try { wx.removeStorageSync('huayu_cart_packaging_v1') } catch (error) {}
    this.updateLayout()
    this.setData({
      cardMessage: String(readStorage(CARD_MESSAGE_KEY, '') || ''),
      buyerMessage: String(readStorage(BUYER_MESSAGE_KEY, '') || '')
    })
    this.initializeOptions()
  },

  onShow() {
    this.refreshFromStorage()
    this.consumeSelectedAddress()
    this.syncWithBackend().finally(() => {
      this.scheduleCheckoutRefresh(0)
    })
  },

  onResize() {
    this.updateLayout()
  },

  async onCartRefresh() {
    if (this.data.refresherTriggered) return

    this.setData({ refresherTriggered: true })

    try {
      await this.syncWithBackend(true)
    } catch (error) {
      console.error('购物车刷新失败：', error)
      wx.showToast({ title: '刷新失败，请稍后重试', icon: 'none' })
    } finally {
      this.setData({ refresherTriggered: false })
    }
  },

  onCartRefreshRestore() {
    if (this.data.refresherTriggered) {
      this.setData({ refresherTriggered: false })
    }
  },

  onCartRefreshAbort() {
    if (this.data.refresherTriggered) {
      this.setData({ refresherTriggered: false })
    }
  },

  updateLayout() {
    this.setData(buildLayout())
  },

  initializeOptions() {
    const deliveryOptions = DELIVERY_OPTIONS.slice()
    const selectedDeliveryId = readStorage(DELIVERY_KEY, 'delivery')
    const storedDate = String(readStorage(DELIVERY_DATE_KEY, '') || '')
    const storedSlot = String(readStorage(DELIVERY_SLOT_KEY, '') || '')
    const deliverySelection = buildInitialDeliverySelection(storedDate, storedSlot)
    const today = deliverySelection.today
    const maxDeliveryDate = deliverySelection.maxDate
    const selectedDeliveryDate = deliverySelection.date
    const selectedDeliverySlot = deliverySelection.slot

    this.setData({
      deliveryOptions,
      selectedDeliveryId,
      selectedDelivery: findOption(
        deliveryOptions,
        selectedDeliveryId,
        'delivery'
      ),
      deliverySlots: DELIVERY_SLOTS,
      deliverySlotIndex: Math.max(0, DELIVERY_SLOTS.indexOf(selectedDeliverySlot)),
      selectedDeliveryDate,
      selectedDeliveryDateText: deliveryDateText(selectedDeliveryDate, today),
      selectedDeliverySlot,
      selectedDeliveryTimeText: formatDeliveryTimeText(selectedDeliveryDate, selectedDeliverySlot),
      minDeliveryDate: deliverySelection.minDate,
      maxDeliveryDate,
      earliestDeliveryAt: deliverySelection.earliestAt,
      sameDaySelected: selectedDeliveryDate === today
    })

    this.refreshFromStorage()
  },

  prepareCart(source) {
    return source.map((item) => {
      const price = Math.max(
        0,
        toNumber(item.price)
      )
      const quantity = Math.max(
        1,
        Math.round(
          toNumber(item.quantity, 1)
        )
      )
      const stock = Math.max(
        0,
        Math.round(
          toNumber(item.stock)
        )
      )
      const invalid =
        item.invalid === true ||
        item.onSale === false ||
        stock <= 0
      const subtotalFen =
        Math.round(price * 100) *
        quantity

      return {
        ...item,
        id: getProductId(item),
        quantity,
        stock,
        invalid,
        selected:
          invalid
            ? false
            : item.selected !== false,
        price,
        priceText: formatYuan(price),
        subtotalFen,
        subtotalText:
          formatFen(subtotalFen),
        invalidReason:
          item.invalidReason ||
          (invalid
            ? '已下架或售罄'
            : ''),
        lowStock:
          !invalid &&
          stock > 0 &&
          stock <= 5
      }
    })
  },

  refreshFromStorage() {
    const cart = this.prepareCart(
      getCart()
    )
    const selectedItems =
      cart.filter(
        (item) =>
          item.selected &&
          !item.invalid
      )
    const validItems =
      cart.filter(
        (item) => !item.invalid
      )
    const goodsTotalFen =
      selectedItems.reduce(
        (sum, item) =>
          sum + item.subtotalFen,
        0
      )
    const selectedCount =
      selectedItems.reduce(
        (sum, item) =>
          sum + item.quantity,
        0
      )
    const selectedItemCount =
      selectedItems.length
    const preview = this.data.preview
    const previewTotalText = preview && preview.amounts
      ? String(preview.amounts.totalAmountText || '')
      : ''
    const deliveryFeeFen = preview && preview.amounts
      ? Number(preview.amounts.deliveryFeeFen || 0)
      : 0
    const deliveryFeeText = this.data.selectedDeliveryId === 'pickup'
      ? '无需配送费'
      : preview
        ? deliveryFeeFen > 0
          ? `¥${preview.amounts.deliveryFeeText}`
          : '按地址核算'
        : this.data.address
          ? '正在核算'
          : '选择地址后计算'

    this.setData({
      cart,
      cartTitle:
        `${cart.length}件商品`,
      selectedCount,
      selectedItemCount,
      allSelected:
        validItems.length > 0 &&
        validItems.every(
          (item) => item.selected
        ),
      goodsTotalFen,
      totalFen: preview && preview.amounts
        ? Number(preview.amounts.totalAmountFen || goodsTotalFen)
        : goodsTotalFen,
      goodsTotalText:
        formatFen(goodsTotalFen),
      deliveryFeeText,
      totalText:
        previewTotalText || formatFen(goodsTotalFen),
      checkoutButtonText:
        this.data.submitting
          ? '处理中…'
          : this.data.editing
            ? selectedItemCount > 0
              ? `删除 ${selectedItemCount} 件`
              : '删除'
            : '结算',
      checkoutHint:
        this.data.editing
          ? '选择需要删除的商品'
          : this.data.selectedDeliveryDate && this.data.selectedDeliverySlot
            ? `${this.data.selectedDeliveryDateText} ${this.data.selectedDeliverySlot}`
            : '请选择预期送达时间',
      selectedDelivery:
        findOption(
          this.data.deliveryOptions,
          this.data.selectedDeliveryId,
          'delivery'
        )
    })

    this.scheduleCheckoutRefresh()
  },

  async syncWithBackend(
    forceRefresh = false
  ) {
    const localCart = getCart()

    if (
      !localCart.length ||
      this.data.syncing
    ) {
      return
    }

    this.setData({
      syncing: true,
      syncText: '正在更新'
    })

    try {
      const result =
        await fetchHomeData({
          forceRefresh
        })
      const cloudProducts =
        (result.products || [])
          .map(normalizeCloudProduct)
      const productMap =
        new Map(
          cloudProducts.map(
            (item) => [item.id, item]
          )
        )

      let adjusted = false
      let priceChanged = false

      const nextCart =
        localCart.map((storedItem) => {
          const id =
            getProductId(storedItem)
          const latest =
            productMap.get(id)

          if (!latest) {
            adjusted = true

            return {
              ...storedItem,
              id,
              selected: false,
              invalid: true,
              invalidReason:
                '已下架或售罄',
              onSale: false,
              stock: 0
            }
          }

          const oldPrice =
            toNumber(storedItem.price)
          const oldQuantity =
            Math.max(
              1,
              Math.round(
                toNumber(
                  storedItem.quantity,
                  1
                )
              )
            )
          const quantity =
            Math.max(
              1,
              Math.min(
                oldQuantity,
                latest.stock
              )
            )
          const didPriceChange =
            Math.abs(
              oldPrice - latest.price
            ) > 0.0001

          if (
            didPriceChange ||
            quantity !== oldQuantity
          ) {
            adjusted = true
          }

          if (didPriceChange) {
            priceChanged = true
          }

          return {
            ...storedItem,
            ...latest,
            id,
            quantity,
            selected:
              storedItem.selected !== false,
            invalid: false,
            invalidReason: '',
            priceChanged:
              didPriceChange
          }
        })

      setCart(nextCart)
      this.refreshFromStorage()

      this.setData({
        syncText:
          adjusted
            ? '已按最新库存更新'
            : '价格与库存已更新'
      })

      if (priceChanged) {
        wx.showToast({
          title: '部分商品价格已更新',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error(
        '购物车数据更新失败：',
        error
      )

      this.setData({
        syncText: '暂未完成更新'
      })
    } finally {
      this.setData({
        syncing: false
      })
    }
  },

  toggleEdit() {
    this.setData({
      editing: !this.data.editing
    })

    this.refreshFromStorage()
  },

  toggleItem(event) {
    const id = String(
      event.currentTarget.dataset.id || ''
    )
    const cart = getCart()
    const index =
      cart.findIndex(
        (item) =>
          getProductId(item) === id
      )

    if (index < 0) return

    const current =
      this.prepareCart([cart[index]])[0]

    if (current.invalid) {
      wx.showToast({
        title:
          current.invalidReason ||
          '该商品暂不可购买',
        icon: 'none'
      })
      return
    }

    cart[index] = {
      ...cart[index],
      selected:
        cart[index].selected === false
    }

    setCart(cart)
    this.refreshFromStorage()
  },

  toggleAll() {
    const target =
      !this.data.allSelected
    const cart =
      getCart().map((item) => {
        const current =
          this.prepareCart([item])[0]

        return {
          ...item,
          selected:
            current.invalid
              ? false
              : target
        }
      })

    setCart(cart)
    this.refreshFromStorage()
  },

  changeQty(event) {
    const id = String(
      event.currentTarget.dataset.id || ''
    )
    const delta = toNumber(
      event.currentTarget.dataset.delta
    )
    const cart = getCart()
    const index =
      cart.findIndex(
        (item) =>
          getProductId(item) === id
      )

    if (index < 0) return

    const current =
      this.prepareCart([cart[index]])[0]

    if (current.invalid) {
      wx.showToast({
        title:
          current.invalidReason ||
          '该商品暂不可购买',
        icon: 'none'
      })
      return
    }

    const next =
      current.quantity + delta

    if (
      delta > 0 &&
      next > current.stock
    ) {
      wx.showToast({
        title:
          `库存仅剩${current.stock}${current.unit}`,
        icon: 'none'
      })
      return
    }

    cart[index] = {
      ...cart[index],
      quantity:
        Math.max(
          1,
          Math.min(
            current.stock,
            next
          )
        )
    }

    setCart(cart)
    this.refreshFromStorage()
  },

  removeOne(event) {
    const id = String(
      event.currentTarget.dataset.id || ''
    )

    wx.showModal({
      title: '删除商品',
      content:
        '确定从购物车中删除这件商品吗？',
      confirmText: '删除',
      confirmColor: '#6f8050',
      success: (result) => {
        if (!result.confirm) return

        setCart(
          getCart().filter(
            (item) =>
              getProductId(item) !== id
          )
        )

        this.refreshFromStorage()
      }
    })
  },

  removeSelected() {
    const ids =
      new Set(
        this.data.cart
          .filter(
            (item) => item.selected
          )
          .map((item) => item.id)
      )

    if (!ids.size) {
      wx.showToast({
        title: '请选择商品',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '删除商品',
      content:
        `确定删除已选择的${ids.size}件商品吗？`,
      confirmText: '删除',
      confirmColor: '#6f8050',
      success: (result) => {
        if (!result.confirm) return

        setCart(
          getCart().filter(
            (item) =>
              !ids.has(
                getProductId(item)
              )
          )
        )

        this.setData({
          editing: false
        })
        this.refreshFromStorage()
      }
    })
  },


  getSelectedOrderItems() {
    return (this.data.cart || [])
      .filter((item) => item.selected && !item.invalid)
      .map((item) => ({
        productId: String(item.id || item._id || ''),
        quantity: Number(item.quantity || 1)
      }))
      .filter((item) => item.productId)
  },

  consumeSelectedAddress() {
    let selected = null

    try {
      selected = wx.getStorageSync('huayu_selected_address_v1')
      if (selected && selected._id) {
        wx.removeStorageSync('huayu_selected_address_v1')
      }
    } catch (error) {}

    if (!selected || !selected._id) return

    this.setData({
      address: selected,
      preview: null
    })
    this.refreshOrderPreview()
  },

  scheduleCheckoutRefresh(delay = 220) {
    if (this._checkoutTimer) {
      clearTimeout(this._checkoutTimer)
    }

    this._checkoutTimer = setTimeout(() => {
      this.loadCheckoutContext()
    }, Math.max(0, Number(delay) || 0))
  },

  async loadCheckoutContext() {
    const items = this.getSelectedOrderItems()

    if (!items.length) {
      this.setData({
        preview: null,
        checkoutLoading: false,
        deliveryFeeText: this.data.selectedDeliveryId === 'pickup'
          ? '无需配送费'
          : '选择地址后计算'
      })
      return
    }

    const requestId = Date.now() + Math.random()
    this._checkoutRequestId = requestId
    this.setData({ checkoutLoading: true })

    try {
      const [optionsResult, addressesResult] = await Promise.all([
        getCheckoutOptions(items),
        listAddresses()
      ])

      if (this._checkoutRequestId !== requestId) return

      const deliveryMethods = mergeDeliveryMethods(optionsResult.deliveryMethods)
      const pickupLocations = Array.isArray(optionsResult.pickupLocations)
        ? optionsResult.pickupLocations
        : []
      const deliverySlots = Array.isArray(optionsResult.deliverySlots) && optionsResult.deliverySlots.length
        ? optionsResult.deliverySlots
        : DELIVERY_SLOTS
      const constraints = optionsResult.deliveryConstraints || {}
      const selectedDeliveryId = deliveryMethods.some((item) => item.id === this.data.selectedDeliveryId)
        ? this.data.selectedDeliveryId
        : 'delivery'
      const addressItems = Array.isArray(addressesResult.items)
        ? addressesResult.items
        : []
      const currentAddressId = this.data.address && this.data.address._id
      const address = addressItems.find((item) => item._id === currentAddressId)
        || this.data.address
        || addressesResult.defaultAddress
        || null
      const pickupLocation = pickupLocations.find((item) => item.id === this.data.pickupLocationId)
        || this.data.pickupLocation
        || pickupLocations[0]
        || null
      const minDate = String(constraints.minDate || this.data.minDeliveryDate || formatDate(new Date()))
      const maxDate = String(constraints.maxDate || this.data.maxDeliveryDate || formatDate(addDays(new Date(), 365)))
      const earliestAt = constraints.earliestAt || this.data.earliestDeliveryAt
      const selection = normalizeDeliverySelection({
        slots: deliverySlots,
        draftDate: this.data.selectedDeliveryDate,
        draftSlot: this.data.selectedDeliverySlot,
        minDate,
        maxDate,
        earliestAt
      })
      const today = formatDate(new Date())

      this.setData({
        checkoutOptions: {
          ...optionsResult,
          deliveryMethods,
          pickupLocations,
          deliverySlots
        },
        deliveryOptions: deliveryMethods,
        deliverySlots,
        selectedDeliveryId,
        selectedDelivery: findOption(deliveryMethods, selectedDeliveryId, 'delivery'),
        address,
        pickupLocation,
        pickupLocationId: pickupLocation && pickupLocation.id || '',
        minDeliveryDate: minDate,
        maxDeliveryDate: maxDate,
        earliestDeliveryAt: earliestAt,
        selectedDeliveryDate: selection.date,
        selectedDeliveryDateText: deliveryDateText(selection.date, today),
        selectedDeliverySlot: selection.slot,
        selectedDeliveryTimeText: formatDeliveryTimeText(selection.date, selection.slot),
        deliverySlotIndex: selection.index,
        sameDaySelected: selection.date === today,
        checkoutLoading: false
      })

      await this.refreshOrderPreview()
    } catch (error) {
      if (this._checkoutRequestId !== requestId) return
      console.error('购物车结算信息加载失败：', error)
      this.setData({ checkoutLoading: false })
    }
  },

  buildOrderPayload() {
    return {
      items: this.getSelectedOrderItems(),
      addressId: this.data.selectedDeliveryId === 'delivery'
        ? this.data.address && this.data.address._id || ''
        : '',
      deliveryMethodId: this.data.selectedDeliveryId,
      pickupLocationId: this.data.selectedDeliveryId === 'pickup'
        ? this.data.pickupLocationId
        : '',
      deliveryDate: this.data.selectedDeliveryDate,
      deliverySlot: this.data.selectedDeliverySlot,
      cardMessage: String(this.data.cardMessage || '').trim().slice(0, 120),
      buyerMessage: String(this.data.buyerMessage || '').trim().slice(0, 200)
    }
  },

  async refreshOrderPreview() {
    const items = this.getSelectedOrderItems()

    if (!items.length) return

    if (this.data.selectedDeliveryId === 'delivery' && !this.data.address) {
      this.setData({
        preview: null,
        deliveryFeeText: '选择地址后计算',
        totalText: this.data.goodsTotalText
      })
      return
    }

    if (this.data.selectedDeliveryId === 'pickup' && !this.data.pickupLocationId) {
      this.setData({
        preview: null,
        deliveryFeeText: '请选择自提门店',
        totalText: this.data.goodsTotalText
      })
      return
    }

    const requestId = Date.now() + Math.random()
    this._previewRequestId = requestId

    try {
      const preview = await previewOrder(this.buildOrderPayload())
      if (this._previewRequestId !== requestId) return

      const deliveryFeeFen = Number(preview.amounts && preview.amounts.deliveryFeeFen || 0)
      this.setData({
        preview,
        pickupLocation: preview.pickupLocation || this.data.pickupLocation,
        pickupLocationId: preview.pickupLocation && preview.pickupLocation.id || this.data.pickupLocationId,
        deliveryFeeText: this.data.selectedDeliveryId === 'pickup'
          ? '无需配送费'
          : deliveryFeeFen > 0
            ? `¥${preview.amounts.deliveryFeeText}`
            : '按地址核算',
        totalFen: Number(preview.amounts && preview.amounts.totalAmountFen || this.data.goodsTotalFen),
        totalText: String(preview.amounts && preview.amounts.totalAmountText || this.data.goodsTotalText)
      })
    } catch (error) {
      if (this._previewRequestId !== requestId) return
      console.error('购物车订单金额核算失败：', error)
      this.setData({
        preview: null,
        deliveryFeeText: this.data.selectedDeliveryId === 'pickup'
          ? '无需配送费'
          : this.data.address
            ? '暂未核算'
            : '选择地址后计算',
        totalText: this.data.goodsTotalText
      })
    }
  },

  chooseAddress() {
    if (this.data.selectedDeliveryId !== 'delivery') return
    wx.navigateTo({
      url: '/pages/address-list/index?select=1'
    })
  },

  choosePickupLocation() {
    if (this.data.selectedDeliveryId !== 'pickup') return

    const items = this.data.checkoutOptions.pickupLocations || []
    if (!items.length) {
      wx.showToast({
        title: '暂时没有可用的自提门店',
        icon: 'none'
      })
      return
    }

    wx.showActionSheet({
      itemList: items.map((item) => `${item.name} · ${item.address}`),
      success: (result) => {
        const selected = items[result.tapIndex]
        if (!selected) return

        this.setData({
          pickupLocationId: selected.id,
          pickupLocation: selected,
          preview: null
        })
        this.refreshOrderPreview()
      }
    })
  },

  updateCardMessage(event) {
    const cardMessage = String(event.detail.value || '').slice(0, 120)
    this.setData({ cardMessage })
    saveStorage(CARD_MESSAGE_KEY, cardMessage)
  },

  updateBuyerMessage(event) {
    const buyerMessage = String(event.detail.value || '').slice(0, 200)
    this.setData({ buyerMessage })
    saveStorage(BUYER_MESSAGE_KEY, buyerMessage)
  },


  openDeliveryTimePicker() {
    const slots = this.data.deliverySlots || DELIVERY_SLOTS
    const dateOptions = buildPickerDateOptions(
      this.data.minDeliveryDate,
      this.data.maxDeliveryDate,
      slots,
      this.data.earliestDeliveryAt,
      this.data.selectedDeliveryDate
    )
    const pendingDate = dateOptions.some((item) => item.value === this.data.selectedDeliveryDate)
      ? this.data.selectedDeliveryDate
      : (dateOptions[0] && dateOptions[0].value || '')
    const availableSlots = availableSlotsForDate(slots, pendingDate, this.data.earliestDeliveryAt)
    const pendingSlot = availableSlots.includes(this.data.selectedDeliverySlot)
      ? this.data.selectedDeliverySlot
      : (availableSlots[0] || '')

    this.setData({
      deliveryPickerVisible: true,
      pendingDeliveryDate: pendingDate,
      pendingDeliverySlot: pendingSlot,
      deliveryPickerDates: dateOptions.map((item) => ({ ...item, selected: item.value === pendingDate })),
      deliveryPickerSlots: buildPickerSlotOptions(slots, pendingDate, this.data.earliestDeliveryAt, pendingSlot)
    })
  },

  closeDeliveryTimePicker() {
    this.setData({ deliveryPickerVisible: false })
  },

  stopDeliveryPickerTap() {},

  selectPickerDate(event) {
    const pendingDeliveryDate = String(event.currentTarget.dataset.value || '')
    if (!pendingDeliveryDate) return

    const slots = this.data.deliverySlots || DELIVERY_SLOTS
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
    const selectedDeliveryDate = this.data.pendingDeliveryDate
    const selectedDeliverySlot = this.data.pendingDeliverySlot
    if (!selectedDeliveryDate || !selectedDeliverySlot) {
      wx.showToast({ title: '请选择配送日期和时段', icon: 'none' })
      return
    }

    saveStorage(DELIVERY_DATE_KEY, selectedDeliveryDate)
    saveStorage(DELIVERY_SLOT_KEY, selectedDeliverySlot)

    const today = formatDate(new Date())
    this.setData({
      deliveryPickerVisible: false,
      selectedDeliveryDate,
      selectedDeliveryDateText: deliveryDateText(selectedDeliveryDate, today),
      selectedDeliverySlot,
      selectedDeliveryTimeText: formatDeliveryTimeText(selectedDeliveryDate, selectedDeliverySlot),
      deliverySlotIndex: Math.max(0, DELIVERY_SLOTS.indexOf(selectedDeliverySlot)),
      sameDaySelected: selectedDeliveryDate === today
    })
    this.refreshFromStorage()
    this.refreshOrderPreview()
  },

  changeExpectedDeliveryDate(event) {
    const selectedDeliveryDate = String(event.detail.value || '')
    const minDate = this.data.minDeliveryDate || formatDate(new Date())
    const today = formatDate(new Date())

    if (!dateInRange(selectedDeliveryDate, minDate, this.data.maxDeliveryDate)) {
      wx.showToast({ title: '请选择可预约日期', icon: 'none' })
      return
    }

    let selectedDeliverySlot = this.data.selectedDeliverySlot
    if (deliverySlotStartTimestamp(selectedDeliveryDate, selectedDeliverySlot) < this.data.earliestDeliveryAt) {
      selectedDeliverySlot = firstAllowedDeliverySlot(selectedDeliveryDate, this.data.earliestDeliveryAt) || DELIVERY_SLOTS[0]
    }
    saveStorage(DELIVERY_DATE_KEY, selectedDeliveryDate)
    saveStorage(DELIVERY_SLOT_KEY, selectedDeliverySlot)
    this.setData({
      selectedDeliveryDate,
      selectedDeliveryDateText: deliveryDateText(selectedDeliveryDate, today),
      selectedDeliverySlot,
      selectedDeliveryTimeText: formatDeliveryTimeText(selectedDeliveryDate, selectedDeliverySlot),
      deliverySlotIndex: Math.max(0, DELIVERY_SLOTS.indexOf(selectedDeliverySlot)),
      sameDaySelected: selectedDeliveryDate === today
    })
    this.refreshFromStorage()
    this.refreshOrderPreview()
  },

  changeExpectedDeliverySlot(event) {
    const index = Number(event.detail.value || 0)
    const selectedDeliverySlot = DELIVERY_SLOTS[index] || DELIVERY_SLOTS[0]
    if (deliverySlotStartTimestamp(this.data.selectedDeliveryDate, selectedDeliverySlot) < this.data.earliestDeliveryAt) {
      wx.showToast({ title: this.data.selectedDeliveryId === 'pickup' ? '自提时间至少需晚于下单时间2小时' : '配送时间至少需晚于下单时间2小时', icon: 'none' })
      return
    }

    saveStorage(DELIVERY_SLOT_KEY, selectedDeliverySlot)
    this.setData({
      selectedDeliverySlot,
      selectedDeliveryTimeText: formatDeliveryTimeText(this.data.selectedDeliveryDate, selectedDeliverySlot),
      deliverySlotIndex: Math.max(0, DELIVERY_SLOTS.indexOf(selectedDeliverySlot))
    })
    this.refreshFromStorage()
    this.refreshOrderPreview()
  },

  selectDeliveryMethod(event) {
    const selectedDeliveryId = String(event.currentTarget.dataset.id || 'delivery')
    const selectedDelivery = findOption(
      this.data.deliveryOptions,
      selectedDeliveryId,
      'delivery'
    )

    if (!selectedDelivery || !selectedDelivery.id) return

    if (
      selectedDeliveryId === 'pickup' &&
      !(this.data.checkoutOptions.pickupLocations || []).length
    ) {
      wx.showToast({
        title: '暂时没有可用的自提门店',
        icon: 'none'
      })
      return
    }

    const pickupLocation = selectedDeliveryId === 'pickup'
      ? (this.data.pickupLocation || this.data.checkoutOptions.pickupLocations[0] || null)
      : this.data.pickupLocation

    saveStorage(DELIVERY_KEY, selectedDelivery.id)
    this.setData({
      selectedDeliveryId: selectedDelivery.id,
      selectedDelivery,
      pickupLocation,
      pickupLocationId: pickupLocation && pickupLocation.id || '',
      preview: null
    })
    this.refreshFromStorage()
    this.refreshOrderPreview()
  },

  chooseDelivery() {
    const items = this.data.deliveryOptions || []
    wx.showActionSheet({
      itemList: items.map((item) => item.name),
      success: (result) => {
        const selected = items[result.tapIndex]
        if (!selected) return
        saveStorage(DELIVERY_KEY, selected.id)
        this.setData({
          selectedDeliveryId: selected.id,
          selectedDelivery: selected
        })
        this.refreshFromStorage()
      }
    })
  },


  openProductDetail(event) {
    const id = String(event.currentTarget.dataset.id || '').trim()

    if (!id) {
      wx.showToast({
        title: '商品信息不存在',
        icon: 'none'
      })
      return
    }

    wx.navigateTo({
      url: `/pages/product-detail/index?id=${encodeURIComponent(id)}`
    })
  },


  goShopping() {
    wx.switchTab({
      url: '/pages/category/index'
    })
  },

  async checkout() {
    if (this.data.editing) {
      this.removeSelected()
      return
    }

    if (this.data.submitting) return

    const items = this.getSelectedOrderItems()

    if (!items.length) {
      wx.showToast({
        title: '请选择商品',
        icon: 'none'
      })
      return
    }

    if (this.data.selectedDeliveryId === 'delivery' && !this.data.address) {
      wx.showToast({
        title: '请先选择收货地址',
        icon: 'none'
      })
      this.chooseAddress()
      return
    }

    if (this.data.selectedDeliveryId === 'pickup' && !this.data.pickupLocationId) {
      wx.showToast({
        title: '请选择自提门店',
        icon: 'none'
      })
      return
    }

    if (!this.data.selectedDeliveryDate || !this.data.selectedDeliverySlot) {
      wx.showToast({
        title: this.data.selectedDeliveryId === 'pickup'
          ? '请选择预约自提时间'
          : '请选择预期送达时间',
        icon: 'none'
      })
      return
    }

    this.setData({
      submitting: true,
      checkoutButtonText: '处理中…'
    })

    try {
      const order = await createOrder(this.buildOrderPayload())
      const productIds = items.map((item) => item.productId)

      removeOrderedItems(productIds)
      clearCheckoutDraft()
      saveStorage(CARD_MESSAGE_KEY, '')
      saveStorage(BUYER_MESSAGE_KEY, '')

      this.setData({
        cardMessage: '',
        buyerMessage: ''
      })

      wx.redirectTo({
        url: `/pages/order-detail/index?id=${encodeURIComponent(order._id)}&autoPay=1`
      })
    } catch (error) {
      wx.showToast({
        title: error.message || '创建订单失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      this.setData({
        submitting: false,
        checkoutButtonText: '结算'
      })
    }
  }
})
