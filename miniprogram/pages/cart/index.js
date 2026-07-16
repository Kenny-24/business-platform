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

const PACKAGING_KEY = 'huayu_cart_packaging_v1'
const DELIVERY_KEY = 'huayu_cart_delivery_v1'

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? parsed
    : fallback
}

function moneyFromFen(value) {
  const yuan = Math.max(
    0,
    Math.round(number(value))
  ) / 100

  if (Number.isInteger(yuan)) {
    return String(yuan)
  }

  return yuan
    .toFixed(2)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
}

function moneyFromYuan(value) {
  return moneyFromFen(
    Math.round(
      number(value) * 100
    )
  )
}

function productId(item) {
  return String(
    item && (item.id || item._id) || ''
  )
}

function enabledOptions(options) {
  return options
    .filter((item) => item.enabled !== false)
    .sort(
      (a, b) =>
        number(b.sort) - number(a.sort)
    )
}

function optionById(
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
    null
  )
}

function getStoredValue(key, fallback) {
  try {
    return wx.getStorageSync(key) || fallback
  } catch (error) {
    return fallback
  }
}

function setStoredValue(key, value) {
  try {
    wx.setStorageSync(key, value)
  } catch (error) {
    console.warn(
      '购物车选项保存失败：',
      error
    )
  }
}

function buildLayout() {
  const metrics = getLayoutMetrics()
  const windowWidth = number(
    metrics.windowWidth,
    375
  )

  return {
    contentHeight:
      metrics.contentHeight,
    horizontalPadding:
      windowWidth <= 350
        ? 14
        : windowWidth >= 768
          ? 28
          : 18,
    productImageSize:
      windowWidth <= 350
        ? 82
        : windowWidth >= 768
          ? 118
          : 96,
    wideLayout:
      windowWidth >= 720,
    compactLayout:
      windowWidth <= 350
  }
}

function normalizeCloudProduct(item) {
  return {
    id: productId(item),
    _id: productId(item),
    type: String(item.type || ''),
    name: String(item.name || ''),
    image: String(item.image || ''),
    price: Math.max(
      0,
      number(item.price)
    ),
    priceFen: Math.max(
      0,
      Math.round(
        number(
          item.priceFen,
          number(item.price) * 100
        )
      )
    ),
    unit: String(item.unit || '件'),
    stock: Math.max(
      0,
      Math.round(number(item.stock))
    ),
    onSale: item.onSale !== false
  }
}

