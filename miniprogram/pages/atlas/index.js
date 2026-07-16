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

function prepareAtlas(item, index) {
  return {
    ...item,
    id: String(item.id || item._id || `atlas-${index}`),
    name: text(item.name),
    latin: text(item.latin || item.latinName),
    meaning: text(item.meaning),
    description: text(item.description),
    careGuide: text(item.careGuide),
    category: text(item.category) || '鲜切花',
    sceneTags: Array.isArray(item.sceneTags) ? item.sceneTags : [],
    colorTags: Array.isArray(item.colorTags) ? item.colorTags : [],
    seasonTags: Array.isArray(item.seasonTags) ? item.seasonTags : [],
    image: text(item.image),
    homeFeatured: item.homeFeatured === true
  }
}

function searchable(item) {
  return [
    item.name,
    item.latin,
    item.meaning,
    item.description,
    item.careGuide,
    item.category,
    ...(item.sceneTags || []),
    ...(item.colorTags || []),
    ...(item.seasonTags || [])
  ]
    .map((value) => text(value).toLowerCase())
    .filter(Boolean)
    .join(' ')
}

function buildLayout() {
  const metrics = getLayoutMetrics()
  const width = Number(metrics.windowWidth || 375)
  const padding = width <= 350 ? 14 : width >= 768 ? 28 : 18
  const available = width - padding * 2

  let columns = 2
  if (available >= 900) columns = 4
  else if (available >= 570) columns = 3
  else if (available < 270) columns = 1

  const gap = width <= 350 ? 10 : 12
  const cardWidth = Math.floor(
    (available - gap * (columns - 1)) / columns
  )

  return {
    contentHeight: metrics.contentHeight,
    horizontalPadding: padding,
    columns,
    imageHeight: Math.max(
      132,
      Math.min(228, Math.round(cardWidth * 0.9))
    ),
    compactLayout: width <= 350
  }
}

Page({
  data: {
    contentHeight: 520,
    horizontalPadding: 18,
    columns: 2,
    imageHeight: 150,
    compactLayout: false,
    activeTab: 'all',
    tabs: [
      { label: '全部', value: 'all' },
      { label: '我的', value: 'mine' }
    ],
    searchQuery: '',
    allItems: [],
    allProducts: [],
    visibleItems: [],
    purchasedIds: [],
    resultCount: 0,
    loading: true,
    loadFailed: false
  },

  onLoad() {
    this.updateLayout()
    this.loadAtlas()
  },

  onShow() {
    const purchasedIds = getPurchasedAtlasIds(
      this.data.allProducts
    )

    this.setData({ purchasedIds })
    this.applyFilters()
    this.consumeIntent()
  },

  onResize() {
    this.updateLayout()
  },

  onUnload() {
    if (this._searchTimer) clearTimeout(this._searchTimer)
  },

  updateLayout() {
    this.setData(buildLayout())
  },

  async loadAtlas(forceRefresh = false) {
    this.setData({
      loading: true,
      loadFailed: false
    })

    try {
      const data = await fetchHomeData({ forceRefresh })
      const source = (data.atlas || []).length
        ? data.atlas
        : fallbackAtlas
      const allItems = source.map(prepareAtlas)
      const allProducts = data.products || []

      this.setData({
        allItems,
        allProducts,
        purchasedIds: getPurchasedAtlasIds(allProducts),
        loading: false
      })

      this.applyFilters()
      this.consumeIntent()
    } catch (error) {
      console.error('图鉴数据加载失败：', error)

      this.setData({
        allItems: fallbackAtlas.map(prepareAtlas),
        allProducts: [],
        purchasedIds: getPurchasedAtlasIds([]),
        loading: false,
        loadFailed: true
      })

      this.applyFilters()
    }
  },

  consumeIntent() {
    const intent = wx.getStorageSync('huayuAtlasIntent')
    if (!intent || !this.data.allItems.length) return

    const item = this.data.allItems.find(
      (row) => String(row.id) === String(intent)
    )

    wx.removeStorageSync('huayuAtlasIntent')
    if (item) this.openDetail(item.id)
  },

  selectTab(event) {
    const activeTab = String(
      event.currentTarget.dataset.value || 'all'
    )

    this.setData({ activeTab })
    this.applyFilters()
  },

  onSearchInput(event) {
    const searchQuery = event.detail.value || ''
    this.setData({ searchQuery })

    if (this._searchTimer) clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(
      () => this.applyFilters(),
      160
    )
  },

  clearSearch() {
    this.setData({ searchQuery: '' })
    this.applyFilters()
  },

  applyFilters() {
    const query = text(this.data.searchQuery).toLowerCase()
    const purchased = new Set(
      this.data.purchasedIds.map(String)
    )

    let items = this.data.allItems.map((item) => ({
      ...item,
      purchased: purchased.has(String(item.id))
    }))

    if (this.data.activeTab === 'mine') {
      items = items.filter((item) => item.purchased)
    }

    if (query) {
      items = items.filter((item) =>
        searchable(item).includes(query)
      )
    }

    this.setData({
      visibleItems: items,
      resultCount: items.length
    })
  },

  openItem(event) {
    const id = String(
      event.currentTarget.dataset.id || ''
    )

    if (id) this.openDetail(id)
  },

  openDetail(id) {
    wx.navigateTo({
      url: `/pages/atlas-detail/index?id=${encodeURIComponent(id)}`
    })
  }
})
