const {
  getCart,
  setCart,
  getPoints
} = require('../../services/storage')
const {
  fetchHomeData
} = require('../../services/home-data')
const {
  getLayoutMetrics
} = require('../../utils/layout')
const {
  PACKAGING_OPTIONS,
  DELIVERY_OPTIONS
} = require('../../data/cart-options')

const PACKAGING_KEY =
  'huayu_cart_packaging_v1'
const DELIVERY_KEY =
  'huayu_cart_delivery_v1'

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

function enabledOptions(options) {
  return options
    .filter((item) => item.enabled !== false)
    .sort(
      (a, b) =>
        toNumber(b.sort) -
        toNumber(a.sort)
    )
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

function buildLayout() {
  const metrics = getLayoutMetrics()
  const width = toNumber(
    metrics.windowWidth,
    375
  )

  return {
    contentHeight:
      metrics.contentHeight,
    horizontalPadding:
      width <= 350
        ? 14
        : width >= 768
          ? 28
          : 18,
    productImageSize:
      width <= 350
        ? 78
        : width >= 768
          ? 108
          : 88,
    wideLayout:
      width >= 720,
    compactLayout:
      width <= 350
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
    onSale: item.onSale !== false
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
    packagingFeeFen: 0,
    totalFen: 0,
    goodsTotalText: '0',
    packagingFeeText: '免费',
    deliveryFeeText: '结算页确认',
    totalText: '0',
    checkoutButtonText: '去结算',
    checkoutHint: '配送费在结算页确认',
    pointsText: '暂无可用积分',
    packagingOptions: [],
    selectedPackagingId: 'basic',
    selectedPackaging: {
      name: '基础包装',
      description: '简约环保包装',
      feeFen: 0
    },
    deliveryOptions: [],
    selectedDeliveryId: 'delivery',
    selectedDelivery: {
      name: '配送到家',
      description: '地址与配送时段在结算页确认'
    },
    contentHeight: 520,
    horizontalPadding: 18,
    productImageSize: 88,
    wideLayout: false,
    compactLayout: false
  },

  onLoad() {
    this.updateLayout()
    this.initializeOptions()
  },

  onShow() {
    this.refreshFromStorage()
    this.syncWithBackend()
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
    const packagingOptions =
      enabledOptions(PACKAGING_OPTIONS)
    const deliveryOptions =
      DELIVERY_OPTIONS.slice()

    const selectedPackagingId =
      readStorage(
        PACKAGING_KEY,
        'basic'
      )
    const selectedDeliveryId =
      readStorage(
        DELIVERY_KEY,
        'delivery'
      )

    this.setData({
      packagingOptions,
      deliveryOptions,
      selectedPackagingId,
      selectedPackaging:
        findOption(
          packagingOptions,
          selectedPackagingId,
          'basic'
        ),
      selectedDeliveryId,
      selectedDelivery:
        findOption(
          deliveryOptions,
          selectedDeliveryId,
          'delivery'
        )
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
    const selectedPackaging =
      findOption(
        this.data.packagingOptions,
        this.data.selectedPackagingId,
        'basic'
      )
    const packagingFeeFen =
      selectedItems.length > 0
        ? Math.max(
            0,
            Math.round(
              toNumber(
                selectedPackaging.feeFen
              )
            )
          )
        : 0
    const totalFen =
      goodsTotalFen +
      packagingFeeFen
    const selectedCount =
      selectedItems.reduce(
        (sum, item) =>
          sum + item.quantity,
        0
      )
    const selectedItemCount =
      selectedItems.length
    const points = Math.max(
      0,
      Number(getPoints() || 0)
    )

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
      packagingFeeFen,
      totalFen,
      goodsTotalText:
        formatFen(goodsTotalFen),
      packagingFeeText:
        packagingFeeFen > 0
          ? `¥${formatFen(packagingFeeFen)}`
          : '免费',
      deliveryFeeText:
        this.data.selectedDeliveryId ===
        'pickup'
          ? '免费'
          : '待确认',
      totalText:
        formatFen(totalFen),
      checkoutButtonText:
        this.data.editing
          ? selectedItemCount > 0
            ? `删除 ${selectedItemCount} 件`
            : '删除'
          : selectedCount > 0
            ? `去结算 ${selectedCount} 件`
            : '去结算',
      checkoutHint:
        this.data.editing
          ? '选择需要删除的商品'
          : '配送费在结算页确认',
      pointsText:
        points > 0
          ? `${points}积分`
          : '暂无可用积分',
      selectedPackaging,
      selectedDelivery:
        findOption(
          this.data.deliveryOptions,
          this.data.selectedDeliveryId,
          'delivery'
        )
    })
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

  choosePackaging() {
    const options =
      this.data.packagingOptions

    wx.showActionSheet({
      itemList:
        options.map((item) => {
          const fee =
            item.feeFen > 0
              ? ` ¥${formatFen(item.feeFen)}`
              : ' 免费'

          return `${item.name}${fee}`
        }),
      success: (result) => {
        const selected =
          options[result.tapIndex]

        if (!selected) return

        saveStorage(
          PACKAGING_KEY,
          selected.id
        )

        this.setData({
          selectedPackagingId:
            selected.id,
          selectedPackaging:
            selected
        })

        this.refreshFromStorage()
      }
    })
  },

  chooseDelivery() {
    const options =
      this.data.deliveryOptions

    wx.showActionSheet({
      itemList:
        options.map(
          (item) => item.name
        ),
      success: (result) => {
        const selected =
          options[result.tapIndex]

        if (!selected) return

        saveStorage(
          DELIVERY_KEY,
          selected.id
        )

        this.setData({
          selectedDeliveryId:
            selected.id,
          selectedDelivery:
            selected
        })

        this.refreshFromStorage()
      }
    })
  },

  openPoints() {
    wx.showToast({
      title:
        this.data.pointsText ===
        '暂无可用积分'
          ? '当前暂无可用积分'
          : '积分将在结算页抵扣',
      icon: 'none'
    })
  },

  goShopping() {
    wx.switchTab({
      url: '/pages/category/index'
    })
  },

  checkout() {
    if (this.data.editing) {
      this.removeSelected()
      return
    }

    if (
      this.data.selectedCount <= 0
    ) {
      wx.showToast({
        title: '请选择商品',
        icon: 'none'
      })
      return
    }

    wx.showToast({
      title:
        '结算功能将在订单阶段接入',
      icon: 'none'
    })
  }
})
