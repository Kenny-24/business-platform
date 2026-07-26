const { createMonth } = require('../../utils/calendar')
const {
  dateKey,
  monthEventMap,
  eventsForDate
} = require('../../utils/holiday-engine')
const {
  getImportantDates,
  saveImportantDate,
  deleteImportantDate
} = require('../../services/calendar-storage')
const { fetchHomeData } = require('../../services/home-data')
const { addToCart } = require('../../services/storage')
const { cloneHolidayCatalog } = require('../../data/holiday-catalog')

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const FILTER_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '国内', value: 'domestic' },
  { label: '国际', value: 'international' },
  { label: '商家活动', value: 'merchant' },
  { label: 'BIG DAY', value: 'personal' }
]
const REMINDER_OPTIONS = [
  { label: '当天提醒', value: 0 },
  { label: '提前1天', value: 1 },
  { label: '提前3天', value: 3 },
  { label: '提前7天', value: 7 }
]

function pad(value) {
  return String(value).padStart(2, '0')
}

function parseDateKey(value) {
  const parts = String(value || '').split('-').map(Number)
  if (parts.length !== 3 || parts.some((item) => !Number.isFinite(item))) {
    return null
  }

  return new Date(parts[0], parts[1] - 1, parts[2])
}

function formatPrice(value) {
  const price = Number(value || 0)
  if (!Number.isFinite(price)) return '0'
  return Number.isInteger(price)
    ? String(price)
    : price.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function productSearchText(item) {
  return [
    item.name,
    item.subtitle,
    ...(item.searchKeywords || []),
    ...(item.sceneTags || []),
    ...(item.colorTags || [])
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ')
}

function uniqueProducts(products) {
  const seen = new Set()
  return products.filter((item) => {
    const id = String(item.id || item._id || '')
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function emptyForm(date) {
  const dateValue = dateKey(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  )

  return {
    id: '',
    title: '',
    date: dateValue,
    reminderIndex: 2,
    note: ''
  }
}

Page({
  data: {
    year: 0,
    month: 0,
    week: WEEK_LABELS,
    days: [],
    selectedDateKey: '',
    selectedDateLabel: '',
    selectedSummary: '普通日子',
    selectedEvents: [],
    recommendedProducts: [],
    holidayEvents: [],
    products: [],
    personalDates: [],
    filterOptions: FILTER_OPTIONS,
    activeFilter: 'all',
    monthEventRows: [],
    filteredMonthEventRows: [],
    upcomingPersonalDates: [],
    loading: true,
    showEditor: false,
    reminderOptions: REMINDER_OPTIONS,
    form: emptyForm(new Date())
  },

  onLoad() {
    const today = new Date()
    this._today = today
    this.setData({
      year: today.getFullYear(),
      month: today.getMonth(),
      selectedDateKey: dateKey(
        today.getFullYear(),
        today.getMonth() + 1,
        today.getDate()
      )
    })
    this.loadCalendarData()
  },

  onShow() {
    if (!this.data.year) return

    const intentDateKey = wx.getStorageSync('huayuCalendarIntentDate')
    const intentDate = parseDateKey(intentDateKey)
    if (intentDate) {
      wx.removeStorageSync('huayuCalendarIntentDate')
      this.setData({
        year: intentDate.getFullYear(),
        month: intentDate.getMonth(),
        selectedDateKey: dateKey(
          intentDate.getFullYear(),
          intentDate.getMonth() + 1,
          intentDate.getDate()
        )
      })
    }

    const personalDates = getImportantDates()
    this.setData({ personalDates })
    this.rebuildMonth()
  },

  async onPullDownRefresh() {
    await this.loadCalendarData(true)
    wx.stopPullDownRefresh()
  },

  async loadCalendarData(forceRefresh = false) {
    this.setData({ loading: true })

    try {
      const data = await fetchHomeData({ forceRefresh })
      this.setData({
        holidayEvents: (data.calendarEvents || []).length
          ? data.calendarEvents
          : cloneHolidayCatalog().map((item) => ({
              ...item,
              enabled: true,
              builtIn: true
            })),
        products: (data.products || []).map((item) => ({
          ...item,
          priceText: formatPrice(item.price)
        })),
        personalDates: getImportantDates(),
        loading: false
      })
    } catch (error) {
      console.error('日历数据加载失败：', error)
      this.setData({
        holidayEvents: cloneHolidayCatalog().map((item) => ({
          ...item,
          enabled: true,
          builtIn: true
        })),
        personalDates: getImportantDates(),
        loading: false
      })

      wx.showToast({
        title: '节日数据加载失败',
        icon: 'none'
      })
    }

    this.rebuildMonth()
  },

  rebuildMonth() {
    const { year, month, holidayEvents, personalDates } = this.data
    if (!year && year !== 0) return

    const eventMap = monthEventMap(
      year,
      month,
      holidayEvents,
      personalDates
    )
    const todayKey = dateKey(
      this._today.getFullYear(),
      this._today.getMonth() + 1,
      this._today.getDate()
    )

    const days = createMonth(year, month).map((cell) => {
      const events = cell.current ? eventMap[cell.key] || [] : []
      const markerTypes = [...new Set(events.map((item) => item.region))].slice(0, 3)

      return {
        ...cell,
        isToday: cell.key === todayKey,
        isSelected: cell.key === this.data.selectedDateKey,
        markerTypes,
        hasEvents: events.length > 0
      }
    })

    const monthEventRows = []
    Object.keys(eventMap)
      .sort()
      .forEach((key) => {
        const date = parseDateKey(key)
        ;(eventMap[key] || []).forEach((event) => {
          const isPersonal = event.region === 'personal'
          const isMerchant = event.region === 'merchant'
          const mainName = isPersonal
            ? String(event.title || event.name || '我的 BIG DAY').trim()
            : String(event.name || event.title || '').trim()
          const secondaryTitle = isPersonal
            ? String(event.note || '').trim()
            : isMerchant
              ? String(event.title || event.description || '').trim()
              : String(event.title || '').trim()

          monthEventRows.push({
            id: `${key}-${event.eventKey}`,
            dateKey: key,
            dayLabel: `${date.getMonth() + 1}月${date.getDate()}日`,
            name: mainName,
            title:
              secondaryTitle && secondaryTitle !== mainName
                ? secondaryTitle
                : '',
            region: event.region,
            regionLabel:
              event.region === 'international'
                ? '国际'
                : event.region === 'merchant'
                  ? '商家活动'
                  : event.region === 'personal'
                    ? 'BIG DAY'
                    : '国内'
          })
        })
      })

    this.setData({
      days,
      monthEventRows,
      upcomingPersonalDates: this.buildUpcomingPersonalDates(personalDates)
    })

    this.applyMonthFilter(this.data.activeFilter)
    this.updateSelectedDate()
  },

  updateSelectedDate() {
    const selectedDate = parseDateKey(this.data.selectedDateKey)
    if (!selectedDate) return

    const selectedEvents = eventsForDate(
      selectedDate,
      this.data.holidayEvents,
      this.data.personalDates
    ).map((item) => ({
      ...item,
      regionLabel:
        item.region === 'international'
          ? '国际节日'
          : item.region === 'merchant'
            ? '商家活动'
            : item.region === 'personal'
              ? 'BIG DAY'
              : '国内节日',
      activityTimeText: String(item.activityTimeText || '').trim(),
      canRecommend: item.recommendationEnabled !== false
    }))

    const recommendedProducts = this.findRecommendedProducts(selectedEvents)
    const weekday = WEEK_LABELS[selectedDate.getDay()]

    this.setData({
      selectedDateLabel:
        `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 · 周${weekday}`,
      selectedSummary: selectedEvents.length
        ? selectedEvents.map((item) => item.name).join(' · ')
        : '普通日子',
      selectedEvents,
      recommendedProducts,
      days: this.data.days.map((cell) => ({
        ...cell,
        isSelected: cell.key === this.data.selectedDateKey
      }))
    })
  },

  findRecommendedProducts(events) {
    const available = this.data.products.filter(
      (item) => item.onSale !== false && Number(item.stock || 0) > 0
    )
    const configuredIds = events
      .filter((event) => event.recommendationEnabled !== false)
      .flatMap((event) => event.productIds || [])
      .map(String)

    const configured = configuredIds
      .map((id) => available.find((item) => String(item.id || item._id) === id))
      .filter(Boolean)

    const keywords = events
      .filter((event) => event.recommendationEnabled !== false)
      .flatMap((event) => event.searchKeywords || [])
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean)

    const matched = keywords.length
      ? available.filter((item) => {
          const text = productSearchText(item)
          return keywords.some((keyword) => text.includes(keyword))
        })
      : []

    const featured = available.filter((item) => item.featured === true)

    return uniqueProducts([
      ...configured,
      ...matched,
      ...featured
    ]).slice(0, 4)
  },

  buildUpcomingPersonalDates(personalDates) {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    return (personalDates || [])
      .filter((item) => item.enabled !== false)
      .map((item) => {
        let target = new Date(
          item.repeatYearly === false ? Number(item.year) : start.getFullYear(),
          Number(item.month) - 1,
          Number(item.day)
        )

        if (item.repeatYearly !== false && target < start) {
          target = new Date(
            start.getFullYear() + 1,
            Number(item.month) - 1,
            Number(item.day)
          )
        }

        const daysUntil = Math.round((target - start) / (24 * 60 * 60 * 1000))

        return {
          ...item,
          targetKey: dateKey(
            target.getFullYear(),
            target.getMonth() + 1,
            target.getDate()
          ),
          dateLabel: `${target.getMonth() + 1}月${target.getDate()}日`,
          countdownLabel: daysUntil === 0 ? '今天' : `还有${daysUntil}天`,
          reminderLabel: Number(item.remindDaysBefore || 0) > 0
            ? `提前${Number(item.remindDaysBefore)}天提醒`
            : '当天提醒'
        }
      })
      .filter((item) => Number.isFinite(Number(item.targetKey.slice(0, 4))))
      .sort((a, b) => a.targetKey.localeCompare(b.targetKey))
      .slice(0, 5)
  },

  previousMonth() {
    let { year, month } = this.data
    month -= 1
    if (month < 0) {
      month = 11
      year -= 1
    }
    this.changeMonth(year, month)
  },

  nextMonth() {
    let { year, month } = this.data
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
    this.changeMonth(year, month)
  },

  changeMonth(year, month) {
    const day = Math.min(
      parseDateKey(this.data.selectedDateKey)?.getDate() || 1,
      new Date(year, month + 1, 0).getDate()
    )

    this.setData({
      year,
      month,
      selectedDateKey: dateKey(year, month + 1, day)
    })
    this.rebuildMonth()
  },

  goToday() {
    const today = this._today
    this.setData({
      year: today.getFullYear(),
      month: today.getMonth(),
      selectedDateKey: dateKey(
        today.getFullYear(),
        today.getMonth() + 1,
        today.getDate()
      )
    })
    this.rebuildMonth()
  },

  selectDay(event) {
    const key = event.currentTarget.dataset.key
    const selectedDate = parseDateKey(key)
    if (!selectedDate) return

    this.setData({
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth(),
      selectedDateKey: key
    })
    this.rebuildMonth()
  },

  selectMonthFilter(event) {
    this.applyMonthFilter(event.currentTarget.dataset.value || 'all')
  },

  applyMonthFilter(value) {
    const filtered = value === 'all'
      ? this.data.monthEventRows
      : this.data.monthEventRows.filter((item) => item.region === value)

    this.setData({
      activeFilter: value,
      filteredMonthEventRows: filtered
    })
  },

  selectMonthEvent(event) {
    const key = event.currentTarget.dataset.key
    const selectedDate = parseDateKey(key)
    if (!selectedDate) return

    this.setData({
      selectedDateKey: key,
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth()
    })
    this.rebuildMonth()
    wx.pageScrollTo({ scrollTop: 0, duration: 240 })
  },

  openAddDate() {
    const selectedDate = parseDateKey(this.data.selectedDateKey) || new Date()
    this.setData({
      showEditor: true,
      form: emptyForm(selectedDate)
    })
  },

  editPersonalDate(event) {
    const id = String(event.currentTarget.dataset.id || '')
    const item = this.data.personalDates.find((date) => date.id === id)
    if (!item) return

    const reminderIndex = Math.max(
      0,
      REMINDER_OPTIONS.findIndex(
        (option) => option.value === Number(item.remindDaysBefore || 0)
      )
    )

    this.setData({
      showEditor: true,
      form: {
        id: item.id,
        title: item.title,
        date: dateKey(item.year, item.month, item.day),
        reminderIndex,
        note: item.note || ''
      }
    })
  },

  closeEditor() {
    this.setData({ showEditor: false })
  },

  preventClose() {},

  onFormTitle(event) {
    this.setData({ 'form.title': event.detail.value })
  },

  onFormNote(event) {
    this.setData({ 'form.note': event.detail.value })
  },

  onFormDate(event) {
    this.setData({ 'form.date': event.detail.value })
  },

  onFormReminder(event) {
    this.setData({ 'form.reminderIndex': Number(event.detail.value) })
  },


  saveForm() {
    const form = this.data.form
    const selectedDate = parseDateKey(form.date)
    const title = String(form.title || '').trim()

    if (!title) {
      wx.showToast({ title: '请输入 BIG DAY 名称', icon: 'none' })
      return
    }

    if (!selectedDate) {
      wx.showToast({ title: '请选择日期', icon: 'none' })
      return
    }

    saveImportantDate({
      id: form.id,
      title,
      eventType: 'custom',
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth() + 1,
      day: selectedDate.getDate(),
      repeatYearly: true,
      remindDaysBefore:
        REMINDER_OPTIONS[form.reminderIndex]?.value || 0,
      categoryPreference: '花束',
      note: String(form.note || '').trim(),
      enabled: true
    })

    this.setData({
      showEditor: false,
      personalDates: getImportantDates()
    })
    this.rebuildMonth()

    wx.showToast({ title: 'BIG DAY 已保存', icon: 'success' })
  },

  deletePersonalDate(event) {
    const id = String(event.currentTarget.dataset.id || '')
    const item = this.data.personalDates.find((date) => date.id === id)
    if (!item) return

    wx.showModal({
      title: '删除 BIG DAY',
      content: `确定删除“${item.title}”吗？`,
      confirmText: '删除',
      confirmColor: '#c65f67',
      success: (result) => {
        if (!result.confirm) return
        deleteImportantDate(id)
        this.setData({ personalDates: getImportantDates() })
        this.rebuildMonth()
      }
    })
  },

  viewRecommendations(event) {
    const eventKey = event.currentTarget.dataset.eventKey
    const selected = this.data.selectedEvents.find((item) => item.eventKey === eventKey)
      || this.data.selectedEvents.find((item) => item.canRecommend)

    if (!selected) return

    const keyword = (selected.searchKeywords || [])[0] || selected.name
    wx.setStorageSync('huayuCategoryIntent', selected.categoryIntent || '花束')
    wx.setStorageSync('huayuCategorySearch', keyword)
    wx.switchTab({ url: '/pages/category/index' })
  },

  openProductDetail(event) {
    const id = String(event.currentTarget.dataset.productId || '')
    if (!id) return
    wx.navigateTo({
      url: `/pages/product-detail/index?id=${encodeURIComponent(id)}`
    })
  },

  addProduct(event) {
    const id = String(event.currentTarget.dataset.productId || '')
    const product = this.data.products.find(
      (item) => String(item.id || item._id) === id
    )

    if (!product) return
    addToCart(product)
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  }
})
