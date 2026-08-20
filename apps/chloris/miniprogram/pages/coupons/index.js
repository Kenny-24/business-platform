const { getLayoutMetrics } = require('../../utils/layout')
const { listCoupons } = require('../../services/user-service')

const TABS = [
  { key: 'available', label: '可使用' },
  { key: 'used', label: '已使用' },
  { key: 'expired', label: '已过期' }
]

function buildLayout() {
  const metrics = getLayoutMetrics()
  const tabHeight = Math.round(88 * Number(metrics.windowWidth || 375) / 750)
  return {
    contentHeight: metrics.contentHeight,
    scrollHeight: Math.max(260, metrics.contentHeight - tabHeight),
    horizontalPadding: Number(metrics.horizontalPadding || 18)
  }
}

function dateLabel(value) {
  if (!value) return '长期有效'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '有效期以活动说明为准'
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`
}

function categoryLabel(item) {
  if (item.firstOrderOnly) return '首单专享'
  if ((item.applicableCategories || []).length) return '指定品类可用'
  return '普通商品可用'
}

Page({
  data: {
    ...buildLayout(),
    tabs: TABS,
    activeTab: 'available',
    loading: true,
    items: []
  },

  onLoad() {
    this.loadCoupons()
  },

  onShow() {
    if (this._hasShown) this.loadCoupons(true)
    this._hasShown = true
  },

  onResize() {
    this.setData(buildLayout())
  },

  async loadCoupons(silent = false) {
    if (!silent) this.setData({ loading: true })
    try {
      const result = await listCoupons(this.data.activeTab)
      this.setData({
        loading: false,
        items: (result.items || []).map((item) => ({
          ...item,
          expiryText: dateLabel(item.expiresAt),
          categoryText: categoryLabel(item)
        }))
      })
    } catch (error) {
      this.setData({ loading: false })
      if (!silent) {
        wx.showToast({ title: error.message || '优惠券加载失败', icon: 'none' })
      }
    }
  },

  selectTab(event) {
    const activeTab = String(event.currentTarget.dataset.key || 'available')
    if (activeTab === this.data.activeTab) return
    this.setData({ activeTab, items: [] })
    this.loadCoupons()
  }
})
