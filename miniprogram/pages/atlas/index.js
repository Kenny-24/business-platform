const {
  atlasItems: fallbackAtlas
} = require('../../data/mock')
const {
  fetchHomeData
} = require('../../services/home-data')
const {
  getPurchasedAtlasIds,
  recordPurchasedAtlasIds
} = require('../../services/atlas-purchases')
const {
  readFavoriteAtlasIds,
  mergeFavoriteAtlasIds,
  setCachedAtlasFavorite
} = require('../../services/atlas-favorites')
const userService = require('../../services/user-service')
const {
  getLayoutMetrics
} = require('../../utils/layout')

function text(value) {
  return String(value || '').trim()
}

function stringArray(value) {
  if (!Array.isArray(value)) return []

  const result = []

  value.forEach((item) => {
    const normalized = text(item)

    if (
      normalized &&
      result.indexOf(normalized) < 0
    ) {
      result.push(normalized)
    }
  })

  return result
}

function prepareAtlas(item, index) {
  const row = item || {}
  const seasonTags = stringArray(row.seasonTags)
  const meaning = text(row.meaning)
  const name = text(row.name)
  const latin = text(row.latin || row.latinName)
  const floweringPeriod =
    text(row.floweringPeriod) ||
    seasonTags.join(' / ')

  return Object.assign({}, row, {
    id: String(
      row.id ||
      row._id ||
      `atlas-${index}`
    ),
    name,
    latin,
    alias: text(row.alias),
    meaning,
    description: text(row.description),
    careGuide: text(row.careGuide),
    toxicityNote: text(row.toxicityNote),
    floweringPeriod,
    category: text(row.category) || '鲜切花',
    sceneTags: stringArray(row.sceneTags),
    colorTags: stringArray(row.colorTags),
    seasonTags,
    image: text(row.image),
    imageBackground:
      ['dark', 'light', 'soft'].indexOf(
        text(row.imageBackground)
      ) >= 0
        ? text(row.imageBackground)
        : 'soft',
    homeFeatured: row.homeFeatured === true,
    latinLine: latin || 'Huayu Atlas',
    metaLine: floweringPeriod
      ? `花期 ${floweringPeriod}`
      : (text(row.category) || '花材')
  })
}

function searchableName(item) {
  return [
    item.name,
    item.latin,
    item.alias
  ]
    .map((value) =>
      text(value).toLowerCase()
    )
    .filter(Boolean)
    .join(' ')
}

function safeLayout() {
  try {
    const metrics = getLayoutMetrics()
    const width = Number(
      metrics.windowWidth || 375
    )
    const padding =
      width <= 350
        ? 14
        : width >= 768
          ? 28
          : 18
    const available = Math.max(
      240,
      width - padding * 2
    )

    let columns = 2

    if (available >= 900) {
      columns = 4
    } else if (available >= 570) {
      columns = 3
    } else if (available < 270) {
      columns = 1
    }

    const gap = width <= 350 ? 10 : 12
    const cardWidth = Math.floor(
      (
        available -
        gap * (columns - 1)
      ) / columns
    )

    return {
      horizontalPadding: padding,
      columns,
      imageHeight: Math.max(
        145,
        Math.min(
          230,
          Math.round(cardWidth * 1.02)
        )
      ),
      compactLayout: width <= 350
    }
  } catch (error) {
    console.warn(
      '图鉴布局使用默认值：',
      error
    )

    return {
      horizontalPadding: 18,
      columns: 2,
      imageHeight: 160,
      compactLayout: false
    }
  }
}

function fallbackItems() {
  const source = Array.isArray(
    fallbackAtlas
  )
    ? fallbackAtlas
    : []

  return source.map(prepareAtlas)
}

function optionalFunction(name) {
  return userService &&
    typeof userService[name] === 'function'
    ? userService[name]
    : null
}

