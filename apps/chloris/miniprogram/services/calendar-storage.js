const IMPORTANT_DATES_KEY = 'huayu_important_dates_v1'

function normalizeItem(item) {
  return {
    id: String(item.id || ''),
    title: String(item.title || '').trim(),
    eventType: String(item.eventType || 'birthday'),
    year: Number(item.year || new Date().getFullYear()),
    month: Number(item.month || 1),
    day: Number(item.day || 1),
    repeatYearly: item.repeatYearly !== false,
    remindDaysBefore: Math.max(0, Number(item.remindDaysBefore || 0)),
    categoryPreference: String(item.categoryPreference || '推荐花束'),
    note: String(item.note || '').trim(),
    enabled: item.enabled !== false,
    createdAt: Number(item.createdAt || Date.now()),
    updatedAt: Number(item.updatedAt || Date.now())
  }
}

function getImportantDates() {
  try {
    const raw = wx.getStorageSync(IMPORTANT_DATES_KEY)
    return Array.isArray(raw)
      ? raw.map(normalizeItem).filter((item) => item.id && item.title)
      : []
  } catch (error) {
    console.warn('读取重要日子失败：', error)
    return []
  }
}

function setImportantDates(items) {
  const normalized = (items || []).map(normalizeItem)
  wx.setStorageSync(IMPORTANT_DATES_KEY, normalized)
  return normalized
}

function saveImportantDate(input) {
  const items = getImportantDates()
  const now = Date.now()
  const id = String(input.id || `important_${now}`)
  const next = normalizeItem({
    ...input,
    id,
    createdAt: input.createdAt || now,
    updatedAt: now
  })
  const index = items.findIndex((item) => item.id === id)

  if (index >= 0) items[index] = next
  else items.push(next)

  setImportantDates(items)
  return next
}

function deleteImportantDate(id) {
  return setImportantDates(
    getImportantDates().filter((item) => item.id !== String(id))
  )
}

module.exports = {
  getImportantDates,
  saveImportantDate,
  deleteImportantDate
}
