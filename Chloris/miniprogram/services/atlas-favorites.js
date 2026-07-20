const STORAGE_KEY =
  'huayu_atlas_favorites_v1'

function text(value) {
  return String(value || '').trim()
}

function uniqueIds(value) {
  if (!Array.isArray(value)) return []

  const result = []
  const seen = new Set()

  value.forEach((item) => {
    const normalized = text(item)

    if (
      !normalized ||
      seen.has(normalized)
    ) {
      return
    }

    seen.add(normalized)
    result.push(normalized)
  })

  return result
}

function readFavoriteAtlasIds() {
  try {
    return uniqueIds(
      wx.getStorageSync(STORAGE_KEY)
    )
  } catch (error) {
    return []
  }
}

function writeFavoriteAtlasIds(ids) {
  const result = uniqueIds(ids)

  try {
    wx.setStorageSync(
      STORAGE_KEY,
      result
    )
  } catch (error) {
    console.warn(
      '保存图鉴收藏缓存失败：',
      error
    )
  }

  return result
}

function mergeFavoriteAtlasIds() {
  const merged = []

  for (
    let index = 0;
    index < arguments.length;
    index += 1
  ) {
    const source = arguments[index]

    if (Array.isArray(source)) {
      source.forEach((item) => {
        merged.push(item)
      })
    }
  }

  return writeFavoriteAtlasIds(merged)
}

function setCachedAtlasFavorite(
  id,
  favorite
) {
  const normalizedId = text(id)
  const current = new Set(
    readFavoriteAtlasIds()
  )

  if (!normalizedId) {
    return [...current]
  }

  if (favorite) {
    current.add(normalizedId)
  } else {
    current.delete(normalizedId)
  }

  return writeFavoriteAtlasIds(
    [...current]
  )
}

module.exports = {
  readFavoriteAtlasIds,
  writeFavoriteAtlasIds,
  mergeFavoriteAtlasIds,
  setCachedAtlasFavorite
}
