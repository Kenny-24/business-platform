const HOLIDAY_CATALOG = [
  {
    "eventKey": "cn-new-year",
    "name": "元旦",
    "region": "domestic",
    "rule": {
      "type": "fixed",
      "month": 1,
      "day": 1
    },
    "title": "新年第一束花",
    "description": "用一束新鲜花礼开启新的一年。",
    "categoryIntent": "推荐花束",
    "searchKeywords": [
      "新年",
      "年宵花",
      "红色花礼"
    ],
    "recommendationEnabled": true,
    "sort": 1000
  },
  {
    "eventKey": "cn-laba",
    "name": "腊八节",
    "region": "domestic",
    "rule": {
      "type": "lunar",
      "month": 12,
      "day": 8
    },
    "title": "腊八迎年",
    "description": "年味渐浓，适合提前准备年宵花与居家花礼。",
    "categoryIntent": "居家布置",
    "searchKeywords": [
      "腊八",
      "年宵花",
      "居家花艺"
    ],
    "recommendationEnabled": true,
    "sort": 940
  },
  {
    "eventKey": "cn-little-new-year-north",
    "name": "小年（北方）",
    "region": "domestic",
    "rule": {
      "type": "lunar",
      "month": 12,
      "day": 23
    },
    "title": "小年纳福",
    "description": "北方小年，适合用喜庆花材装点家中。",
    "categoryIntent": "居家布置",
    "searchKeywords": [
      "小年",
      "年宵花",
      "红色"
    ],
    "recommendationEnabled": true,
    "sort": 930
  },
  {
    "eventKey": "cn-little-new-year-south",
    "name": "小年（南方）",
    "region": "domestic",
    "rule": {
      "type": "lunar",
      "month": 12,
      "day": 24
    },
    "title": "小年纳福",
    "description": "南方小年，适合用鲜花迎接新春。",
    "categoryIntent": "居家布置",
    "searchKeywords": [
      "小年",
      "年宵花",
      "新春"
    ],
    "recommendationEnabled": true,
    "sort": 920
  },
  {
    "eventKey": "cn-new-years-eve",
    "name": "除夕",
    "region": "domestic",
    "rule": {
      "type": "lunarLastDay"
    },
    "title": "除夕团圆",
    "description": "辞旧迎新，为家中准备一束团圆花礼。",
    "categoryIntent": "居家布置",
    "searchKeywords": [
      "除夕",
      "春节",
      "年宵花"
    ],
    "recommendationEnabled": true,
    "sort": 990
  },
  {
    "eventKey": "cn-spring-festival",
    "name": "春节",
    "region": "domestic",
    "rule": {
      "type": "lunar",
      "month": 1,
      "day": 1
    },
    "title": "新春花礼",
    "description": "春节是中国最重要的传统节日之一，适合年宵花与喜庆花礼。",
    "categoryIntent": "居家布置",
    "searchKeywords": [
      "春节",
      "年宵花",
      "蝴蝶兰",
      "红色花礼"
    ],
    "recommendationEnabled": true,
    "sort": 1000
  },
  {
    "eventKey": "cn-lantern",
    "name": "元宵节",
    "region": "domestic",
    "rule": {
      "type": "lunar",
      "month": 1,
      "day": 15
    },
    "title": "花灯映团圆",
    "description": "元宵团圆，适合温暖明亮的花束。",
    "categoryIntent": "居家布置",
    "searchKeywords": [
      "元宵",
      "团圆",
      "暖色花束"
    ],
    "recommendationEnabled": true,
    "sort": 850
  },
  {
    "eventKey": "cn-dragon-head",
    "name": "龙抬头",
    "region": "domestic",
    "rule": {
      "type": "lunar",
      "month": 2,
      "day": 2
    },
    "title": "春回大地",
    "description": "二月二龙抬头，适合清新的春日花材。",
    "categoryIntent": "推荐花束",
    "searchKeywords": [
      "龙抬头",
      "春日",
      "清新花材"
    ],
    "recommendationEnabled": true,
    "sort": 600
  },
  {
    "eventKey": "cn-womens-day",
    "name": "妇女节",
    "region": "domestic",
    "rule": {
      "type": "fixed",
      "month": 3,
      "day": 8
    },
    "title": "送她一束花",
    "description": "向重要的女性表达欣赏、尊重与感谢。",
    "categoryIntent": "感谢心意",
    "searchKeywords": [
      "妇女节",
      "送她",
      "女性花礼"
    ],
    "recommendationEnabled": true,
    "sort": 900
  },
  {
    "eventKey": "cn-arbor-day",
    "name": "植树节",
    "region": "domestic",
    "rule": {
      "type": "fixed",
      "month": 3,
      "day": 12
    },
    "title": "把绿色带回家",
    "description": "关注自然与新生，适合绿植和多肉植物。",
    "categoryIntent": "绿植多肉",
    "searchKeywords": [
      "植树节",
      "绿植",
      "多肉"
    ],
    "recommendationEnabled": true,
    "sort": 560
  },
  {
    "eventKey": "cn-qingming",
    "name": "清明节",
    "region": "domestic",
    "rule": {
      "type": "solarTerm",
      "term": "qingming"
    },
    "title": "清明",
    "description": "慎终追远、踏青惜春。",
    "categoryIntent": "探望慰问",
    "searchKeywords": [
      "清明",
      "素雅花材"
    ],
    "recommendationEnabled": false,
    "sort": 970
  },
  {
    "eventKey": "cn-labor-day",
    "name": "劳动节",
    "region": "domestic",
    "rule": {
      "type": "fixed",
      "month": 5,
      "day": 1
    },
    "title": "致敬每一份认真",
    "description": "为辛勤工作的人送上一束轻松明亮的花。",
    "categoryIntent": "感谢心意",
    "searchKeywords": [
      "劳动节",
      "感谢",
      "明亮花束"
    ],
    "recommendationEnabled": true,
    "sort": 720
  },
  {
    "eventKey": "cn-youth-day",
    "name": "青年节",
    "region": "domestic",
    "rule": {
      "type": "fixed",
      "month": 5,
      "day": 4
    },
    "title": "青春正盛",
    "description": "用自由、活力的花材记录青春。",
    "categoryIntent": "推荐花束",
    "searchKeywords": [
      "青年节",
      "活力",
      "向日葵"
    ],
    "recommendationEnabled": true,
    "sort": 600
  },
  {
    "eventKey": "cn-dragon-boat",
    "name": "端午节",
    "region": "domestic",
    "rule": {
      "type": "lunar",
      "month": 5,
      "day": 5
    },
    "title": "端午安康",
    "description": "端午是中国重要传统节日，适合清雅自然的花礼。",
    "categoryIntent": "居家布置",
    "searchKeywords": [
      "端午",
      "艾草",
      "清雅花材"
    ],
    "recommendationEnabled": true,
    "sort": 980
  },
  {
    "eventKey": "cn-childrens-day",
    "name": "儿童节",
    "region": "domestic",
    "rule": {
      "type": "fixed",
      "month": 6,
      "day": 1
    },
    "title": "童心与快乐",
    "description": "选择明亮、轻盈、充满童趣的花礼。",
    "categoryIntent": "花器礼品",
    "searchKeywords": [
      "儿童节",
      "童趣",
      "明亮花束"
    ],
    "recommendationEnabled": true,
    "sort": 700
  },
  {
    "eventKey": "cn-party-founding",
    "name": "建党节",
    "region": "domestic",
    "rule": {
      "type": "fixed",
      "month": 7,
      "day": 1
    },
    "title": "七月一日",
    "description": "中国共产党成立纪念日。",
    "categoryIntent": "推荐花束",
    "searchKeywords": [
      "建党节",
      "红色花材"
    ],
    "recommendationEnabled": false,
    "sort": 500
  },
  {
    "eventKey": "cn-qixi",
    "name": "七夕节",
    "region": "domestic",
    "rule": {
      "type": "lunar",
      "month": 7,
      "day": 7
    },
    "title": "七夕花礼",
    "description": "中国传统爱情节日，适合玫瑰与浪漫花束。",
    "categoryIntent": "爱与纪念",
    "searchKeywords": [
      "七夕",
      "爱情",
      "玫瑰",
      "浪漫花束"
    ],
    "recommendationEnabled": true,
    "sort": 990
  },
  {
    "eventKey": "cn-ghost-festival",
    "name": "中元节",
    "region": "domestic",
    "rule": {
      "type": "lunar",
      "month": 7,
      "day": 15
    },
    "title": "中元寄思",
    "description": "传统祭祖节日，宜庄重、克制。",
    "categoryIntent": "探望慰问",
    "searchKeywords": [
      "中元节",
      "素雅花材"
    ],
    "recommendationEnabled": false,
    "sort": 500
  },
  {
    "eventKey": "cn-army-day",
    "name": "建军节",
    "region": "domestic",
    "rule": {
      "type": "fixed",
      "month": 8,
      "day": 1
    },
    "title": "八一建军节",
    "description": "向中国人民解放军致敬。",
    "categoryIntent": "推荐花束",
    "searchKeywords": [
      "建军节",
      "红色花材"
    ],
    "recommendationEnabled": false,
    "sort": 500
  },
  {
    "eventKey": "cn-mid-autumn",
    "name": "中秋节",
    "region": "domestic",
    "rule": {
      "type": "lunar",
      "month": 8,
      "day": 15
    },
    "title": "花好月圆",
    "description": "中秋是中国重要传统节日，适合团圆花礼与家居花艺。",
    "categoryIntent": "居家布置",
    "searchKeywords": [
      "中秋",
      "团圆",
      "家居花艺"
    ],
    "recommendationEnabled": true,
    "sort": 980
  },
  {
    "eventKey": "cn-teachers-day",
    "name": "教师节",
    "region": "domestic",
    "rule": {
      "type": "fixed",
      "month": 9,
      "day": 10
    },
    "title": "感谢师恩",
    "description": "向老师表达尊重与感谢。",
    "categoryIntent": "感谢心意",
    "searchKeywords": [
      "教师节",
      "感谢",
      "康乃馨",
      "向日葵"
    ],
    "recommendationEnabled": true,
    "sort": 930
  },
  {
    "eventKey": "cn-national-day",
    "name": "国庆节",
    "region": "domestic",
    "rule": {
      "type": "fixed",
      "month": 10,
      "day": 1
    },
    "title": "国庆花礼",
    "description": "用明亮热烈的花材庆祝国庆。",
    "categoryIntent": "推荐花束",
    "searchKeywords": [
      "国庆节",
      "红色花礼",
      "庆祝"
    ],
    "recommendationEnabled": true,
    "sort": 960
  },
  {
    "eventKey": "cn-double-ninth",
    "name": "重阳节",
    "region": "domestic",
    "rule": {
      "type": "lunar",
      "month": 9,
      "day": 9
    },
    "title": "敬老与陪伴",
    "description": "重阳敬老，适合温暖、稳重的花礼。",
    "categoryIntent": "感谢心意",
    "searchKeywords": [
      "重阳节",
      "敬老",
      "长辈花礼"
    ],
    "recommendationEnabled": true,
    "sort": 900
  },
  {
    "eventKey": "cn-winter-clothes",
    "name": "寒衣节",
    "region": "domestic",
    "rule": {
      "type": "lunar",
      "month": 10,
      "day": 1
    },
    "title": "寒衣寄思",
    "description": "传统祭祀节日，宜庄重、克制。",
    "categoryIntent": "探望慰问",
    "searchKeywords": [
      "寒衣节",
      "素雅花材"
    ],
    "recommendationEnabled": false,
    "sort": 400
  },
  {
    "eventKey": "cn-lower-yuan",
    "name": "下元节",
    "region": "domestic",
    "rule": {
      "type": "lunar",
      "month": 10,
      "day": 15
    },
    "title": "下元祈福",
    "description": "传统祈福节日。",
    "categoryIntent": "推荐花束",
    "searchKeywords": [
      "下元节",
      "祈福"
    ],
    "recommendationEnabled": false,
    "sort": 400
  },
  {
    "eventKey": "cn-memorial-day",
    "name": "国家公祭日",
    "region": "domestic",
    "rule": {
      "type": "fixed",
      "month": 12,
      "day": 13
    },
    "title": "国家公祭日",
    "description": "铭记历史，珍爱和平。",
    "categoryIntent": "探望慰问",
    "searchKeywords": [
      "国家公祭日",
      "白色花材"
    ],
    "recommendationEnabled": false,
    "sort": 950
  },
  {
    "eventKey": "cn-winter-solstice",
    "name": "冬至",
    "region": "domestic",
    "rule": {
      "type": "solarTerm",
      "term": "winterSolstice"
    },
    "title": "冬至团圆",
    "description": "冬至是重要节气与传统节日，适合温暖的家居花艺。",
    "categoryIntent": "居家布置",
    "searchKeywords": [
      "冬至",
      "暖色花材",
      "家居花艺"
    ],
    "recommendationEnabled": true,
    "sort": 760
  },
  {
    "eventKey": "intl-valentines",
    "name": "情人节",
    "region": "international",
    "rule": {
      "type": "fixed",
      "month": 2,
      "day": 14
    },
    "title": "情人节花礼",
    "description": "海外广泛庆祝的爱情节日，玫瑰和浪漫花束最受欢迎。",
    "categoryIntent": "爱与纪念",
    "searchKeywords": [
      "情人节",
      "玫瑰",
      "爱情",
      "浪漫花束"
    ],
    "recommendationEnabled": true,
    "sort": 1000
  },
  {
    "eventKey": "intl-st-patrick",
    "name": "圣帕特里克节",
    "region": "international",
    "rule": {
      "type": "fixed",
      "month": 3,
      "day": 17
    },
    "title": "一抹幸运绿",
    "description": "爱尔兰重要节日，绿色是最具代表性的节日颜色。",
    "categoryIntent": "绿植多肉",
    "searchKeywords": [
      "圣帕特里克节",
      "绿色",
      "绿植"
    ],
    "recommendationEnabled": true,
    "sort": 520
  },
  {
    "eventKey": "intl-april-fools",
    "name": "愚人节",
    "region": "international",
    "rule": {
      "type": "fixed",
      "month": 4,
      "day": 1
    },
    "title": "轻松一点",
    "description": "海外流行的轻松趣味节日。",
    "categoryIntent": "花器礼品",
    "searchKeywords": [
      "愚人节",
      "趣味礼物"
    ],
    "recommendationEnabled": false,
    "sort": 420
  },
  {
    "eventKey": "intl-good-friday",
    "name": "耶稣受难日",
    "region": "international",
    "rule": {
      "type": "easterOffset",
      "offsetDays": -2
    },
    "title": "耶稣受难日",
    "description": "基督教重要纪念日，在多个国家和地区为公共假日。",
    "categoryIntent": "探望慰问",
    "searchKeywords": [
      "受难日",
      "白色花材"
    ],
    "recommendationEnabled": false,
    "sort": 650
  },
  {
    "eventKey": "intl-easter",
    "name": "复活节",
    "region": "international",
    "rule": {
      "type": "easterOffset",
      "offsetDays": 0
    },
    "title": "春日复活节",
    "description": "西方重要节日，常与春天、花篮和新生相联系。",
    "categoryIntent": "花器礼品",
    "searchKeywords": [
      "复活节",
      "春日花篮",
      "新生"
    ],
    "recommendationEnabled": true,
    "sort": 850
  },
  {
    "eventKey": "intl-easter-monday",
    "name": "复活节星期一",
    "region": "international",
    "rule": {
      "type": "easterOffset",
      "offsetDays": 1
    },
    "title": "复活节星期一",
    "description": "多个欧洲国家和地区的重要公共假日。",
    "categoryIntent": "推荐花束",
    "searchKeywords": [
      "复活节",
      "春日花材"
    ],
    "recommendationEnabled": false,
    "sort": 600
  },
  {
    "eventKey": "intl-mothers-day",
    "name": "母亲节",
    "region": "international",
    "rule": {
      "type": "nthWeekday",
      "month": 5,
      "weekday": 0,
      "nth": 2
    },
    "title": "送给妈妈的花",
    "description": "在许多国家于五月第二个星期日庆祝，康乃馨与温柔花束很适合表达感谢。",
    "categoryIntent": "感谢心意",
    "searchKeywords": [
      "母亲节",
      "康乃馨",
      "妈妈",
      "感谢"
    ],
    "recommendationEnabled": true,
    "sort": 1000
  },
  {
    "eventKey": "intl-fathers-day",
    "name": "父亲节",
    "region": "international",
    "rule": {
      "type": "nthWeekday",
      "month": 6,
      "weekday": 0,
      "nth": 3
    },
    "title": "送给爸爸的心意",
    "description": "在许多国家于六月第三个星期日庆祝，适合稳重自然的花礼与绿植。",
    "categoryIntent": "感谢心意",
    "searchKeywords": [
      "父亲节",
      "爸爸",
      "向日葵",
      "绿植"
    ],
    "recommendationEnabled": true,
    "sort": 920
  },
  {
    "eventKey": "intl-halloween",
    "name": "万圣夜",
    "region": "international",
    "rule": {
      "type": "fixed",
      "month": 10,
      "day": 31
    },
    "title": "万圣夜花礼",
    "description": "海外流行节日，橙色、紫色与趣味花材很有节日氛围。",
    "categoryIntent": "花器礼品",
    "searchKeywords": [
      "万圣夜",
      "万圣节",
      "橙色",
      "紫色"
    ],
    "recommendationEnabled": true,
    "sort": 720
  },
  {
    "eventKey": "intl-thanksgiving",
    "name": "感恩节",
    "region": "international",
    "rule": {
      "type": "nthWeekday",
      "month": 11,
      "weekday": 4,
      "nth": 4
    },
    "title": "感谢有你",
    "description": "美国感恩节在十一月第四个星期四，适合表达感谢与陪伴。",
    "categoryIntent": "感谢心意",
    "searchKeywords": [
      "感恩节",
      "感谢",
      "暖色花束"
    ],
    "recommendationEnabled": true,
    "sort": 900
  },
  {
    "eventKey": "intl-christmas-eve",
    "name": "平安夜",
    "region": "international",
    "rule": {
      "type": "fixed",
      "month": 12,
      "day": 24
    },
    "title": "平安夜花礼",
    "description": "圣诞前夜，适合温暖的冬日花束与礼品。",
    "categoryIntent": "居家布置",
    "searchKeywords": [
      "平安夜",
      "圣诞",
      "冬日花束"
    ],
    "recommendationEnabled": true,
    "sort": 950
  },
  {
    "eventKey": "intl-christmas",
    "name": "圣诞节",
    "region": "international",
    "rule": {
      "type": "fixed",
      "month": 12,
      "day": 25
    },
    "title": "圣诞花礼",
    "description": "海外最重要的节日之一，红、绿、白色花礼很有节日氛围。",
    "categoryIntent": "居家布置",
    "searchKeywords": [
      "圣诞节",
      "圣诞花束",
      "红色",
      "绿色"
    ],
    "recommendationEnabled": true,
    "sort": 1000
  },
  {
    "eventKey": "intl-boxing-day",
    "name": "节礼日",
    "region": "international",
    "rule": {
      "type": "fixed",
      "month": 12,
      "day": 26
    },
    "title": "节礼日",
    "description": "英国及部分英联邦国家的重要节日。",
    "categoryIntent": "花器礼品",
    "searchKeywords": [
      "节礼日",
      "礼品"
    ],
    "recommendationEnabled": false,
    "sort": 550
  },
  {
    "eventKey": "intl-new-years-eve",
    "name": "跨年夜",
    "region": "international",
    "rule": {
      "type": "fixed",
      "month": 12,
      "day": 31
    },
    "title": "跨年花礼",
    "description": "用一束花告别旧年、迎接新年。",
    "categoryIntent": "推荐花束",
    "searchKeywords": [
      "跨年",
      "新年",
      "庆祝花束"
    ],
    "recommendationEnabled": true,
    "sort": 930
  }
]

function cloneHolidayCatalog() {
  return HOLIDAY_CATALOG.map((item) => ({
    ...item,
    rule: { ...item.rule },
    searchKeywords: [...(item.searchKeywords || [])],
    productIds: [...(item.productIds || [])]
  }))
}

module.exports = {
  HOLIDAY_CATALOG,
  cloneHolidayCatalog
}
