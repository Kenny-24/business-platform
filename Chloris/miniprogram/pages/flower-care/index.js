const GUIDE_ICON = '/images/icons/profile/flowerCare.png'

const GUIDES = [
  {
    id: 'fresh-cut',
    eyebrow: 'CUT FLOWER BASICS',
    title: '鲜切花基础护理',
    intro: '把花带回家后的前十分钟，决定了它之后几天的状态。先醒花、再修剪、再换水，能明显延长观赏期。',
    coverImage: GUIDE_ICON,
    theme: 'soft-green',
    quickFacts: [
      ['适合', '大多数鲜切花'],
      ['换水', '1–2 天一次'],
      ['位置', '阴凉通风']
    ],
    highlights: ['先拆包装', '再剪花茎', '及时换水'],
    steps: [
      ['01', '拆除运输包装', '先去掉吸水棉、扎带和紧勒花茎的包装，让花材自然舒展。'],
      ['02', '清洁花瓶', '使用干净花瓶和常温清水，水位通常保持在花瓶高度的三分之一到二分之一。'],
      ['03', '斜剪花茎', '用锋利花剪斜剪 1–2 厘米，增加吸水面积；水线以下的叶片要全部去除。'],
      ['04', '定期换水', '夏季建议每天换水，其他季节每 1–2 天换水并清洗花瓶。']
    ],
    tipsTitle: '护理提示',
    tips: [
      '避开空调直吹、暖气、阳光暴晒和成熟水果。',
      '发现浑水、异味或烂叶时立即清理。',
      '不同花材花期不同，及时取出凋谢花材可延长整体观赏期。'
    ]
  },
  {
    id: 'rose',
    eyebrow: 'ROSE CARE',
    title: '玫瑰护理',
    intro: '玫瑰最常见的问题是保护瓣、垂头和闷热环境。处理得当，花型会更舒展。',
    coverImage: GUIDE_ICON,
    theme: 'rose',
    quickFacts: [
      ['重点', '保护瓣 / 垂头'],
      ['喷水', '避开花头'],
      ['环境', '通风凉爽']
    ],
    highlights: ['识别保护瓣', '深水醒花', '不要闷热'],
    steps: [
      ['01', '判断保护瓣', '颜色偏深、质地偏硬的最外层花瓣可轻轻向外掰除，不要一次去除过多。'],
      ['02', '处理垂头', '重新斜剪花茎后深水醒花 2–4 小时，花头不要泡入水中。'],
      ['03', '保持通风', '花瓣沾水后容易出现斑点，喷水时避开花头。']
    ],
    tipsTitle: '护理提示',
    tips: [
      '花茎较软时可适当提高水位，但叶片不要泡水。',
      '每天检查花托和花茎是否发软。'
    ]
  },
  {
    id: 'hydrangea',
    eyebrow: 'HYDRANGEA CARE',
    title: '绣球补水',
    intro: '绣球蒸腾快，看起来蔫了通常是缺水。补水及时，恢复速度会很明显。',
    coverImage: GUIDE_ICON,
    theme: 'hydrangea',
    quickFacts: [
      ['重点', '补水 / 醒花'],
      ['水位', '相对较深'],
      ['提示', '及时补水']
    ],
    highlights: ['扩大吸水面', '深水醒花', '快速补水'],
    steps: [
      ['01', '扩大吸水面', '斜剪花茎后，可在茎底纵向剪开约 1 厘米。'],
      ['02', '深水醒花', '花头保持干燥，将花茎放入较深的清水中醒花。'],
      ['03', '紧急补水', '严重缺水时，可用干净水轻喷花瓣背面，再放在阴凉处恢复。']
    ],
    tipsTitle: '护理提示',
    tips: [
      '绣球需要较多水，记得及时补水。',
      '避免与空调出风口和高温电器距离过近。'
    ]
  },
  {
    id: 'tulip',
    eyebrow: 'TULIP CARE',
    title: '郁金香护理',
    intro: '郁金香还会继续生长，轻微弯曲是自然状态，关键是浅水、低温和少束缚。',
    coverImage: GUIDE_ICON,
    theme: 'tulip',
    quickFacts: [
      ['重点', '浅水 / 低温'],
      ['特点', '会继续生长'],
      ['摆放', '避免高温']
    ],
    highlights: ['浅水养护', '及时修剪', '每天转向'],
    steps: [
      ['01', '使用浅水', '水位不必过高，保持花茎底部持续吸水即可。'],
      ['02', '及时修剪', '每次换水重新平剪或轻微斜剪花茎。'],
      ['03', '控制温度', '放在凉爽位置，避免强光和高温。']
    ],
    tipsTitle: '护理提示',
    tips: [
      '花茎会向光弯曲，可每天轻转花瓶方向。',
      '不要用过紧的花瓶束缚花茎。'
    ]
  }
]

Page({
  data: {
    guides: GUIDES,
    activeId: 'fresh-cut',
    activeGuide: GUIDES[0]
  },

  onLoad(options) {
    const id = String(options.id || '')
    const guide = GUIDES.find((item) => item.id === id) || GUIDES[0]
    this.setData({ activeId: guide.id, activeGuide: guide })
  },

  selectGuide(event) {
    const id = String(event.currentTarget.dataset.id || '')
    const guide = GUIDES.find((item) => item.id === id)
    if (!guide) return
    this.setData({ activeId: id, activeGuide: guide })
  },

  openFlowers() {
    wx.switchTab({ url: '/pages/category/index' })
  }
})
