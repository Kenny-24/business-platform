const flowers = [
  { id: 'rose', name: '香槟玫瑰', subtitle: '温柔耐看的单枝花材', price: 12, unit: '枝', image: '', stock: 48, type: 'flower', category: '鲜花', color: '香槟色', colorTags: ['香槟色'], sceneTags: ['给自己', '感谢', '居家'], searchKeywords: ['玫瑰', '日常'] },
  { id: 'lisianthus', name: '洋桔梗', subtitle: '轻盈自然，适合瓶插', price: 10, unit: '枝', image: '', stock: 36, type: 'flower', category: '鲜花', color: '紫色', colorTags: ['紫色'], sceneTags: ['给自己', '居家'], searchKeywords: ['洋桔梗', '瓶插'] },
  { id: 'carnation', name: '康乃馨', subtitle: '送长辈与表达感谢', price: 8, unit: '枝', image: '', stock: 60, type: 'flower', category: '鲜花', color: '粉色', colorTags: ['粉色'], sceneTags: ['感谢', '长辈', '探望'], searchKeywords: ['康乃馨', '母亲'] }
]

const bouquets = [
  { id: 'warm-heart', name: '温柔心意', subtitle: '粉色系自然花束', price: 168, unit: '束', image: '', stock: 12, type: 'bouquet', category: '花束', featured: true, colorTags: ['粉色'], sceneTags: ['生日', '朋友', '感谢', '给自己'], searchKeywords: ['温柔', '自然'] },
  { id: 'white-dream', name: '纯白之境', subtitle: '白绿色简约花束', price: 198, unit: '束', image: '', stock: 8, type: 'bouquet', category: '花束', featured: true, colorTags: ['白色', '绿色'], sceneTags: ['纪念', '居家', '探望'], searchKeywords: ['高级', '简约'] },
  { id: 'sunset-love', name: '日落偏爱', subtitle: '橘粉色浪漫花束', price: 268, unit: '束', image: '', stock: 6, type: 'bouquet', category: '花束', featured: true, colorTags: ['粉色', '香槟色'], sceneTags: ['恋人', '浪漫', '周年', '生日'], searchKeywords: ['热烈', '氛围'] }
]

const succulents = [
  { id: 'quiet-night', name: '静夜', subtitle: '小型桌面多肉', price: 28, unit: '盆', image: '', stock: 18, type: 'succulent', category: '多肉植物', colorTags: ['绿色'], sceneTags: ['给自己', '办公室', '居家'], searchKeywords: ['多肉'] },
  { id: 'jade-drop', name: '玉露', subtitle: '通透小巧的桌面绿植', price: 38, unit: '盆', image: '', stock: 14, type: 'succulent', category: '多肉植物', colorTags: ['绿色'], sceneTags: ['给自己', '办公室'], searchKeywords: ['绿植'] }
]

const categories = ['推荐花束', '鲜花花束', '给自己', '生日祝福', '爱与纪念', '感谢心意', '探望慰问', '居家布置', '绿植多肉', '花器礼品']
const colors = ['粉色', '白色', '红色', '紫色', '黄色', '绿色', '香槟色', '混色']

const banners = [
  { id: 'fallback-picker', image: '', scene: 'CHLORIS SELECTION', title: '不确定送什么花？', subtitle: '告诉我们场景、预算与偏好', cta: '帮我选花', action: 'builder' },
  { id: 'fallback-self', image: '', scene: 'FOR YOURSELF', title: '给自己，一束日常', subtitle: '不为节日，只为此刻喜欢', cta: '为自己选花', action: 'flowers' },
  { id: 'fallback-moment', image: '', scene: 'BIG DAY', title: '记住每一个值得庆祝的时刻', subtitle: '生日、纪念日与节日提醒', cta: '查看日历', action: 'calendar' }
]

const atlasItems = [
  { id: 'atlas-rose', name: '玫瑰', latin: 'Rosa', meaning: '温柔与偏爱', category: '鲜切花', image: '', homeFeatured: true },
  { id: 'atlas-lisianthus', name: '洋桔梗', latin: 'Eustoma', meaning: '真诚与不变', category: '鲜切花', image: '', homeFeatured: true },
  { id: 'atlas-hydrangea', name: '绣球', latin: 'Hydrangea', meaning: '圆满与团聚', category: '鲜切花', image: '', homeFeatured: true }
]

module.exports = { flowers, bouquets, succulents, categories, colors, banners, atlasItems }
