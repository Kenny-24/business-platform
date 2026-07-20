const GUIDES = [
  {
    id: 'fresh-cut',
    eyebrow: 'CUT FLOWER BASICS',
    title: '鲜切花基础护理',
    intro: '把花带回家后的前十分钟，决定了它之后几天的状态。',
    steps: [
      [
        '01',
        '拆除运输包装',
        '先去掉吸水棉、扎带和紧勒花茎的包装，让花材自然舒展。'
      ],
      [
        '02',
        '清洁花瓶',
        '使用干净花瓶和常温清水，水位通常保持在花瓶高度的三分之一到二分之一。'
      ],
      [
        '03',
        '斜剪花茎',
        '用锋利花剪斜剪 1–2 厘米，增加吸水面积；水线以下的叶片要全部去除。'
      ],
      [
        '04',
        '定期换水',
        '夏季建议每天换水，其他季节每 1–2 天换水并清洗花瓶。'
      ]
    ],
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
    intro: '外层花瓣不一定是损伤，它们常常是保护内部花瓣的“保护瓣”。',
    steps: [
      [
        '01',
        '判断保护瓣',
        '颜色偏深、质地偏硬的最外层花瓣可轻轻向外掰除，不要一次去除过多。'
      ],
      [
        '02',
        '处理垂头',
        '重新斜剪花茎后深水醒花 2–4 小时，花头不要泡入水中。'
      ],
      [
        '03',
        '保持通风',
        '花瓣沾水后容易出现斑点，喷水时避开花头。'
      ]
    ],
    tips: [
      '花茎较软时可适当提高水位，但叶片不要泡水。',
      '每天检查花托和花茎是否发软。'
    ]
  },
  {
    id: 'hydrangea',
    eyebrow: 'HYDRANGEA CARE',
    title: '绣球补水',
    intro: '绣球花瓣蒸腾快，轻微萎蔫通常与缺水有关。',
    steps: [
      [
        '01',
        '扩大吸水面',
        '斜剪花茎后，可在茎底纵向剪开约 1 厘米。'
      ],
      [
        '02',
        '深水醒花',
        '花头保持干燥，将花茎放入较深的清水中醒花。'
      ],
      [
        '03',
        '紧急补水',
        '严重缺水时，可用干净水轻喷花瓣背面，再放在阴凉处恢复。'
      ]
    ],
    tips: [
      '绣球需要较多水，记得及时补水。',
      '避免与空调出风口和高温电器距离过近。'
    ]
  },
  {
    id: 'tulip',
    eyebrow: 'TULIP CARE',
    title: '郁金香护理',
    intro: '郁金香离开土壤后仍会继续生长，轻微弯曲属于自然姿态。',
    steps: [
      [
        '01',
        '使用浅水',
        '水位不必过高，保持花茎底部持续吸水即可。'
      ],
      [
        '02',
        '及时修剪',
        '每次换水重新平剪或轻微斜剪花茎。'
      ],
      [
        '03',
        '控制温度',
        '放在凉爽位置，避免强光和高温。'
      ]
    ],
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

    this.setData({
      activeId: guide.id,
      activeGuide: guide
    })
  },

  selectGuide(event) {
    const id = String(event.currentTarget.dataset.id || '')
    const guide = GUIDES.find((item) => item.id === id)

    if (guide) {
      this.setData({
        activeId: id,
        activeGuide: guide
      })
    }
  },

  openAtlas() {
    wx.navigateTo({ url: '/pages/atlas/index' })
  },

  openPicker() {
    wx.navigateTo({ url: '/pages/flower-picker/index' })
  }
})