Page({
  data: {
    cart: [],
    editing: false,
    syncing: false,
    syncText: '',
    allSelected: false,
    selectedCount: 0,
    validCount: 0,
    goodsTotalFen: 0,
    packagingFeeFen: 0,
    deliveryFeeFen: 0,
    totalFen: 0,
    goodsTotalText: '0',
    packagingFeeText: '0',
    deliveryFeeText: '待确认',
    totalText: '0',
    points: 0,
    pointsText: '暂无可用积分',
    packagingOptions: [],
    selectedPackagingId: 'basic',
    selectedPackaging: null,
    deliveryOptions: [],
    selectedDeliveryId: 'delivery',
    selectedDelivery: null,
    contentHeight: 520,
    horizontalPadding: 18,
    productImageSize: 96,
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

  async onPullDownRefresh() {
    await this.syncWithBackend(true)
    wx.stopPullDownRefresh()
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
      getStoredValue(
        PACKAGING_KEY,
        'basic'
      )
    const selectedDeliveryId =
      getStoredValue(
        DELIVERY_KEY,
        'delivery'
      )

    this.setData({
      packagingOptions,
      deliveryOptions,
      selectedPackagingId,
      selectedPackaging:
        optionById(
          packagingOptions,
          selectedPackagingId,
          'basic'
        ),
      selectedDeliveryId,
      selectedDelivery:
        optionById(
          deliveryOptions,
          selectedDeliveryId,
          'delivery'
        )
    })

    this.refreshFromStorage()
  },

  prepareCart(cart) {
    return cart.map((item) => {
      const price = Math.max(
        0,
        number(item.price)
      )
      const quantity = Math.max(
        1,
        Math.round(
          number(item.quantity, 1)
        )
      )
      const stock = Math.max(
        0,
        Math.round(
          number(item.stock)
        )
      )
      const invalid =
        item.invalid === true ||
        item.onSale === false ||
        stock <= 0

      return {
        ...item,
        id: productId(item),
        quantity,
        stock,
        invalid,
        selected:
          invalid
            ? false
            : item.selected !== false,
        price,
        priceText:
          moneyFromYuan(price),
        subtotalFen:
          Math.round(
            price * 100
          ) * quantity,
        subtotalText:
          moneyFromFen(
            Math.round(
              price * 100
            ) * quantity
          ),
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

    const goodsTotalFen =
      selectedItems.reduce(
        (sum, item) =>
          sum + item.subtotalFen,
        0
      )

    const selectedPackaging =
      optionById(
        this.data.packagingOptions,
        this.data.selectedPackagingId,
        'basic'
      )

    const packagingFeeFen =
      selectedItems.length > 0
        ? Math.max(
            0,
            Math.round(
              number(
                selectedPackaging &&
                selectedPackaging.feeFen
              )
            )
          )
        : 0

    const deliveryFeeFen = 0
    const totalFen =
      goodsTotalFen +
      packagingFeeFen +
      deliveryFeeFen

    const validItems = cart.filter(
      (item) => !item.invalid
    )

    const points = getPoints()

    this.setData({
      cart,
      validCount: validItems.length,
      selectedCount:
        selectedItems.reduce(
          (sum, item) =>
            sum + item.quantity,
          0
        ),
      allSelected:
        validItems.length > 0 &&
        validItems.every(
          (item) => item.selected
        ),
      goodsTotalFen,
      packagingFeeFen,
      deliveryFeeFen,
      totalFen,
      goodsTotalText:
        moneyFromFen(goodsTotalFen),
      packagingFeeText:
        packagingFeeFen > 0
          ? `+¥${moneyFromFen(packagingFeeFen)}`
          : '免费',
      deliveryFeeText:
        this.data.selectedDeliveryId ===
        'pickup'
          ? '免配送费'
          : '结算页确认',
      totalText:
        moneyFromFen(totalFen),
      points,
      pointsText:
        points > 0
          ? `可用 ${points} 积分`
          : '暂无可用积分',
      selectedPackaging,
      selectedDelivery:
        optionById(
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

    if (!localCart.length) {
      this.setData({
        syncing: false,
        syncText: ''
      })
      return
    }

    if (this.data.syncing) return

    this.setData({
      syncing: true,
      syncText: '正在校验价格与库存'
    })

    try {
      const result =
        await fetchHomeData({
          forceRefresh
        })

      const cloudProducts = (
        result.products || []
      ).map(normalizeCloudProduct)

      const productMap = new Map(
        cloudProducts.map(
          (item) => [item.id, item]
        )
      )

      let hasAdjustment = false
      let priceChanged = false

      const nextCart =
        localCart.map((storedItem) => {
          const id =
            productId(storedItem)
          const latest =
            productMap.get(id)

          if (!latest) {
            hasAdjustment = true

            return {
              ...storedItem,
              id,
              selected: false,
              invalid: true,
              invalidReason:
                '商品已下架或售罄',
              onSale: false,
              stock: 0
            }
          }

          const oldPrice =
            number(storedItem.price)
          const oldQuantity =
            Math.max(
              1,
              Math.round(
                number(
                  storedItem.quantity,
                  1
                )
              )
            )
          const nextQuantity =
            Math.min(
              oldQuantity,
              latest.stock
            )
          const didPriceChange =
            Math.abs(
              oldPrice - latest.price
            ) > 0.0001

          if (
            didPriceChange ||
            nextQuantity !== oldQuantity
          ) {
            hasAdjustment = true
          }

          if (didPriceChange) {
            priceChanged = true
          }

          return {
            ...storedItem,
            ...latest,
            id,
            quantity:
              Math.max(
                1,
                nextQuantity
              ),
            selected:
              storedItem.selected !== false,
            invalid: false,
            invalidReason: '',
            priceChanged:
              didPriceChange,
            previousPrice:
              didPriceChange
                ? oldPrice
                : storedItem.previousPrice
          }
        })

      setCart(nextCart)
      this.refreshFromStorage()

      this.setData({
        syncText:
          hasAdjustment
            ? '已按后台最新价格与库存更新'
            : '价格与库存已是最新'
      })

      if (priceChanged) {
        wx.showToast({
          title:
            '部分商品价格已更新',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error(
        '购物车后台校验失败：',
        error
      )

      this.setData({
        syncText:
          '暂未完成后台校验'
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
  },

  toggleItem(event) {
    const id = String(
      event.currentTarget.dataset.id || ''
    )

    const cart = getCart()
    const index = cart.findIndex(
      (item) =>
        productId(item) === id
    )

    if (index < 0) return

    const prepared =
      this.prepareCart([cart[index]])[0]

    if (prepared.invalid) {
      wx.showToast({
        title:
          prepared.invalidReason ||
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

    const cart = getCart().map(
      (item) => {
        const prepared =
          this.prepareCart([item])[0]

        return {
          ...item,
          selected:
            prepared.invalid
              ? false
              : target
        }
      }
    )

    setCart(cart)
    this.refreshFromStorage()
  },

  changeQty(event) {
    const id = String(
      event.currentTarget.dataset.id || ''
    )
    const delta = number(
      event.currentTarget.dataset.delta
    )

    const cart = getCart()
    const index = cart.findIndex(
      (item) =>
        productId(item) === id
    )

    if (index < 0) return

    const prepared =
      this.prepareCart([cart[index]])[0]

    if (prepared.invalid) {
      wx.showToast({
        title:
          prepared.invalidReason ||
          '该商品暂不可购买',
        icon: 'none'
      })
      return
    }

    const requested =
      prepared.quantity + delta

    if (
      delta > 0 &&
      requested > prepared.stock
    ) {
      wx.showToast({
        title:
          `库存仅剩${prepared.stock}${prepared.unit}`,
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
            prepared.stock,
            requested
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
      confirmColor: '#68764b',
      success: (result) => {
        if (!result.confirm) return

        setCart(
          getCart().filter(
            (item) =>
              productId(item) !== id
          )
        )

        this.refreshFromStorage()
      }
    })
  },

  removeSelected() {
    const selectedIds = new Set(
      this.data.cart
        .filter(
          (item) => item.selected
        )
        .map((item) => item.id)
    )

    if (!selectedIds.size) {
      wx.showToast({
        title: '请选择要删除的商品',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '批量删除',
      content:
        `确定删除已选中的 ${selectedIds.size} 件商品吗？`,
      confirmText: '删除',
      confirmColor: '#68764b',
      success: (result) => {
        if (!result.confirm) return

        setCart(
          getCart().filter(
            (item) =>
              !selectedIds.has(
                productId(item)
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
      itemList: options.map(
        (item) => {
          const feeText =
            item.feeFen > 0
              ? ` +¥${moneyFromFen(item.feeFen)}`
              : ' 免费'

          return `${item.name}${feeText}`
        }
      ),
      success: (result) => {
        const selected =
          options[result.tapIndex]

        if (!selected) return

        setStoredValue(
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
      itemList: options.map(
        (item) => item.name
      ),
      success: (result) => {
        const selected =
          options[result.tapIndex]

        if (!selected) return

        setStoredValue(
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
    if (this.data.points <= 0) {
      wx.showToast({
        title: '当前暂无可用积分',
        icon: 'none'
      })
      return
    }

    wx.showToast({
      title:
        '积分将在结算页按规则抵扣',
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
        title: '请选择可结算商品',
        icon: 'none'
      })
      return
    }

    wx.showToast({
      title:
        '订单结算将在下一阶段接入',
      icon: 'none'
    })
  }
})
