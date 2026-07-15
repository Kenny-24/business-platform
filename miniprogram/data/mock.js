const flowers = [
  { id: 'rose', name: '香槟玫瑰', subtitle: '温柔优雅', price: 12, unit: '枝', image: '/images/flowers/rose.jpg', stock: 48, category: '鲜花', color: '粉色' },
  { id: 'lisianthus', name: '洋桔梗', subtitle: '轻盈自然', price: 10, unit: '枝', image: '/images/flowers/lisianthus.jpg', stock: 36, category: '鲜花', color: '紫色' },
  { id: 'carnation', name: '康乃馨', subtitle: '温暖与爱', price: 8, unit: '枝', image: '/images/flowers/carnation.jpg', stock: 60, category: '鲜花', color: '粉色' },
  { id: 'hydrangea', name: '绣球', subtitle: '团圆美满', price: 18, unit: '枝', image: '/images/flowers/hydrangea.jpg', stock: 16, category: '鲜花', color: '白色' },
  { id: 'sunflower', name: '向日葵', subtitle: '明亮热烈', price: 15, unit: '枝', image: '/images/flowers/sunflower.jpg', stock: 20, category: '鲜花', color: '黄色' },
  { id: 'lily', name: '百合', subtitle: '纯洁祝福', price: 16, unit: '枝', image: '/images/flowers/lily.jpg', stock: 22, category: '鲜花', color: '白色' },
  { id: 'eucalyptus', name: '尤加利', subtitle: '清新叶材', price: 6, unit: '枝', image: '/images/flowers/eucalyptus.jpg', stock: 45, category: '鲜花', color: '绿色' },
  { id: 'gypsophila', name: '满天星', subtitle: '细腻陪伴', price: 9, unit: '枝', image: '/images/flowers/gypsophila.jpg', stock: 28, category: '鲜花', color: '白色' },
  { id: 'daisy', name: '小雏菊', subtitle: '天真明朗', price: 7, unit: '枝', image: '/images/flowers/daisy.jpg', stock: 32, category: '鲜花', color: '混色' }
]

const bouquets = [
  { id: 'warm-heart', name: '温柔心意', subtitle: '粉色系花束', price: 168, unit: '束', image: '/images/bouquets/warm-heart.jpg', stock: 12, category: '花束' },
  { id: 'white-dream', name: '纯白之境', subtitle: '白色系花束', price: 198, unit: '束', image: '/images/bouquets/white-dream.jpg', stock: 8, category: '花束' },
  { id: 'sunset', name: '午后暖阳', subtitle: '暖色系花束', price: 168, unit: '束', image: '/images/bouquets/sunset.jpg', stock: 10, category: '花束' }
]

const succulents = [
  { id: 'quiet-night', name: '静夜', subtitle: '轻松养护', price: 28, unit: '盆', image: '/images/succulents/quiet-night.jpg', stock: 18, category: '多肉植物' },
  { id: 'jade-drop', name: '玉露', subtitle: '晶莹清透', price: 38, unit: '盆', image: '/images/succulents/jade-drop.jpg', stock: 14, category: '多肉植物' },
  { id: 'peach-egg', name: '桃蛋', subtitle: '柔粉可爱', price: 36, unit: '盆', image: '/images/succulents/peach-egg.jpg', stock: 20, category: '多肉植物' }
]

const categories = ['推荐', '鲜花', '成品花束', '多肉植物', '绿植', '花器', '礼品']
const colors = ['粉色', '白色', '红色', '紫色', '黄色', '混色']

const banners = [
  {
    id: 1,
    image: '/images/banners/scene-self.jpg',
    scene: '自我取悦',
    title: '给自己，一束日常',
    subtitle: '不为节日，只为此刻喜欢',
    cta: '为自己选花',
    action: 'builder'
  },
  {
    id: 2,
    image: '/images/banners/scene-gift.jpg',
    scene: '节日送礼',
    title: '把心意，交给一束花',
    subtitle: '为重要的人，认真挑一份花礼',
    cta: '挑选节日花礼',
    action: 'bouquets'
  },
  {
    id: 3,
    image: '/images/banners/scene-home.jpg',
    scene: '家居软装',
    title: '让花与绿意，住进日常',
    subtitle: '用鲜花与绿植，点亮家的呼吸感',
    cta: '布置我的家',
    action: 'homeDecor'
  },
  {
    id: 4,
    image: '/images/banners/scene-moment.jpg',
    scene: '生日纪念',
    title: '记住每一个重要时刻',
    subtitle: '生日、纪念日与每一次值得庆祝',
    cta: '添加重要日期',
    action: 'calendar'
  }
]


const atlasItems = [
  {
    id: 'atlas-rose',
    name: '玫瑰',
    latin: 'Rosa',
    meaning: '温柔与偏爱',
    image: '/images/flowers/rose.jpg'
  },
  {
    id: 'atlas-lisianthus',
    name: '洋桔梗',
    latin: 'Eustoma',
    meaning: '真诚与不变',
    image: '/images/flowers/lisianthus.jpg'
  },
  {
    id: 'atlas-hydrangea',
    name: '绣球',
    latin: 'Hydrangea',
    meaning: '圆满与团聚',
    image: '/images/flowers/hydrangea.jpg'
  }
]

module.exports = { flowers, bouquets, succulents, categories, colors, banners, atlasItems }
