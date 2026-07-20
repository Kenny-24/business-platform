const PACKAGING_OPTIONS = [
  {
    id: 'basic',
    name: '基础包装',
    description: '简约牛皮纸，适合日常购买',
    feeFen: 0,
    feeLabel: '免费',
    image: '/images/packaging/basic.jpg',
    enabled: true,
    sort: 100
  },
  {
    id: 'cream',
    name: '奶油雾面包装',
    description: '柔和轻礼感，适合送礼',
    feeFen: 1200,
    feeLabel: '+¥12',
    image: '/images/packaging/cream.jpg',
    enabled: true,
    sort: 90
  },
  {
    id: 'giftBox',
    name: '礼盒包装',
    description: '礼盒呈现，更有仪式感',
    feeFen: 2800,
    feeLabel: '+¥28',
    image: '/images/packaging/giftBox.jpg',
    enabled: true,
    sort: 80
  }
]

const DELIVERY_OPTIONS = [
  {
    id: 'delivery',
    name: '配送到家',
    description: '目前仅支持线上下单配送，地址与配送时段在结算页确认'
  }
]

module.exports = {
  PACKAGING_OPTIONS,
  DELIVERY_OPTIONS
}
