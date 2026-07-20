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

function array(value) {
  return Array.isArray(value)
    ? value
    : []
}

function priceText(value) {
  const price = Number(value || 0)

  if (!Number.isFinite(price)) {
    return '0'
  }

  if (Number.isInteger(price)) {
    return String(price)
  }

  return price
    .toFixed(2)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
}

function prepareAtlas(item, index = 0) {
  const row = item || {}
  const sceneTags =
    array(row.sceneTags)
  const colorTags =
    array(row.colorTags)
  const seasonTags =
    array(row.seasonTags)
  const name = text(row.name)
  const latin = text(
    row.latin ||
    row.latinName
  )
  const meaning = text(row.meaning)
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
    description: text(
      row.description
    ),
    careGuide: text(
      row.careGuide
    ),
    toxicityNote: text(
      row.toxicityNote
    ),
    floweringPeriod,
    category:
      text(row.category) ||
      '鲜切花',
    sceneTags,
    colorTags,
    seasonTags,
    colorText:
      colorTags.length
        ? colorTags.join('、')
        : '暂无',
    seasonText:
      floweringPeriod ||
      '暂无',
    image: text(row.image),
    imageBackground:
      ['dark', 'light', 'soft']
        .indexOf(
          text(row.imageBackground)
        ) >= 0
        ? text(row.imageBackground)
        : 'soft'
  })
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

  return parts
    .slice(0, 8)
    .map((label, index) => ({
      index: index + 1,
      label
    }))
}

function buildLayout() {
  try {
    const metrics =
      getLayoutMetrics()
    const width = Number(
      metrics.windowWidth || 375
    )

    return {
      contentHeight:
        metrics.contentHeight,
      horizontalPadding:
        width <= 350
          ? 14
          : width >= 768
            ? 32
            : 18,
      heroHeight:
        width <= 350
          ? 210
          : width >= 768
            ? 365
            : 245,
      wideLayout: width >= 720
    }
  } catch (error) {
    return {
      contentHeight: 520,
      horizontalPadding: 18,
      heroHeight: 245,
      wideLayout: false
    }
  }
}

function optionalFunction(name) {
  return userService &&
    typeof userService[name] ===
      'function'
    ? userService[name]
    : null
}

Page({
  data: {
    contentHeight: 520,
    horizontalPadding: 18,
    heroHeight: 245,
    wideLayout: false,
    itemId: '',
    item: null,
    careSteps: [],
    relatedProducts: [],
    purchased: false,
    favorite: false,
    favoriteSaving: false,
    loading: true,
    loadFailed: false
  },

  onLoad(options = {}) {
    this.setData(
      Object.assign(
        {},
        buildLayout(),
        {
          itemId:
            decodeURIComponent(
              String(
                options.id || ''
              )
            )
        }
      )
    )

    this.loadDetail()
  },

  onShow() {
    if (this.data.item) {
      this.syncUserState()
    }
  },

  onResize() {
    this.setData(buildLayout())
  },

  async syncUserState() {
    let favoriteIds =
      readFavoriteAtlasIds()
    let purchasedIds =
      getPurchasedAtlasIds([])

    const getOverview =
      optionalFunction('getOverview')
    const getCachedOverview =
      optionalFunction(
        'getCachedOverview'
      )

    if (getOverview) {
      try {
        const overview =
          await getOverview()

        favoriteIds =
          mergeFavoriteAtlasIds(
            overview &&
            overview.favoriteAtlasIds
              ? overview.favoriteAtlasIds
              : [],
            favoriteIds
          )

        purchasedIds =
          recordPurchasedAtlasIds(
            overview &&
            overview.purchasedAtlasIds
              ? overview.purchasedAtlasIds
              : []
          )
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
            favoriteIds
          )

        purchasedIds =
          recordPurchasedAtlasIds(
            cached &&
            cached.purchasedAtlasIds
              ? cached.purchasedAtlasIds
              : purchasedIds
          )

        console.warn(
          '图鉴详情用户状态使用缓存：',
          error
        )
      }
    }

    const id = String(
      this.data.itemId
    )

    this.setData({
      favorite:
        favoriteIds.indexOf(id) >= 0,
      purchased:
        purchasedIds.indexOf(id) >= 0
    })
  },

  async loadDetail(
    forceRefresh = false
  ) {
    this.setData({
      loading: true,
      loadFailed: false
    })

    try {
      let data

      try {
        data = await fetchHomeData({
          forceRefresh
        })
      } catch (cloudError) {
        console.warn(
          '图鉴详情云端数据暂不可用：',
          cloudError
        )
        data = {
          atlas: fallbackAtlas,
          products: []
        }
      }

      const cloudAtlas =
        data &&
        Array.isArray(data.atlas)
          ? data.atlas
          : []
      const source =
        cloudAtlas.length
          ? cloudAtlas
          : fallbackAtlas
      const items =
        source.map(prepareAtlas)
      const item =
        items.find(
          (row) =>
            String(row.id) ===
            String(
              this.data.itemId
            )
        )

      if (!item) {
        throw new Error(
          '图鉴品种不存在或未发布'
        )
      }

      const products =
        data &&
        Array.isArray(data.products)
          ? data.products
          : []
      const relatedProducts =
        products
          .filter((product) =>
            array(product.atlasIds)
              .map(String)
              .indexOf(
                String(item.id)
              ) >= 0
          )
          .slice(0, 4)
          .map((product) =>
            Object.assign(
              {},
              product,
              {
                priceText:
                  priceText(
                    product.price
                  )
              }
            )
          )

      const favoriteIds =
        readFavoriteAtlasIds()
      const purchasedIds =
        getPurchasedAtlasIds(
          products
        )

      this.setData({
        item,
        careSteps:
          careSteps(
            item.careGuide
          ),
        relatedProducts,
        favorite:
          favoriteIds.indexOf(
            String(item.id)
          ) >= 0,
        purchased:
          purchasedIds.indexOf(
            String(item.id)
          ) >= 0,
        loading: false
      })

      await this.syncUserState()
    } catch (error) {
      console.error(
        '图鉴详情加载失败：',
        error
      )

      this.setData({
        item: null,
        loading: false,
        loadFailed: true
      })
    }
  },

  async toggleFavorite() {
    if (
      !this.data.item ||
      this.data.favoriteSaving
    ) {
      return
    }

    const id = String(
      this.data.item.id
    )
    const favorite =
      !this.data.favorite

    setCachedAtlasFavorite(
      id,
      favorite
    )

    this.setData({
      favorite,
      favoriteSaving: true
    })

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
        const favoriteIds =
          mergeFavoriteAtlasIds(
            result &&
            result.favoriteAtlasIds
              ? result.favoriteAtlasIds
              : [id]
          )

        this.setData({
          favorite:
            favoriteIds.indexOf(id) >= 0
        })
      } catch (error) {
        console.warn(
          '图鉴详情收藏暂未同步云端：',
          error
        )
      }
    }

    this.setData({
      favoriteSaving: false
    })

    wx.showToast({
      title: favorite
        ? '已收藏'
        : '已取消收藏',
      icon: 'success'
    })
  },

  retry() {
    this.loadDetail(true)
  },

  openRelatedProduct(event) {
    const name = String(
      event.currentTarget.dataset
        .name || ''
    )

    wx.showToast({
      title:
        name ||
        '相关商品',
      icon: 'none'
    })
  },

  findRelatedFlowers() {
    const item = this.data.item

    if (!item) return

    wx.setStorageSync(
      'huayuCategoryIntent',
      {
        category: 'flower',
        query: item.name
      }
    )

    wx.switchTab({
      url: '/pages/category/index'
    })
  }
})
