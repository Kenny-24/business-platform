const crypto = require('crypto')
const cloudbase = require('@cloudbase/node-sdk')
const { cloneHolidayCatalog } = require('./holiday-catalog')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const auth = app.auth()

const MAX_ROWS = 100
const COLLECTIONS = {
  admins: 'admins',
  products: 'products',
  banners: 'banners',
  calendarEvents: 'calendarEvents',
  importJobs: 'importJobs'
}

const IMPORT_META = {
  products: {
    label: '商品',
    collection: COLLECTIONS.products,
    codeField: 'sku',
    imageField: 'coverFileId',
    prefix: 'product'
  },
  banners: {
    label: '横幅',
    collection: COLLECTIONS.banners,
    codeField: 'bannerCode',
    imageField: 'imageFileId',
    prefix: 'banner'
  },
  calendarEvents: {
    label: '节日',
    collection: COLLECTIONS.calendarEvents,
    codeField: 'eventKey',
    imageField: '',
    prefix: 'calendar'
  }
}

const PRODUCT_TYPES = new Set([
  'flower',
  'bouquet',
  'succulent',
  'greenPlant',
  'vase',
  'gift'
])
const BANNER_PLACEMENTS = new Set(['home', 'categoryHero'])
const BANNER_ACTION_TYPES = new Set(['category', 'calendar', 'builder'])
const REGIONS = new Set(['domestic', 'international'])
const DATE_RULES = new Set(['builtIn', 'fixed'])

class BusinessError extends Error {
  constructor(message, code = 'BUSINESS_ERROR', details = null) {
    super(message)
    this.code = code
    this.details = details
  }
}

function success(data = null) {
  return { ok: true, data }
}

function failure(error) {
  console.error('[dataImportApi]', error)
  return {
    ok: false,
    code: error.code || 'INTERNAL_ERROR',
    message: error.message || '服务器暂时无法处理该操作',
    details: error.details || null
  }
}

function text(value, fallback = '') {
  return String(value ?? fallback).trim()
}

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function integer(value, fallback = 0) {
  return Math.max(0, Math.round(number(value, fallback)))
}

function hasOwn(value, key) {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key))
}

function parseBoolean(value) {
  if (value === true || value === false) return value
  const normalized = text(value).toLowerCase()
  if (!normalized) return undefined
  if (['是', 'true', '1', 'yes', 'y', '启用', '发布'].includes(normalized)) return true
  if (['否', 'false', '0', 'no', 'n', '停用', '禁用', '草稿'].includes(normalized)) return false
  return null
}

function stringArray(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => text(item)).filter(Boolean))]
  }
  const source = text(value)
  if (!source) return []
  return [...new Set(
    source
      .split(/[|｜,，、;；\n\r]+/)
      .map((item) => text(item))
      .filter(Boolean)
  )]
}

function normalizedCode(value, preserveCase = false) {
  const result = text(value).replace(/\s+/g, '-')
  return preserveCase ? result : result.toUpperCase()
}

function codeKey(value) {
  return text(value).toLowerCase()
}

function validBusinessCode(value) {
  return /^[A-Za-z0-9_-]{2,80}$/.test(text(value))
}

function basename(value) {
  return text(value).replace(/\\/g, '/').split('/').pop().toLowerCase()
}

