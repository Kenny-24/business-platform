const LUNAR_INFO = [
  0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
  0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
  0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
  0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
  0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
  0x06ca0,0x0b550,0x15355,0x04da0,0x0a5d0,0x14573,0x052d0,0x0a9a8,0x0e950,0x06aa0,
  0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
  0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b5a0,0x195a6,
  0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
  0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,
  0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
  0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
  0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
  0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
  0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
  0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
  0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
  0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
  0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x04b55,0x04b60,0x0a570,0x054e4,0x0d160,
  0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
  0x0d520
]

const DAY_MS = 24 * 60 * 60 * 1000
const BASE_UTC = Date.UTC(1900, 0, 31)

function pad(value) {
  return String(value).padStart(2, '0')
}

function dateKey(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`
}

function leapMonth(year) {
  return LUNAR_INFO[year - 1900] & 0xf
}

function leapDays(year) {
  const month = leapMonth(year)
  if (!month) return 0
  return (LUNAR_INFO[year - 1900] & 0x10000) ? 30 : 29
}

function lunarMonthDays(year, month) {
  return (LUNAR_INFO[year - 1900] & (0x10000 >> month)) ? 30 : 29
}

function lunarYearDays(year) {
  let total = 348
  let mask = 0x8000

  while (mask > 0x8) {
    if (LUNAR_INFO[year - 1900] & mask) total += 1
    mask >>= 1
  }

  return total + leapDays(year)
}

function solarToLunar(date) {
  const utc = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  )

  let offset = Math.floor((utc - BASE_UTC) / DAY_MS)
  if (offset < 0) return null

  let year = 1900
  let temp = 0

  for (; year <= 2100 && offset > 0; year += 1) {
    temp = lunarYearDays(year)
    offset -= temp
  }

  if (offset < 0) {
    offset += temp
    year -= 1
  }

  if (year > 2100) return null

  const leap = leapMonth(year)
  let isLeap = false
  let month = 1

  for (; month <= 12 && offset > 0; month += 1) {
    if (leap > 0 && month === leap + 1 && !isLeap) {
      month -= 1
      isLeap = true
      temp = leapDays(year)
    } else {
      temp = lunarMonthDays(year, month)
    }

    if (isLeap && month === leap + 1) {
      isLeap = false
    }

    offset -= temp
  }

  if (offset === 0 && leap > 0 && month === leap + 1) {
    if (isLeap) {
      isLeap = false
    } else {
      isLeap = true
      month -= 1
    }
  }

  if (offset < 0) {
    offset += temp
    month -= 1
  }

  return {
    year,
    month,
    day: offset + 1,
    isLeap,
    monthDays: isLeap
      ? leapDays(year)
      : lunarMonthDays(year, month)
  }
}

function westernEaster(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1

  return new Date(year, month - 1, day)
}

function nthWeekdayDate(year, month, weekday, nth) {
  const first = new Date(year, month - 1, 1)
  const delta = (weekday - first.getDay() + 7) % 7
  return 1 + delta + (nth - 1) * 7
}

function qingmingDay(year) {
  if (year < 2000 || year > 2099) return 4
  const shortYear = year % 100
  return Math.floor(shortYear * 0.2422 + 4.81) - Math.floor(shortYear / 4)
}

function winterSolsticeDay(year) {
  if (year < 2000 || year > 2099) return 22
  const shortYear = year % 100
  return Math.floor(shortYear * 0.2422 + 21.94) - Math.floor(shortYear / 4)
}

function isSameDate(date, other) {
  return (
    date.getFullYear() === other.getFullYear() &&
    date.getMonth() === other.getMonth() &&
    date.getDate() === other.getDate()
  )
}

function eventMatchesDate(event, date) {
  const rule = event && event.rule
  if (!rule || event.enabled === false) return false

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  if (rule.type === 'fixed') {
    return month === Number(rule.month) && day === Number(rule.day)
  }

  if (rule.type === 'nthWeekday') {
    return (
      month === Number(rule.month) &&
      day === nthWeekdayDate(
        year,
        Number(rule.month),
        Number(rule.weekday),
        Number(rule.nth)
      )
    )
  }

  if (rule.type === 'easterOffset') {
    const easter = westernEaster(year)
    easter.setDate(easter.getDate() + Number(rule.offsetDays || 0))
    return isSameDate(date, easter)
  }

  if (rule.type === 'solarTerm') {
    if (rule.term === 'qingming') {
      return month === 4 && day === qingmingDay(year)
    }

    if (rule.term === 'winterSolstice') {
      return month === 12 && day === winterSolsticeDay(year)
    }

    return false
  }

  const lunar = solarToLunar(date)
  if (!lunar || lunar.isLeap) return false

  if (rule.type === 'lunar') {
    return (
      lunar.month === Number(rule.month) &&
      lunar.day === Number(rule.day)
    )
  }

  if (rule.type === 'lunarLastDay') {
    const tomorrow = new Date(year, month - 1, day + 1)
    const nextLunar = solarToLunar(tomorrow)
    return Boolean(
      nextLunar &&
      !nextLunar.isLeap &&
      nextLunar.month === 1 &&
      nextLunar.day === 1
    )
  }

  return false
}

function normalizePersonalDate(item) {
  return {
    ...item,
    id: String(item.id || ''),
    title: String(item.title || '').trim(),
    region: 'personal',
    regionLabel: '我的日子',
    eventKey: `personal-${item.id}`,
    description: item.note || '已设置个人重要日子提醒。',
    recommendationEnabled: true,
    searchKeywords: Array.isArray(item.searchKeywords)
      ? item.searchKeywords
      : [],
    categoryIntent: item.categoryPreference || '成品花束',
    sort: 2000
  }
}

function personalDateMatches(item, date) {
  if (!item || item.enabled === false) return false
  if (Number(item.month) !== date.getMonth() + 1) return false
  if (Number(item.day) !== date.getDate()) return false
  if (item.repeatYearly !== false) return true
  return Number(item.year) === date.getFullYear()
}

function eventsForDate(date, holidayEvents, personalDates) {
  const holidays = (holidayEvents || [])
    .filter((event) => eventMatchesDate(event, date))
    .map((event) => ({
      ...event,
      dateKey: dateKey(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate()
      )
    }))

  const personal = (personalDates || [])
    .filter((item) => personalDateMatches(item, date))
    .map(normalizePersonalDate)

  return [...personal, ...holidays].sort(
    (a, b) => Number(b.sort || 0) - Number(a.sort || 0)
  )
}

function monthEventMap(year, monthIndex, holidayEvents, personalDates) {
  const map = Object.create(null)
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()

  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, monthIndex, day)
    const events = eventsForDate(date, holidayEvents, personalDates)

    if (events.length) {
      map[dateKey(year, monthIndex + 1, day)] = events
    }
  }

  return map
}

function formatRule(rule) {
  if (!rule) return '未设置日期规则'
  if (rule.type === 'fixed') return `每年${rule.month}月${rule.day}日`
  if (rule.type === 'lunar') return `农历${rule.month}月${rule.day}日`
  if (rule.type === 'lunarLastDay') return '农历年最后一天'
  if (rule.type === 'nthWeekday') {
    const week = ['日', '一', '二', '三', '四', '五', '六'][rule.weekday]
    return `每年${rule.month}月第${rule.nth}个星期${week}`
  }
  if (rule.type === 'easterOffset') {
    const offset = Number(rule.offsetDays || 0)
    if (offset === 0) return '西方复活节'
    return `西方复活节${offset > 0 ? '后' : '前'}${Math.abs(offset)}天`
  }
  if (rule.type === 'solarTerm') {
    return rule.term === 'qingming' ? '清明节气日' : '冬至节气日'
  }
  return '自定义规则'
}

module.exports = {
  dateKey,
  solarToLunar,
  westernEaster,
  eventMatchesDate,
  eventsForDate,
  monthEventMap,
  formatRule
}
