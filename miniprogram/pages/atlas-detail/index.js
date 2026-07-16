const {
  atlasItems: fallbackAtlas
} = require('../../data/mock')
const {
  fetchHomeData
} = require('../../services/home-data')
const {
  getPurchasedAtlasIds
} = require('../../services/atlas-purchases')
const {
  getLayoutMetrics
} = require('../../utils/layout')

function text(value) {
  return String(value || '').trim()
}

function array(value) {
  return Array.isArray(value) ? value : []
}

function priceText(value) {
  const price = Number(value || 0)
  if (!Number.isFinite(price)) return '0'
  if (Number.isInteger(price)) return String(price)
  return price.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function prepareAtlas(item, index = 0) {
  const sceneTags = array(item.sceneTags)
  const colorTags = array(item.colorTags)
  const seasonTags = array(item.seasonTags)

  return {
    ...item,
    id: String(item.id || item._id || `atlas-${index}`),
    name: text(item.name),
    latin: text(item.latin || item.latinName),
    meaning: text(item.meaning),
    description: text(item.description),
    careGuide: text(item.careGuide),
    category: text(item.category) || '鲜切花',
    sceneTags,
    colorTags,
    seasonTags,
    colorText: colorTags.length ? colorTags.join('、') : '暂无',
    seasonText: seasonTags.length ? seasonTags.join('、') : '暂无',
    image: text(item.image)
  }
}

function careSteps(value) {
  const source = text(value)
  if (!source) return []

  let parts = source
    .split(/[\n；;]+/)
    .map(text)
    .filter(Boolean)

  if (parts.length <= 1) {
    parts = source
      .split(/。+/)
      .map(text)
      .filter(Boolean)
  }

  return parts.slice(0, 8).map((label, index) => ({
    index: index + 1,
    label
  }))
}

function buildLayout() {
  const metrics = getLayoutMetrics()
  const width = Number(metrics.windowWidth || 375)

  return {
    contentHeight: metrics.contentHeight,
    horizontalPadding: width <= 350 ? 14 : width >= 768 ? 32 : 18,
    heroHeight: width <= 350 ? 235 : width >= 768 ? 430 : 300,
    wideLayout: width >= 720
  }
}

Page({
  data: {
    contentHeight: 520,
    horizontalPadding: 18,
    heroHeight: 300,
    wideLayout: false,
    itemId: '',
    item: null,
    careSteps: [],
    relatedProducts: [],
    purchased: false,
    loading: true,
    loadFailed: false
  },

  onLoad(options) {
    this.setData({
      ...buildLayout(),
      itemId: decodeURIComponent(String(options.id || ''))
    })

    this.loadDetail()
  },

  onResize() {
    this.setData(buildLayout())
  },

  async loadDetail(forceRefresh = false) {
    this.setData({
      loading: true,
      loadFailed: false
    })

    try {
      const data = await fetchHomeData({ forceRefresh })
      const source = (data.atlas || []).length
        ? data.atlas
        : fallbackAtlas
      const items = source.map(prepareAtlas)
      const item = items.find(
        (row) => String(row.id) === String(this.data.itemId)
      )

      if (!item) {
        throw new Error('图鉴品种不存在或未发布')
      }

      const products = data.products || []
      const relatedProducts = products
        .filter((product) =>
          array(product.atlasIds)
            .map(String)
            .includes(String(item.id))
        )
        .slice(0, 4)
        .map((product) => ({
          ...product,
          priceText: priceText(product.price)
        }))

      const purchasedIds = getPurchasedAtlasIds(products)

      this.setData({
        item,
        careSteps: careSteps(item.careGuide),
        relatedProducts,
        purchased: purchasedIds.includes(String(item.id)),
        loading: false
      })
    } catch (error) {
      console.error('图鉴详情加载失败：', error)

      this.setData({
        loading: false,
        loadFailed: true
      })
    }
  },

  openRelatedProduct(event) {
    const name = text(event.currentTarget.dataset.name)
    if (name) wx.setStorageSync('huayuCategorySearch', name)
    wx.switchTab({ url: '/pages/category/index' })
  },

  findRelatedFlowers() {
    const item = this.data.item
    if (!item) return

    wx.setStorageSync('huayuCategoryIntent', '鲜花')
    wx.setStorageSync('huayuCategorySearch', item.name)
    wx.switchTab({ url: '/pages/category/index' })
  },

  retry() {
    this.loadDetail(true)
  }
})
