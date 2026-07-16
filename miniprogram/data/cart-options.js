const PACKAGING_OPTIONS = [
  {
    id: 'basic',
    name: '基础包装',
    description: '简约环保包装',
    feeFen: 0,
    enabled: true,
    sort: 100
  },
  {
    id: 'cream',
    name: '奶油色雾面包装',
    description: '适合日常送礼',
    feeFen: 1200,
    enabled: true,
    sort: 90
  },
  {
    id: 'giftBox',
    name: '礼盒包装',
    description: '适合生日与纪念日',
    feeFen: 2800,
    enabled: true,
    sort: 80
  }
]

const DELIVERY_OPTIONS = [
  {
    id: 'delivery',
    name: '配送到家',
    description: '地址与配送时段在结算页确认'
  },
  {
    id: 'pickup',
    name: '到店自取',
    description: '自取时间在结算页确认'
  }
]

module.exports = {
  PACKAGING_OPTIONS,
  DELIVERY_OPTIONS
}
