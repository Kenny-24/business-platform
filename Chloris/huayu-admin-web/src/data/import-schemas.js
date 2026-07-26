const BOOLEAN_TRUE = ['是', 'true', '1', 'yes', 'y', '启用', '发布']
const BOOLEAN_FALSE = ['否', 'false', '0', 'no', 'n', '停用', '禁用', '草稿']

function text(value) {
  return String(value ?? '').trim()
}

function splitList(value) {
  if (Array.isArray(value)) return [...new Set(value.map(text).filter(Boolean))]
  const source = text(value)
  if (!source) return undefined
  return [...new Set(
    source
      .split(/[|｜,，、;；\n\r]+/)
      .map(text)
      .filter(Boolean)
  )]
}

function booleanValue(value) {
  if (value === true || value === false) return value
  const normalized = text(value).toLowerCase()
  if (!normalized) return undefined
  if (BOOLEAN_TRUE.includes(normalized)) return true
  if (BOOLEAN_FALSE.includes(normalized)) return false
  return value
}

function numericValue(value) {
  const normalized = text(value)
  if (!normalized) return undefined
  const parsed = Number(normalized.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : value
}

function normalizeHeaders(rawRow, schema) {
  const normalized = {}
  const headers = schema.headerMap

  Object.entries(rawRow || {}).forEach(([rawKey, rawValue]) => {
    const header = text(rawKey).replace(/\*/g, '')
    const key = headers[header] || headers[rawKey] || rawKey
    if (!key) return
    if (rawValue === '' || rawValue === null || rawValue === undefined) return
    normalized[key] = rawValue
  })

  for (const key of schema.listFields || []) {
    if (Object.prototype.hasOwnProperty.call(normalized, key)) {
      normalized[key] = splitList(normalized[key])
    }
  }

  for (const key of schema.booleanFields || []) {
    if (Object.prototype.hasOwnProperty.call(normalized, key)) {
      normalized[key] = booleanValue(normalized[key])
    }
  }

  for (const key of schema.numberFields || []) {
    if (Object.prototype.hasOwnProperty.call(normalized, key)) {
      normalized[key] = numericValue(normalized[key])
    }
  }

  return normalized
}

export const importSchemas = {
  products: {
    value: 'products',
    label: '商品',
    collection: 'products',
    template: '/import-templates/商品导入模板.xlsx',
    imageFolder: 'products',
    imageFileNameField: 'imageFileName',
    imageFileIdField: 'coverFileId',
    description: '价格以元填写，云端保存为分。',
    headerMap: {
      '商品编码': 'sku',
      '商品名称': 'name',
      '商品类型': 'type',
      '商品分类': 'category',
      '副标题': 'subtitle',
      '价格（元）': 'priceYuan',
      '价格': 'priceYuan',
      '单位': 'unit',
      '库存': 'stock',
      '是否上架': 'onSale',
      '是否推荐': 'featured',
      '排序': 'sort',
      '场景标签': 'sceneTags',
      '颜色标签': 'colorTags',
      '搜索关键词': 'searchKeywords',
      '商品图片文件名': 'imageFileName',
      '图片文件名': 'imageFileName',
      '图片FileID（可选）': 'coverFileId',
      '图片FileID': 'coverFileId'
    },
    listFields: ['sceneTags', 'colorTags', 'searchKeywords'],
    booleanFields: ['onSale', 'featured'],
    numberFields: ['priceYuan', 'stock', 'sort'],
    previewColumns: [
      { key: 'sku', label: '商品编码', width: 140 },
      { key: 'name', label: '商品名称', width: 150 },
      { key: 'type', label: '类型', width: 100 },
      { key: 'priceYuan', label: '价格（元）', width: 100 },
      { key: 'stock', label: '库存', width: 80 },
      { key: 'imageFileName', label: '图片文件', minWidth: 170 }
    ]
  },
  banners: {
    value: 'banners',
    label: '横幅',
    collection: 'banners',
    template: '/import-templates/横幅导入模板.xlsx',
    imageFolder: 'banners',
    imageFileNameField: 'imageFileName',
    imageFileIdField: 'imageFileId',
    description: '仅用于首页轮播。建议图片风格、比例与 Chloris 品牌视觉保持统一。',
    headerMap: {
      '横幅编码': 'bannerCode',
      '展示位置': 'placement',
      '场景名称': 'scene',
      '主标题': 'title',
      '副标题': 'subtitle',
      '按钮文字': 'buttonText',
      '跳转类型': 'actionType',
      '跳转值': 'actionValue',
      '图片文件名': 'imageFileName',
      '图片FileID（可选）': 'imageFileId',
      '图片FileID': 'imageFileId',
      '是否启用': 'enabled',
      '排序': 'sort'
    },
    listFields: [],
    booleanFields: ['enabled'],
    numberFields: ['sort'],
    previewColumns: [
      { key: 'bannerCode', label: '横幅编码', width: 160 },
      { key: 'placement', label: '位置', width: 120 },
      { key: 'title', label: '主标题', minWidth: 190 },
      { key: 'actionType', label: '跳转', width: 100 },
      { key: 'imageFileName', label: '图片文件', minWidth: 170 }
    ]
  },
  calendarEvents: {
    value: 'calendarEvents',
    label: '节日与活动',
    collection: 'calendarEvents',
    template: '/import-templates/节日导入模板.xlsx',
    imageFolder: '',
    imageFileNameField: '',
    imageFileIdField: '',
    description: '内置节日使用 builtIn；自定义节日使用 fixed；商家活动可使用 date 或 dateRange。关联商品使用商品编码。',
    headerMap: {
      '节日编码': 'eventKey',
      '节日名称': 'name',
      '地区': 'region',
      '日期规则': 'ruleType',
      '月份': 'month',
      '日期': 'day',
      '推荐标题': 'title',
      '推荐文案': 'description',
      '活动时间说明': 'activityTimeText',
      '分类意图': 'categoryIntent',
      '搜索关键词': 'searchKeywords',
      '关联商品编码': 'productSkus',
      '启用推荐': 'recommendationEnabled',
      '是否启用': 'enabled',
      '排序': 'sort'
    },
    listFields: ['searchKeywords', 'productSkus'],
    booleanFields: ['recommendationEnabled', 'enabled'],
    numberFields: ['month', 'day', 'sort'],
    previewColumns: [
      { key: 'eventKey', label: '节日编码', width: 160 },
      { key: 'name', label: '节日名称', width: 130 },
      { key: 'region', label: '地区', width: 110 },
      { key: 'ruleType', label: '日期规则', width: 110 },
      { key: 'month', label: '月', width: 70 },
      { key: 'day', label: '日', width: 70 }
    ]
  }
}

export function schemaFor(type) {
  return importSchemas[type] || importSchemas.products
}

export function normalizeWorkbookRows(type, rawRows) {
  const schema = schemaFor(type)
  return (rawRows || [])
    .map((row, index) => ({
      rowNo: index + 5,
      ...normalizeHeaders(row, schema)
    }))
    .filter((row) => Object.keys(row).some((key) => key !== 'rowNo'))
}

export function templateOptions() {
  return Object.values(importSchemas)
}