Page({
  data: {
    horizontalPadding: 18,
    columns: 2,
    imageHeight: 160,
    compactLayout: false,
    activeTab: 'all',
    tabs: [
      {
        label: '全部',
        value: 'all'
      },
      {
        label: '收藏',
        value: 'favorites'
      }
    ],
    searchQuery: '',
    allItems: [],
    allProducts: [],
    visibleItems: [],
    purchasedIds: [],
    favoriteIds: [],
    resultCount: 0,
    loading: true,
    loadFailed: false,
    favoriteSavingId: ''
  },

  onLoad(options = {}) {
    const requestedTab = String(
      options.tab || ''
    )
    const initialItems = fallbackItems()

    this.setData(
      Object.assign(
        {},
        safeLayout(),
        {
          activeTab:
            requestedTab === 'favorites'
              ? 'favorites'
              : 'all',
          allItems: initialItems,
          visibleItems: initialItems,
          resultCount: initialItems.length,
          favoriteIds:
            readFavoriteAtlasIds(),
          loading: true
        }
      )
    )

    this.applyFilters()
    this.loadAtlas()
  },

  onShow() {
    if (this.data.allItems.length) {
      this.syncUserState()
    }
  },

  onResize() {
    this.setData(safeLayout())
  },

  onPullDownRefresh() {
    this.loadAtlas(true)
      .catch(() => {})
      .then(() => {
        wx.stopPullDownRefresh()
      })
  },

  onUnload() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer)
    }
  },

  async syncUserState() {
    const localFavoriteIds =
      readFavoriteAtlasIds()
    let purchasedIds =
      getPurchasedAtlasIds(
        this.data.allProducts || []
      )
    let favoriteIds =
      localFavoriteIds

    const getOverview =
      optionalFunction('getOverview')
    const getCachedOverview =
      optionalFunction(
        'getCachedOverview'
      )
    const saveAtlasFavorites =
      optionalFunction(
        'saveAtlasFavorites'
      )

    if (!getOverview) {
      this.setData({
        purchasedIds:
          stringArray(purchasedIds),
        favoriteIds:
          stringArray(favoriteIds)
      })
      this.applyFilters()
      return
    }

    try {
      const overview =
        await getOverview()
      const purchasedSource =
        overview &&
        Array.isArray(
          overview.purchasedAtlasIds
        )
          ? overview.purchasedAtlasIds
          : []

      purchasedIds =
        recordPurchasedAtlasIds(
          purchasedSource
        )

      const cloudIds =
        stringArray(
          overview &&
          overview.favoriteAtlasIds
        )

      favoriteIds =
        mergeFavoriteAtlasIds(
          cloudIds,
          localFavoriteIds
        )

      const needsMigration =
        favoriteIds.some(
          (id) =>
            cloudIds.indexOf(
              String(id)
            ) < 0
        )

      if (
        needsMigration &&
        saveAtlasFavorites
      ) {
        try {
          const result =
            await saveAtlasFavorites(
              favoriteIds
            )

          favoriteIds =
            mergeFavoriteAtlasIds(
              result &&
              result.favoriteAtlasIds
                ? result.favoriteAtlasIds
                : favoriteIds
            )
        } catch (migrationError) {
          console.warn(
            '图鉴收藏云端迁移失败：',
            migrationError
          )
        }
      }
    } catch (error) {
      const cached =
        getCachedOverview
          ? getCachedOverview()
          : null

      favoriteIds =
        mergeFavoriteAtlasIds(
          cached &&
          cached.favoriteAtlasIds
            ? cached.favoriteAtlasIds
            : [],
          localFavoriteIds
        )

      console.warn(
        '图鉴用户状态使用本地缓存：',
        error
      )
    }

    this.setData({
      purchasedIds:
        stringArray(purchasedIds),
      favoriteIds:
        stringArray(favoriteIds)
    })

    this.applyFilters()
    this.consumeIntent()
  },

  async loadAtlas(
    forceRefresh = false
  ) {
    this.setData({
      loading: true,
      loadFailed: false
    })

    try {
      const data = await fetchHomeData({
        forceRefresh
      })
      const cloudAtlas =
        data &&
        Array.isArray(data.atlas)
          ? data.atlas
          : []
      const allItems =
        cloudAtlas.length
          ? cloudAtlas.map(
              prepareAtlas
            )
          : fallbackItems()
      const allProducts =
        data &&
        Array.isArray(data.products)
          ? data.products
          : []

      this.setData({
        allItems,
        allProducts,
        purchasedIds:
          getPurchasedAtlasIds(
            allProducts
          ),
        favoriteIds:
          readFavoriteAtlasIds(),
        loading: false,
        loadFailed: false
      })

      this.applyFilters()
      this.consumeIntent()
      await this.syncUserState()
    } catch (error) {
      console.error(
        '图鉴云端加载失败，使用内置数据：',
        error
      )

      const allItems =
        this.data.allItems.length
          ? this.data.allItems
          : fallbackItems()

      this.setData({
        allItems,
        allProducts: [],
        purchasedIds:
          getPurchasedAtlasIds([]),
        favoriteIds:
          readFavoriteAtlasIds(),
        loading: false,
        loadFailed: true
      })

      this.applyFilters()
    }
  },

  retryLoad() {
    this.loadAtlas(true)
  },

  consumeIntent() {
    let intent = ''

    try {
      intent = wx.getStorageSync(
        'huayuAtlasIntent'
      )
    } catch (error) {}

    if (
      !intent ||
      !this.data.allItems.length
    ) {
      return
    }

    const item =
      this.data.allItems.find(
        (row) =>
          String(row.id) ===
          String(intent)
      )

    try {
      wx.removeStorageSync(
        'huayuAtlasIntent'
      )
    } catch (error) {}

    if (item) {
      this.openDetail(item.id)
    }
  },

  selectTab(event) {
    const activeTab = String(
      event.currentTarget.dataset
        .value || 'all'
    )

    this.setData({
      activeTab:
        activeTab === 'favorites'
          ? 'favorites'
          : 'all'
    })

    this.applyFilters()
  },

  onSearchInput(event) {
    const searchQuery =
      event.detail.value || ''

    this.setData({ searchQuery })

    if (this._searchTimer) {
      clearTimeout(
        this._searchTimer
      )
    }

    this._searchTimer =
      setTimeout(
        () => this.applyFilters(),
        160
      )
  },

  clearSearch() {
    this.setData({
      searchQuery: ''
    })
    this.applyFilters()
  },

  applyFilters() {
    const query = text(
      this.data.searchQuery
    ).toLowerCase()
    const purchasedIds =
      stringArray(
        this.data.purchasedIds
      )
    const favoriteIds =
      stringArray(
        this.data.favoriteIds
      )

    let items = (
      Array.isArray(
        this.data.allItems
      )
        ? this.data.allItems
        : []
    ).map((item) =>
      Object.assign({}, item, {
        purchased:
          purchasedIds.indexOf(
            String(item.id)
          ) >= 0,
        favorite:
          favoriteIds.indexOf(
            String(item.id)
          ) >= 0
      })
    )

    if (
      this.data.activeTab ===
      'favorites'
    ) {
      items = items.filter(
        (item) => item.favorite
      )
    }

    if (query) {
      items = items.filter(
        (item) =>
          searchableName(item)
            .indexOf(query) >= 0
      )
    }

    this.setData({
      visibleItems: items,
      resultCount: items.length
    })
  },

  async toggleFavorite(event) {
    const id = String(
      event.currentTarget.dataset
        .id || ''
    )

    if (
      !id ||
      this.data.favoriteSavingId
    ) {
      return
    }

    const currentIds =
      stringArray(
        this.data.favoriteIds
      )
    const favorite =
      currentIds.indexOf(id) < 0
    const nextIds =
      setCachedAtlasFavorite(
        id,
        favorite
      )

    this.setData({
      favoriteIds: nextIds,
      favoriteSavingId: id
    })
    this.applyFilters()

    const setAtlasFavorite =
      optionalFunction(
        'setAtlasFavorite'
      )

    if (setAtlasFavorite) {
      try {
        const result =
          await setAtlasFavorite(
            id,
            favorite
          )
        const cloudIds =
          result &&
          Array.isArray(
            result.favoriteAtlasIds
          )
            ? result.favoriteAtlasIds
            : nextIds

        this.setData({
          favoriteIds:
            mergeFavoriteAtlasIds(
              cloudIds
            )
        })
      } catch (error) {
        /*
         * 本地收藏已经成功。
         * 云端失败不回滚，避免网络或旧文件导致收藏按钮失效。
         * 下次进入页面时会再次尝试同步。
         */
        console.warn(
          '图鉴收藏暂未同步到云端：',
          error
        )
      }
    } else {
      console.warn(
        '当前 user-service.js 缺少 setAtlasFavorite，已保留本地收藏'
      )
    }

    this.setData({
      favoriteSavingId: ''
    })
    this.applyFilters()

    wx.showToast({
      title: favorite
        ? '已收藏'
        : '已取消收藏',
      icon: 'success'
    })
  },

  openItem(event) {
    const id = String(
      event.currentTarget.dataset
        .id || ''
    )

    if (id) {
      this.openDetail(id)
    }
  },

  openDetail(id) {
    wx.navigateTo({
      url:
        '/pages/atlas-detail/index?id=' +
        encodeURIComponent(id)
    })
  }
})
