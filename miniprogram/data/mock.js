const flowers = [
  { id: 'rose', name: '香槟玫瑰', subtitle: '', price: 12, unit: '枝', image: '', stock: 48, category: '鲜花', color: '香槟色' },
  { id: 'lisianthus', name: '洋桔梗', subtitle: '', price: 10, unit: '枝', image: '', stock: 36, category: '鲜花', color: '紫色' },
  { id: 'carnation', name: '康乃馨', subtitle: '', price: 8, unit: '枝', image: '', stock: 60, category: '鲜花', color: '粉色' }
]

const bouquets = [
  { id: 'warm-heart', name: '温柔心意', subtitle: '', price: 168, unit: '束', image: '', stock: 12, category: '花束' },
  { id: 'white-dream', name: '纯白之境', subtitle: '', price: 198, unit: '束', image: '', stock: 8, category: '花束' }
]

const succulents = [
  { id: 'quiet-night', name: '静夜', subtitle: '', price: 28, unit: '盆', image: '', stock: 18, category: '多肉植物' },
  { id: 'jade-drop', name: '玉露', subtitle: '', price: 38, unit: '盆', image: '', stock: 14, category: '多肉植物' }
]

const categories = ['推荐', '鲜花', '成品花束', '多肉植物', '绿植', '花器', '礼品']
const colors = ['粉色', '白色', '红色', '紫色', '黄色', '绿色', '香槟色', '混色']

const banners = [
  {
    id: 'fallback-self',
    image: '',
    scene: '自我取悦',
    title: '给自己，一束日常',
    subtitle: '不为节日，只为此刻喜欢',
    cta: '为自己选花',
    action: 'flowers'
  },
  {
    id: 'fallback-moment',
    image: '',
    scene: '重要日子',
    title: '记住每一个值得庆祝的时刻',
    subtitle: '生日、纪念日与节日提醒',
    cta: '查看日历',
    action: 'calendar'
  }
]

const atlasItems = [
  {
    id: 'atlas-rose',
    name: '玫瑰',
    latin: 'Rosa',
    meaning: '温柔与偏爱',
    category: '鲜切花',
    image: '',
    homeFeatured: true
  },
  {
    id: 'atlas-lisianthus',
    name: '洋桔梗',
    latin: 'Eustoma',
    meaning: '真诚与不变',
    category: '鲜切花',
    image: '',
    homeFeatured: true
  },
  {
    id: 'atlas-hydrangea',
    name: '绣球',
    latin: 'Hydrangea',
    meaning: '圆满与团聚',
    category: '鲜切花',
    image: '',
    homeFeatured: true
  }
]

module.exports = {
  flowers,
  bouquets,
  succulents,
  categories,
  colors,
  banners,
  atlasItems
}
