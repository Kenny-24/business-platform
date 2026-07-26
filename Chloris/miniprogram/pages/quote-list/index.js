const { getLayoutMetrics } = require('../../utils/layout')
const { listQuoteRequests } = require('../../services/user-service')

const TABS = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待商户回复' },
  { value: 'quoted', label: '待我确认' },
  { value: 'finished', label: '已处理' }
]

function buildLayout() {
  const metrics = getLayoutMetrics()
  const width = Number(metrics.windowWidth || 375)
  return {
    contentHeight: metrics.contentHeight,
    horizontalPadding: Number(metrics.horizontalPadding || (width <= 350 ? 14 : width >= 768 ? 28 : 18)),
    compactLayout: Boolean(metrics.isSmallScreen || width <= 350),
    wideLayout: Boolean(metrics.isWideScreen || width >= 720)
  }
}

Page({
  data: {
    contentHeight: 520,
    horizontalPadding: 18,
    compactLayout: false,
    wideLayout: false,
    tabs: TABS.map((item) => ({ ...item, count: 0 })),
    activeTab: 'all',
    loading: true,
    items: [],
    counts: {
      all: 0,
      pending: 0,
      quoted: 0,
      finished: 0
    }
  },

  onLoad(options = {}) {
    this.setData({
      ...buildLayout(),
      activeTab: String(options.status || 'all')
    })
  },

  onShow() {
    this.loadItems()
  },

  onResize() {
    this.setData(buildLayout())
  },

  async loadItems(showLoading = true) {
    if (showLoading) this.setData({ loading: true })

    try {
      const result = await listQuoteRequests(this.data.activeTab)
      const counts = result.counts || this.data.counts
      this.setData({
        loading: false,
        items: Array.isArray(result.items) ? result.items : [],
        counts,
        tabs: TABS.map((item) => ({
          ...item,
          count: Number(counts[item.value] || 0)
        }))
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '报价记录加载失败', icon: 'none' })
    }
  },

  selectTab(event) {
    const value = String(event.currentTarget.dataset.value || 'all')
    if (value === this.data.activeTab) return
    this.setData({ activeTab: value })
    this.loadItems()
  },

  refresh() {
    this.loadItems()
  },

  openItem(event) {
    const id = String(event.currentTarget.dataset.id || '')
    if (!id) return
    wx.navigateTo({ url: `/pages/quote-detail/index?id=${encodeURIComponent(id)}` })
  },

  createNew() {
    wx.navigateTo({ url: '/pages/custom-quote/index' })
  }
})
