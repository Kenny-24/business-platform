const { createMonth } = require('../../utils/calendar')

Page({
  data: { year: 0, month: 0, days: [], selectedDay: 12, week: ['日','一','二','三','四','五','六'] },
  onLoad() {
    const now = new Date()
    this.setMonth(now.getFullYear(), now.getMonth())
  },
  setMonth(year, month) { this.setData({ year, month, days: createMonth(year, month) }) },
  previousMonth() {
    let { year, month } = this.data
    month -= 1
    if (month < 0) { month = 11; year -= 1 }
    this.setMonth(year, month)
  },
  nextMonth() {
    let { year, month } = this.data
    month += 1
    if (month > 11) { month = 0; year += 1 }
    this.setMonth(year, month)
  },
  selectDay(e) {
    if (!e.currentTarget.dataset.current) return
    this.setData({ selectedDay: Number(e.currentTarget.dataset.day) })
  },
  addDate() { wx.showToast({ title: '日期提醒将在下一版接入', icon: 'none' }) }
})
