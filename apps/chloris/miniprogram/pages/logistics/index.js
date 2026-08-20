const { getLayoutMetrics } = require('../../utils/layout')
const { getOrderDetail, refreshLogistics } = require('../../services/order-service')

function layout() {
  const metrics = getLayoutMetrics()
  return { contentHeight: metrics.contentHeight, horizontalPadding: Number(metrics.horizontalPadding || 18) }
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (number) => String(number).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

Page({
  data: { ...layout(), loading: true, refreshing: false, order: null, logistics: null, traces: [], hasTracking: false },
  onLoad(options) {
    this._id = String(options.id || '')
    if (!this._id) { wx.showToast({ title:'缺少订单信息', icon:'none' }); return }
    this.load()
  },
  onResize() { this.setData(layout()) },
  async load() {
    try {
      const order = await getOrderDetail(this._id)
      const hasTracking = Boolean(String(order.trackingNo || '').trim())
      this.setData({ order, hasTracking, loading: false })
      if (hasTracking) await this.refresh(true)
    } catch (error) {
      this.setData({ loading:false })
      wx.showToast({ title:error.message || '物流信息加载失败', icon:'none' })
    }
  },
  refreshFromTap() {
    if (!this.data.hasTracking) {
      wx.showToast({ title: '商家暂未录入运单号', icon: 'none' })
      return
    }
    this.refresh(false)
  },
  async refresh(silent = false) {
    if (this.data.refreshing) return
    this.setData({ refreshing:true })
    try {
      const logistics = await refreshLogistics(this._id, !silent)
      const traces = (logistics.logisticsTrace || []).map((item,index) => ({
        ...item,
        timeText: formatTime(item.time || item.acceptTime || item.datetime),
        active: index === 0
      }))
      this.setData({ logistics, traces })
      if (!silent) wx.showToast({ title:'物流已更新', icon:'success' })
    } catch (error) {
      if (!silent) wx.showToast({ title:error.message || '物流查询失败', icon:'none' })
    } finally {
      this.setData({ refreshing:false })
    }
  },
  copyNo() {
    const no = String((this.data.logistics && this.data.logistics.trackingNo) || (this.data.order && this.data.order.trackingNo) || '')
    if (no) wx.setClipboardData({ data:no })
  }
})