function safeClone(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function stripId(document) {
  if (!document || typeof document !== 'object') return {}
  const result = { ...document }
  delete result._id
  return result
}

function createJobId() {
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('')
  return `IMP-${stamp}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
}

function createDocumentId(type, code) {
  if (type === 'calendarEvents') return text(code)
  const meta = IMPORT_META[type]
  const slug = text(code)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
  return `${meta.prefix}_${slug || crypto.randomUUID()}`
}

function dateValue(value) {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'object' && value.$date) return new Date(value.$date).getTime()
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function isoDate(value) {
  const timestamp = dateValue(value)
  return timestamp ? new Date(timestamp).toISOString() : ''
}

function isMissingCollectionError(error) {
  const message = String(error && (error.message || error))
  return (
    message.includes('not exist') ||
    message.includes('does not exist') ||
    message.includes('不存在')
  )
}

function firstDocument(result) {
  const data = result && result.data
  if (Array.isArray(data)) return data[0] || null
  return data && typeof data === 'object' ? data : null
}

async function collectionExists(collectionName) {
  try {
    await db.collection(collectionName).limit(1).get()
    return true
  } catch (error) {
    if (isMissingCollectionError(error)) return false
    throw error
  }
}

async function assertCollectionExists(collectionName) {
  if (!(await collectionExists(collectionName))) {
    throw new BusinessError(
      `数据库集合 ${collectionName} 不存在，请先在云开发控制台创建该集合`,
      'COLLECTION_NOT_FOUND'
    )
  }
}

async function safeGetAll(collectionName, limit = 1000) {
  try {
    const result = await db.collection(collectionName).limit(limit).get()
    return Array.isArray(result.data) ? result.data : []
  } catch (error) {
    if (isMissingCollectionError(error)) return []
    throw error
  }
}

function getCallerIdentity() {
  const identity = auth.getUserInfo()
  const uid = text(identity && identity.uid)
  if (!uid) throw new BusinessError('登录状态已失效，请重新登录', 'UNAUTHORIZED')
  return { ...identity, uid }
}

async function getAdminByUid(uid) {
  try {
    return firstDocument(await db.collection(COLLECTIONS.admins).doc(uid).get())
  } catch (error) {
    if (isMissingCollectionError(error)) return null
    throw error
  }
}

async function requireAdmin() {
  const identity = getCallerIdentity()
  const admin = await getAdminByUid(identity.uid)
  if (!admin || admin.enabled !== true) {
    throw new BusinessError('当前账号不是Chloris 管理员', 'FORBIDDEN')
  }
  return { identity, admin }
}

function addIfProvided(target, source, key, transform = (value) => value) {
  if (!hasOwn(source, key)) return
  const value = source[key]
  if (value === '' || value === null || value === undefined) return
  target[key] = transform(value)
}

function addBooleanIfProvided(target, source, key, errors, label) {
  if (!hasOwn(source, key) || text(source[key]) === '') return
  const value = parseBoolean(source[key])
  if (value === null) {
    errors.push(`${label}只能填写“是”或“否”`)
    return
  }
  target[key] = value
}

function normalizeProduct(input) {
  const errors = []
  const warnings = []
  const data = {}
  const sku = normalizedCode(input.sku)
  const name = text(input.name)
  const type = text(input.type)

  if (!sku) errors.push('商品编码不能为空')
  else if (!validBusinessCode(sku)) errors.push('商品编码格式不正确')
  if (!name) errors.push('商品名称不能为空')
  if (!PRODUCT_TYPES.has(type)) errors.push('商品类型不正确')
  const hasPriceYuan = hasOwn(input, 'priceYuan') && text(input.priceYuan) !== ''
  const hasPriceFen = hasOwn(input, 'priceFen') && text(input.priceFen) !== ''
  if (!hasPriceYuan && !hasPriceFen) errors.push('价格不能为空')
  else if (hasPriceYuan && number(input.priceYuan, -1) < 0) errors.push('价格不能小于 0')
  else if (hasPriceFen && number(input.priceFen, -1) < 0) errors.push('价格不能小于 0')
  if (!text(input.unit)) errors.push('销售单位不能为空')
  if (!hasOwn(input, 'stock') || text(input.stock) === '') errors.push('库存不能为空')
  else if (!Number.isInteger(Number(input.stock)) || Number(input.stock) < 0) errors.push('库存必须为非负整数')

  data.sku = sku
  data.name = name
  data.type = type
  if (hasPriceYuan) {
    data.priceFen = Math.round(number(input.priceYuan) * 100)
  } else if (hasPriceFen) {
    data.priceFen = Math.round(number(input.priceFen))
  }
  if (hasOwn(input, 'stock') && text(input.stock) !== '') data.stock = integer(input.stock)
  addIfProvided(data, input, 'category', text)
  addIfProvided(data, input, 'subtitle', text)
  addIfProvided(data, input, 'unit', text)
  addIfProvided(data, input, 'sceneTags', stringArray)
  addIfProvided(data, input, 'colorTags', stringArray)
  addIfProvided(data, input, 'searchKeywords', stringArray)
  addIfProvided(data, input, 'coverFileId', text)
  addIfProvided(data, input, 'galleryFileIds', stringArray)
  addIfProvided(data, input, 'videoFileId', text)
  addIfProvided(data, input, 'videoPosterFileId', text)
  addIfProvided(data, input, 'detailDescription', text)
  addIfProvided(data, input, 'flowerMaterialInfo', text)
  addIfProvided(data, input, 'sizeDescription', text)
  addIfProvided(data, input, 'deliveryDescription', text)
  addIfProvided(data, input, 'careDescription', text)
  addIfProvided(data, input, 'imageFileName', text)
  addBooleanIfProvided(data, input, 'onSale', errors, '是否上架')
  addBooleanIfProvided(data, input, 'featured', errors, '是否推荐')
  if (hasOwn(input, 'sort') && text(input.sort) !== '') data.sort = integer(input.sort, 100)

  if (!text(data.coverFileId) && !text(data.imageFileName)) warnings.push('未配置商品图片')
  return { code: sku, data, errors, warnings }
}

function normalizeBanner(input) {
  const errors = []
  const warnings = []
  const data = {}
  const bannerCode = normalizedCode(input.bannerCode)
  const title = text(input.title)
  const placement = text(input.placement)

  if (!bannerCode) errors.push('横幅编码不能为空')
  else if (!validBusinessCode(bannerCode)) errors.push('横幅编码格式不正确')
  if (!title) errors.push('主标题不能为空')
  if (!BANNER_PLACEMENTS.has(placement)) errors.push('展示位置不正确')

  data.bannerCode = bannerCode
  data.title = title
  data.placement = placement
  addIfProvided(data, input, 'scene', text)
  addIfProvided(data, input, 'subtitle', text)
  addIfProvided(data, input, 'buttonText', text)
  addIfProvided(data, input, 'actionValue', text)
  addIfProvided(data, input, 'imageFileId', text)
  addIfProvided(data, input, 'imageFileName', text)

  if (hasOwn(input, 'actionType') && text(input.actionType)) {
    const value = text(input.actionType)
    if (!BANNER_ACTION_TYPES.has(value)) errors.push('跳转类型不正确')
    else data.actionType = value
  }
  addBooleanIfProvided(data, input, 'enabled', errors, '是否启用')
  if (hasOwn(input, 'sort') && text(input.sort) !== '') data.sort = integer(input.sort, 100)

  if (!text(data.imageFileId) && !text(data.imageFileName)) warnings.push('未配置横幅图片')
  return { code: bannerCode, data, errors, warnings }
}

function normalizeCalendar(input) {
  const errors = []
  const warnings = []
  const data = {}
  const eventKey = normalizedCode(input.eventKey, true)
  const name = text(input.name)
  const region = text(input.region)
  const ruleType = text(input.ruleType)

  if (!eventKey) errors.push('节日编码不能为空')
  else if (!validBusinessCode(eventKey)) errors.push('节日编码格式不正确')
  if (!name) errors.push('节日名称不能为空')
  if (!REGIONS.has(region)) errors.push('地区只能为 domestic 或 international')
  if (!DATE_RULES.has(ruleType)) errors.push('日期规则只能为 builtIn 或 fixed')

  data.eventKey = eventKey
  data.name = name
  data.region = region
  data.ruleType = ruleType

  if (ruleType === 'fixed') {
    const month = integer(input.month)
    const day = integer(input.day)
    if (month < 1 || month > 12) errors.push('固定日期月份必须为 1-12')
    if (day < 1 || day > 31) errors.push('固定日期日期必须为 1-31')
    data.month = month
    data.day = day
  }

  addIfProvided(data, input, 'title', text)
  addIfProvided(data, input, 'description', text)
  addIfProvided(data, input, 'categoryIntent', text)
  addIfProvided(data, input, 'searchKeywords', stringArray)
  addIfProvided(data, input, 'productSkus', stringArray)
  addBooleanIfProvided(data, input, 'recommendationEnabled', errors, '启用推荐')
  addBooleanIfProvided(data, input, 'enabled', errors, '是否启用')
  if (hasOwn(input, 'sort') && text(input.sort) !== '') data.sort = integer(input.sort, 100)

  if (ruleType === 'builtIn' && !cloneHolidayCatalog().some((item) => item.eventKey === eventKey)) {
    errors.push('该节日编码没有对应的内置日期规则')
  }

  return { code: eventKey, data, errors, warnings }
}

function normalizeByType(type, input) {
  if (type === 'products') return normalizeProduct(input)
  if (type === 'banners') return normalizeBanner(input)
  if (type === 'calendarEvents') return normalizeCalendar(input)
  throw new BusinessError('不支持该导入类型', 'INVALID_IMPORT_TYPE')
}

function importJobView(item) {
  return {
    _id: item._id,
    importType: item.importType,
    importTypeLabel: IMPORT_META[item.importType] && IMPORT_META[item.importType].label,
    fileName: text(item.fileName),
    duplicateMode: text(item.duplicateMode),
    status: text(item.status),
    totalRows: integer(item.totalRows),
    createdCount: integer(item.createdCount),
    updatedCount: integer(item.updatedCount),
    skippedCount: integer(item.skippedCount),
    failedCount: integer(item.failedCount),
    rollbackCount: integer(item.rollbackCount),
    conflictCount: integer(item.conflictCount),
    errors: Array.isArray(item.errors) ? item.errors : [],
    createdAt: isoDate(item.createdAt),
    completedAt: isoDate(item.completedAt),
    rolledBackAt: isoDate(item.rolledBackAt),
    createdByName: text(item.createdByName),
    note: text(item.note)
  }
}

async function readiness() {
  const result = {}
  let missingCodeTotal = 0

  for (const [key, meta] of Object.entries(IMPORT_META)) {
    const ready = await collectionExists(meta.collection)
    const items = ready ? await safeGetAll(meta.collection) : []
    const missingCode = items.filter((item) => !text(item[meta.codeField])).length
    missingCodeTotal += missingCode
    result[key] = {
      collection: meta.collection,
      ready,
      total: items.length,
      missingCode
    }
  }

  result.importJobs = {
    collection: COLLECTIONS.importJobs,
    ready: await collectionExists(COLLECTIONS.importJobs)
  }

  return {
    maxRows: MAX_ROWS,
    collections: result,
    missingCodeTotal,
    importOrder: ['products', 'banners', 'calendarEvents']
  }
}

async function backfillBusinessCodes(adminContext) {
  const targets = ['products', 'banners']
  const result = {}
  let total = 0

  for (const type of targets) {
    const meta = IMPORT_META[type]
    await assertCollectionExists(meta.collection)
    const items = await safeGetAll(meta.collection)
    let count = 0

    for (const item of items) {
      if (text(item[meta.codeField])) continue
      const prefix = type === 'products' ? 'SKU' : 'BNR'
      const suffix = text(item._id)
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(-10)
        .toUpperCase() || crypto.randomBytes(4).toString('hex').toUpperCase()
      await db.collection(meta.collection).doc(item._id).update({
        [meta.codeField]: `${prefix}-${suffix}`,
        updatedAt: new Date(),
        updatedBy: adminContext.identity.uid
      })
      count += 1
    }

    result[type] = count
    total += count
  }

  return { total, items: result }
}

async function buildContext(type) {
  const meta = IMPORT_META[type]
  const existing = await safeGetAll(meta.collection)
  const existingByCode = new Map()
  for (const item of existing) {
    const code = text(item[meta.codeField])
    if (code) existingByCode.set(codeKey(code), item)
  }

  const products = type === 'calendarEvents' ? await safeGetAll(COLLECTIONS.products) : []
  const productsBySku = new Map()

  for (const item of products) {
    if (text(item.sku)) productsBySku.set(codeKey(item.sku), item)
  }

  return { existing, existingByCode, productsBySku }
}

async function validateRows({ type, rows, duplicateMode, availableImageNames, requireImages }) {
  const meta = IMPORT_META[type]
  if (!meta) throw new BusinessError('不支持该导入类型', 'INVALID_IMPORT_TYPE')
  if (!Array.isArray(rows) || !rows.length) throw new BusinessError('没有可导入的数据')
  if (rows.length > MAX_ROWS) {
    throw new BusinessError(`单次最多导入 ${MAX_ROWS} 行，请拆分文件`, 'ROW_LIMIT_EXCEEDED')
  }
  if (!['upsert', 'skip', 'abort'].includes(duplicateMode)) {
    throw new BusinessError('重复数据处理方式不正确')
  }

  await assertCollectionExists(meta.collection)
  const context = await buildContext(type)
  const imageNames = new Set((availableImageNames || []).map(basename).filter(Boolean))
  const seenCodes = new Set()
  const resultRows = []

  rows.forEach((input, index) => {
    const rowNo = integer(input.rowNo, index + 5)
    const normalized = normalizeByType(type, input)
    const errors = [...normalized.errors]
    const warnings = [...normalized.warnings]
    const code = normalized.code
    const key = codeKey(code)

    if (key && seenCodes.has(key)) errors.push('导入文件内编码重复')
    if (key) seenCodes.add(key)

    const existing = key ? context.existingByCode.get(key) : null
    let action = existing ? 'update' : 'create'

    if (existing && duplicateMode === 'skip') action = 'skip'
    if (existing && duplicateMode === 'abort') errors.push('数据库中已存在相同编码')

    if (type === 'calendarEvents') {
      const skus = stringArray(normalized.data.productSkus)
      const missing = []
      const productIds = []
      skus.forEach((sku) => {
        const item = context.productsBySku.get(codeKey(sku))
        if (!item) missing.push(sku)
        else productIds.push(item._id)
      })
      if (missing.length) errors.push(`关联商品不存在：${missing.join('、')}`)
      if (skus.length) {
        normalized.data.productSkus = skus.map((item) => normalizedCode(item))
        normalized.data.productIds = productIds
      }
    }

    if (meta.imageField) {
      const fileId = text(normalized.data[meta.imageField])
      const imageFileName = basename(normalized.data.imageFileName)
      const existingImage = existing && text(existing[meta.imageField])
      const matchedZipImage = imageFileName && imageNames.has(imageFileName)
      if (imageFileName && !matchedZipImage && !fileId) {
        errors.push(`图片 ZIP 中未找到：${normalized.data.imageFileName}`)
      }
      if (requireImages === true && action === 'create' && !fileId && !matchedZipImage && !existingImage) {
        errors.push('新数据必须提供图片文件或图片 FileID')
      }
    }

    resultRows.push({
      rowNo,
      code,
      name: text(normalized.data.name || normalized.data.title),
      action,
      existingId: existing && existing._id || '',
      data: normalized.data,
      errors,
      warnings,
      valid: errors.length === 0
    })
  })

  const stats = {
    total: resultRows.length,
    valid: resultRows.filter((item) => item.valid).length,
    invalid: resultRows.filter((item) => !item.valid).length,
    create: resultRows.filter((item) => item.valid && item.action === 'create').length,
    update: resultRows.filter((item) => item.valid && item.action === 'update').length,
    skip: resultRows.filter((item) => item.valid && item.action === 'skip').length,
    warning: resultRows.filter((item) => item.warnings.length).length
  }

  return {
    type,
    typeLabel: meta.label,
    rows: resultRows,
    stats,
    importJobsReady: await collectionExists(COLLECTIONS.importJobs)
  }
}

function buildDocument(type, rowData, existing, adminContext, jobId) {
  const now = new Date()
  const base = existing ? stripId(existing) : {}
  const incoming = {}

  function setText(key, fallback = '') {
    if (hasOwn(rowData, key)) incoming[key] = text(rowData[key], fallback)
  }

  function setArray(key) {
    if (hasOwn(rowData, key)) incoming[key] = stringArray(rowData[key])
  }

  function setBoolean(key) {
    if (hasOwn(rowData, key)) incoming[key] = Boolean(rowData[key])
  }

  function setInteger(key, fallback = 0) {
    if (hasOwn(rowData, key)) incoming[key] = integer(rowData[key], fallback)
  }

  if (type === 'products') {
    incoming.sku = normalizedCode(rowData.sku)
    incoming.name = text(rowData.name)
    incoming.type = text(rowData.type)
    ;[
      'category',
      'subtitle',
      'unit',
      'coverFileId',
      'videoFileId',
      'videoPosterFileId',
      'detailDescription',
      'flowerMaterialInfo',
      'sizeDescription',
      'deliveryDescription',
      'careDescription'
    ].forEach((key) => setText(key))
    ;['sceneTags', 'colorTags', 'searchKeywords', 'galleryFileIds'].forEach(setArray)
    ;['onSale', 'featured'].forEach(setBoolean)
    ;['priceFen', 'stock', 'sort'].forEach((key) => setInteger(key, key === 'sort' ? 100 : 0))
  }

  if (type === 'banners') {
    incoming.bannerCode = normalizedCode(rowData.bannerCode)
    incoming.title = text(rowData.title)
    incoming.placement = text(rowData.placement)
    ;[
      'scene',
      'subtitle',
      'buttonText',
      'actionType',
      'actionValue',
      'imageFileId'
    ].forEach((key) => setText(key))
    setBoolean('enabled')
    setInteger('sort', 100)
  }

  if (type === 'calendarEvents') {
    const builtIn = cloneHolidayCatalog().find((item) => item.eventKey === rowData.eventKey)
    incoming.eventKey = text(rowData.eventKey)
    incoming.name = text(rowData.name)
    incoming.region = text(rowData.region)

    if (rowData.ruleType === 'builtIn') {
      incoming.rule = builtIn && builtIn.rule
    } else if (rowData.ruleType === 'fixed') {
      incoming.rule = {
        type: 'fixed',
        month: integer(rowData.month),
        day: integer(rowData.day)
      }
    }

    ;['title', 'description', 'categoryIntent'].forEach((key) => setText(key))
    ;['searchKeywords', 'productSkus', 'productIds'].forEach(setArray)
    ;['recommendationEnabled', 'enabled'].forEach(setBoolean)
    setInteger('sort', 100)
  }

  const defaults = {}
  if (!existing && type === 'products') {
    Object.assign(defaults, {
      category: '',
      subtitle: '',
      priceFen: 0,
      unit: '件',
      stock: 0,
      sceneTags: [],
      colorTags: [],
      searchKeywords: [],
      coverFileId: '',
      onSale: true,
      featured: false,
      sort: 100
    })
  }
  if (!existing && type === 'banners') {
    Object.assign(defaults, {
      scene: '',
      subtitle: '',
      buttonText: '立即查看',
      actionType: 'category',
      actionValue: '推荐花束',
      imageFileId: '',
      enabled: true,
      sort: 100
    })
  }
  if (!existing && type === 'calendarEvents') {
    Object.assign(defaults, {
      title: text(rowData.name),
      description: '',
      categoryIntent: '推荐花束',
      searchKeywords: [],
      productSkus: [],
      productIds: [],
      recommendationEnabled: true,
      enabled: true,
      sort: 100
    })
  }

  return {
    ...defaults,
    ...base,
    ...incoming,
    createdAt: existing && existing.createdAt || now,
    updatedAt: now,
    updatedBy: adminContext.identity.uid,
    importBatchId: jobId,
    importedAt: now,
    importedBy: adminContext.identity.uid
  }
}

async function commitImport(event, adminContext) {
  await assertCollectionExists(COLLECTIONS.importJobs)
  const type = text(event.importType)
  const rows = Array.isArray(event.rows) ? event.rows : []
  const duplicateMode = text(event.duplicateMode, 'upsert')
  const validation = await validateRows({
    type,
    rows,
    duplicateMode,
    availableImageNames: [],
    requireImages: event.requireImages === true
  })

  if (validation.stats.invalid > 0) {
    throw new BusinessError(
      '导入数据仍有校验错误，请重新预览后再提交',
      'IMPORT_VALIDATION_FAILED',
      { rows: validation.rows.filter((item) => !item.valid) }
    )
  }

  const jobId = createJobId()
  const now = new Date()
  const jobBase = {
    importType: type,
    fileName: text(event.fileName),
    duplicateMode,
    note: text(event.note),
    status: 'running',
    totalRows: rows.length,
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    rollbackCount: 0,
    conflictCount: 0,
    errors: [],
    changes: [],
    createdAt: now,
    createdBy: adminContext.identity.uid,
    createdByName: text(adminContext.admin.name || adminContext.admin.username)
  }
  await db.collection(COLLECTIONS.importJobs).doc(jobId).set(jobBase)

  const meta = IMPORT_META[type]
  const errors = []
  const changes = []
  let createdCount = 0
  let updatedCount = 0
  let skippedCount = 0

  for (const row of validation.rows) {
    if (row.action === 'skip') {
      skippedCount += 1
      continue
    }

    try {
      let existing = null
      let id = text(row.existingId)
      if (id) {
        try {
          existing = firstDocument(await db.collection(meta.collection).doc(id).get())
        } catch (error) {}
      }
      if (!id) id = createDocumentId(type, row.code)

      const document = buildDocument(type, row.data, existing, adminContext, jobId)
      await db.collection(meta.collection).doc(id).set(document)
      changes.push({
        collection: meta.collection,
        id,
        operation: existing ? 'update' : 'create',
        before: existing ? safeClone(existing) : null,
        code: row.code,
        rowNo: row.rowNo
      })
      if (existing) updatedCount += 1
      else createdCount += 1
    } catch (error) {
      errors.push({
        rowNo: row.rowNo,
        code: row.code,
        message: error.message || '写入失败'
      })
    }
  }

  const status = errors.length ? (changes.length ? 'partial' : 'failed') : 'completed'
  const completedAt = new Date()
  await db.collection(COLLECTIONS.importJobs).doc(jobId).update({
    status,
    createdCount,
    updatedCount,
    skippedCount,
    failedCount: errors.length,
    errors,
    changes,
    completedAt
  })

  return importJobView({
    _id: jobId,
    ...jobBase,
    status,
    createdCount,
    updatedCount,
    skippedCount,
    failedCount: errors.length,
    errors,
    completedAt
  })
}

async function listImportJobs() {
  await assertCollectionExists(COLLECTIONS.importJobs)
  const items = await safeGetAll(COLLECTIONS.importJobs, 200)
  return {
    items: items
      .sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))
      .map((item) => importJobView(item))
  }
}

async function getImportJob(event) {
  await assertCollectionExists(COLLECTIONS.importJobs)
  const id = text(event.id)
  if (!id) throw new BusinessError('缺少导入批次号')
  const item = firstDocument(await db.collection(COLLECTIONS.importJobs).doc(id).get())
  if (!item) throw new BusinessError('导入记录不存在', 'NOT_FOUND')
  return {
    ...importJobView(item),
    changeCount: Array.isArray(item.changes) ? item.changes.length : 0
  }
}

async function rollbackImport(event, adminContext) {
  await assertCollectionExists(COLLECTIONS.importJobs)
  const id = text(event.id)
  if (!id) throw new BusinessError('缺少导入批次号')
  const job = firstDocument(await db.collection(COLLECTIONS.importJobs).doc(id).get())
  if (!job) throw new BusinessError('导入记录不存在', 'NOT_FOUND')
  if (!['completed', 'partial'].includes(text(job.status))) {
    throw new BusinessError('当前批次状态不允许回滚')
  }

  const changes = Array.isArray(job.changes) ? [...job.changes].reverse() : []
  let rollbackCount = 0
  let conflictCount = 0
  const conflicts = []

  for (const change of changes) {
    try {
      let current = null
      try {
        current = firstDocument(await db.collection(change.collection).doc(change.id).get())
      } catch (error) {}

      if (!current || text(current.importBatchId) !== id) {
        conflictCount += 1
        conflicts.push({ code: change.code, rowNo: change.rowNo, message: '记录已被后续编辑或删除，已跳过' })
        continue
      }

      if (change.operation === 'create') {
        await db.collection(change.collection).doc(change.id).remove()
      } else if (change.operation === 'update' && change.before) {
        await db.collection(change.collection).doc(change.id).set(stripId(change.before))
      }
      rollbackCount += 1
    } catch (error) {
      conflictCount += 1
      conflicts.push({ code: change.code, rowNo: change.rowNo, message: error.message || '回滚失败' })
    }
  }

  const status = conflictCount ? 'rollbackPartial' : 'rolledBack'
  const rolledBackAt = new Date()
  await db.collection(COLLECTIONS.importJobs).doc(id).update({
    status,
    rollbackCount,
    conflictCount,
    rollbackConflicts: conflicts,
    rolledBackAt,
    rolledBackBy: adminContext.identity.uid
  })

  return {
    id,
    status,
    rollbackCount,
    conflictCount,
    conflicts,
    rolledBackAt: rolledBackAt.toISOString()
  }
}

exports.main = async (event = {}) => {
  try {
    const action = text(event.action)
    if (!action) throw new BusinessError('缺少 action')
    const adminContext = await requireAdmin()

    switch (action) {
      case 'readiness': return success(await readiness())
      case 'backfillBusinessCodes': return success(await backfillBusinessCodes(adminContext))
      case 'validateImport': return success(await validateRows({
        type: text(event.importType),
        rows: Array.isArray(event.rows) ? event.rows : [],
        duplicateMode: text(event.duplicateMode, 'upsert'),
        availableImageNames: Array.isArray(event.availableImageNames) ? event.availableImageNames : [],
        requireImages: event.requireImages === true
      }))
      case 'commitImport': return success(await commitImport(event, adminContext))
      case 'listImportJobs': return success(await listImportJobs())
      case 'getImportJob': return success(await getImportJob(event))
      case 'rollbackImport': return success(await rollbackImport(event, adminContext))
      default: throw new BusinessError(`未知操作：${action}`, 'UNKNOWN_ACTION')
    }
  } catch (error) {
    return failure(error)
  }
}
