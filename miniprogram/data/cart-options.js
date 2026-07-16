const PACKAGING_OPTIONS = [
  {
    id: 'basic',
    name: '简约基础包装',
    description: '环保基础包装',
    feeFen: 0,
    enabled: true,
    sort: 100
  },
  {
    id: 'cream',
    name: '奶油色雾面包装',
    description: '柔和奶油色雾面纸',
    feeFen: 1200,
    enabled: true,
    sort: 90
  },
  {
    id: 'giftBox',
    name: '礼盒包装',
    description: '适合生日、纪念日与正式送礼',
    feeFen: 2800,
    enabled: true,
    sort: 80
  }
]

const DELIVERY_OPTIONS = [
  {
    id: 'delivery',
    name: '配送到家',
    description: '地址、时段与配送费在结算页确认'
  },
  {
    id: 'pickup',
    name: '到店自取',
    description: '到店时间在结算页确认'
  }
]

module.exports = {
  PACKAGING_OPTIONS,
  DELIVERY_OPTIONS
}
