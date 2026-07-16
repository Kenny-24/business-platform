const STORAGE_KEY = 'huayu_atlas_favorites_v1'

function normalizeIds(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))]
}

function getAtlasFavoriteIds() {
  try {
    return normalizeIds(wx.getStorageSync(STORAGE_KEY))
  } catch (error) {
    console.warn('读取图鉴收藏失败：', error)
    return []
  }
}

function setAtlasFavoriteIds(ids) {
  const normalized = normalizeIds(ids)
  try {
    wx.setStorageSync(STORAGE_KEY, normalized)
  } catch (error) {
    console.warn('保存图鉴收藏失败：', error)
  }
  return normalized
}

function toggleAtlasFavorite(id) {
  const target = String(id || '').trim()
  if (!target) return getAtlasFavoriteIds()

  const ids = getAtlasFavoriteIds()
  const next = ids.includes(target)
    ? ids.filter((item) => item !== target)
    : [...ids, target]

  return setAtlasFavoriteIds(next)
}

module.exports = {
  getAtlasFavoriteIds,
  setAtlasFavoriteIds,
  toggleAtlasFavorite
}
