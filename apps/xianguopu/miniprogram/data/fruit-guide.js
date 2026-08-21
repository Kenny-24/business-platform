const DEFAULT_GUIDE = {
  seasonText: '全年供应',
  taste: '自然清甜', sweetness: 8, juiciness: 8,
  select: '优先选择果形完整、表皮自然、具有该品种清香的果实。',
  storage: '收到后请根据成熟度冷藏或置于阴凉通风处，并尽快食用。',
  ripeness: '轻触果身，保持自然弹性且散发果香时风味更佳。'
};

const GUIDES = {
  '苹果': {seasonText:'8月至次年2月最佳',taste:'脆甜清香',sweetness:8,juiciness:8,select:'果形端正、表皮自然有光泽，拿在手中沉实。',storage:'冷藏保存，食用前回温十分钟风味更自然。',ripeness:'香气清爽、果肉紧实即为适口状态。'},
  '秋月梨': {seasonText:'9-11月最佳',taste:'细腻多汁',sweetness:9,juiciness:10,select:'果皮金黄均匀、果形饱满、手感沉实。',storage:'冷藏保鲜，避免与气味浓烈食物同放。',ripeness:'成熟后香气明显，果肉细腻且汁水充足。'},
  '库尔勒香梨': {seasonText:'8-12月最佳',taste:'脆甜带香',sweetness:9,juiciness:9,select:'小果匀称、果点自然、果柄完整。',storage:'冷藏可延长脆度，清洗后即食。',ripeness:'果皮由青转黄且带自然梨香时口感最佳。'},
  '香蕉': {seasonText:'全年供应',taste:'软糯香甜',sweetness:9,juiciness:5,select:'果梳完整、果身饱满，无明显挤压伤。',storage:'常温悬挂保存，不建议放入冰箱冷藏。',ripeness:'果皮金黄并出现少量糖斑时甜度更高。'},
  '海南金钻凤梨': {seasonText:'3-7月最佳',taste:'浓甜少酸',sweetness:9,juiciness:9,select:'冠芽青绿、果眼饱满，底部有自然甜香。',storage:'未切常温阴凉保存，切开后密封冷藏。',ripeness:'果皮渐黄并散发凤梨香气时适合食用。'},
  '椰青': {seasonText:'4-9月最佳',taste:'清甜爽口',sweetness:7,juiciness:10,select:'外形饱满、表皮青绿、拿起有明显重量感。',storage:'完整椰青冷藏保存，开口后请当天饮用。',ripeness:'椰水清甜、椰肉柔嫩即为佳品。'},
  '金枕榴莲': {seasonText:'4-8月最佳',taste:'绵密浓香',sweetness:10,juiciness:6,select:'果形饱满、刺距自然变宽，果柄保持新鲜。',storage:'未开果常温催熟，开果后果肉密封冷藏。',ripeness:'果缝轻微张开并散发浓郁香气时成熟。'},
  '凯特芒果': {seasonText:'7-10月最佳',taste:'厚肉甜香',sweetness:9,juiciness:8,select:'果肩饱满、表皮平滑，轻按有细微弹性。',storage:'未熟常温催熟，成熟后冷藏并尽快食用。',ripeness:'果身略软且果蒂处散发芒果香时风味最佳。'},
  '贵妃芒': {seasonText:'3-7月最佳',taste:'芳香多汁',sweetness:9,juiciness:9,select:'红黄色自然过渡、果形饱满、香气清晰。',storage:'常温催熟，变软后冷藏可保存2至3天。',ripeness:'轻按有弹性并散发浓郁果香即可食用。'},
  '红心火龙果': {seasonText:'5-11月最佳',taste:'清甜柔润',sweetness:8,juiciness:9,select:'果皮鲜亮、鳞片自然舒展，果体沉实。',storage:'冷藏保存，切开后密封并尽快食用。',ripeness:'表皮鲜红且果身微有弹性时口感柔润。'},
  '阳光玫瑰': {seasonText:'7-10月最佳',taste:'脆甜花香',sweetness:10,juiciness:8,select:'果粒紧实饱满、大小均匀、果梗青绿。',storage:'保持原袋冷藏，食用前再清洗。',ripeness:'果粒黄绿透亮、香气清雅时甜度更佳。'},
  '夏黑葡萄': {seasonText:'6-9月最佳',taste:'浓甜无籽',sweetness:9,juiciness:9,select:'果粉自然完整、果粒紧实、果梗新鲜。',storage:'不清洗直接冷藏，食用前按需取用。',ripeness:'果色深紫均匀、果粒富有弹性时适口。'},
  '玫瑰香葡萄': {seasonText:'8-10月最佳',taste:'玫瑰甜香',sweetness:9,juiciness:9,select:'果粉完整、香气明显、果粒松紧适中。',storage:'整串冷藏并保持干燥，食用前清洗。',ripeness:'紫红色均匀且玫瑰香气清晰时成熟。'},
  '蓝莓': {seasonText:'4-9月最佳',taste:'清甜微酸',sweetness:8,juiciness:7,select:'果粉完整、果粒干爽饱满，无渗汁。',storage:'保持干燥冷藏，食用前再冲洗。',ripeness:'蓝紫色均匀且果实紧实，甜酸更平衡。'},
  '丹东草莓': {seasonText:'11月至次年4月最佳',taste:'浓香软甜',sweetness:9,juiciness:9,select:'果形完整、色泽自然、萼片青绿。',storage:'平铺冷藏并避免挤压，建议尽快食用。',ripeness:'红色自然均匀并散发草莓香时风味最佳。'},
  '树莓': {seasonText:'5-9月最佳',taste:'酸甜芳香',sweetness:7,juiciness:8,select:'果粒完整干爽，颜色自然，无明显出水。',storage:'冷藏保存，质地娇嫩请在1至2天内食用。',ripeness:'颜色鲜红、果粒柔软但不出水时适口。'},
  '车厘子': {seasonText:'11月至次年2月最佳',taste:'脆甜饱满',sweetness:9,juiciness:8,select:'果径匀称、表皮油亮、果柄青绿。',storage:'原袋冷藏，避免反复温差并尽快食用。',ripeness:'果色深红、果肉紧实且汁水充盈。'},
  '新西兰奇异果': {seasonText:'5-10月最佳',taste:'软糯蜜甜',sweetness:9,juiciness:8,select:'果形饱满、表皮完整，轻按有弹性。',storage:'硬果常温催熟，适口后转入冷藏。',ripeness:'两端轻按微软时即可享用。'},
  '牛油果': {seasonText:'全年供应',taste:'细腻奶油感',sweetness:3,juiciness:5,select:'表皮完整、果身饱满，果蒂处状态自然。',storage:'硬果常温催熟，成熟后冷藏并尽快食用。',ripeness:'握在掌心轻压有弹性，切开果肉细腻。'},
  '山竹': {seasonText:'5-9月最佳',taste:'清甜细腻',sweetness:9,juiciness:8,select:'果蒂青绿、果壳有弹性，底部瓣数清晰。',storage:'冷藏保存并避免风干，建议尽快食用。',ripeness:'果壳按压有弹性，内部果肉洁白柔嫩。'},
  '水蜜桃': {seasonText:'6-9月最佳',taste:'柔软多汁',sweetness:9,juiciness:10,select:'果香自然、绒毛完整、果身无挤压伤。',storage:'硬果常温催熟，变软后冷藏短存。',ripeness:'轻按果肩微软并有浓郁桃香时最佳。'},
  '油桃': {seasonText:'5-8月最佳',taste:'脆甜爽口',sweetness:8,juiciness:9,select:'表皮光滑、颜色自然、果形饱满。',storage:'偏硬可常温放置，成熟后冷藏。',ripeness:'果身富有弹性并散发清甜桃香。'},
  '新疆西梅': {seasonText:'8-10月最佳',taste:'脆甜微酸',sweetness:9,juiciness:8,select:'果粉完整、颜色深紫、果实紧实。',storage:'不清洗冷藏，食用前回温口感更佳。',ripeness:'果身由硬转为微弹时甜度和香气更足。'},
  '恐龙蛋李': {seasonText:'6-8月最佳',taste:'浓甜果香',sweetness:9,juiciness:8,select:'果皮花纹自然、果形圆润、手感沉实。',storage:'常温催熟，适口后冷藏短存。',ripeness:'轻按微软并散发杏李香气时成熟。'},
  '赣南脐橙': {seasonText:'11月至次年3月最佳',taste:'清甜多汁',sweetness:9,juiciness:10,select:'果形圆正、果皮细腻、拿在手中沉实。',storage:'阴凉通风处保存，长时间可冷藏。',ripeness:'橙香清晰、果皮色泽自然时汁水充足。'},
  '沃柑': {seasonText:'1-4月最佳',taste:'高甜化渣',sweetness:9,juiciness:10,select:'果皮橙红、油胞细腻、果体沉实。',storage:'阴凉通风或冷藏保存，避免水汽。',ripeness:'果皮橙红均匀，剥开香气浓郁。'},
  '砂糖橘': {seasonText:'11月至次年2月最佳',taste:'小果高甜',sweetness:10,juiciness:9,select:'果实紧实、果皮薄、颜色自然橙红。',storage:'阴凉通风保存，避免堆叠受压。',ripeness:'果皮橙红且松软易剥时甜度更佳。'},
  '红心柚': {seasonText:'9月至次年1月最佳',taste:'清甜微酸',sweetness:8,juiciness:9,select:'果形匀称、果皮细腻、手感沉重。',storage:'完整果阴凉通风保存，剥开后密封冷藏。',ripeness:'果香清雅、果肉红润且水分充足。'},
  '麒麟西瓜': {seasonText:'5-9月最佳',taste:'爽脆清甜',sweetness:9,juiciness:10,select:'瓜形匀称、纹路清晰、瓜蒂保持新鲜。',storage:'完整果阴凉保存，切开后密封冷藏。',ripeness:'敲击声音清脆且瓜脐收紧时成熟度较好。'},
  '哈密瓜': {seasonText:'6-10月最佳',taste:'脆甜蜜香',sweetness:9,juiciness:9,select:'网纹清晰、果形匀称、底部有自然果香。',storage:'未熟常温放置，成熟后冷藏。',ripeness:'果蒂附近香气明显且按压略有弹性。'},
  '羊角蜜': {seasonText:'4-7月最佳',taste:'酥脆清甜',sweetness:9,juiciness:9,select:'瓜身顺直、颜色黄绿、表面细腻。',storage:'阴凉处短存，成熟后冷藏并尽快食用。',ripeness:'瓜身转为黄绿并带清甜瓜香。'},
  '石榴': {seasonText:'8-11月最佳',taste:'甜润软籽',sweetness:9,juiciness:8,select:'果形饱满、棱角自然、果皮紧实。',storage:'阴凉通风保存，剥开后密封冷藏。',ripeness:'果皮红润、果体沉实，籽粒晶莹饱满。'},
  '猕猴桃': {seasonText:'9月至次年2月最佳',taste:'酸甜柔润',sweetness:8,juiciness:8,select:'果形饱满、表皮完整、无碰伤。',storage:'硬果与苹果同放可催熟，成熟后冷藏。',ripeness:'两端轻按微软时酸甜平衡。'},
  '冬枣': {seasonText:'8-10月最佳',taste:'清脆高甜',sweetness:9,juiciness:8,select:'果面光洁、青红自然过渡、果实硬脆。',storage:'保持干燥冷藏，避免密闭积水。',ripeness:'红色面积自然增加且果肉清脆时适口。'},
  '无花果': {seasonText:'7-10月最佳',taste:'软糯蜜甜',sweetness:9,juiciness:7,select:'果形完整、果皮柔润、果蒂新鲜。',storage:'成熟果需冷藏并在1至2天内食用。',ripeness:'轻按微软、果香明显时甜度最高。'},
  '百香果': {seasonText:'5-11月最佳',taste:'酸香浓郁',sweetness:7,juiciness:8,select:'果形饱满、表皮完整、拿起有重量感。',storage:'常温放置至表皮微皱，随后可冷藏。',ripeness:'表皮自然起皱后香气更浓、酸甜更柔和。'}
};

const CATEGORY_GUIDES = {
  '苹果梨类': {taste:'清脆多汁'}, '热带水果': {taste:'浓郁甜香'}, '葡萄提子': {taste:'脆甜多汁'},
  '浆果莓类': {taste:'酸甜芳香'}, '进口精品': {taste:'精选风味'}, '桃李杏类': {taste:'柔甜果香'},
  '柑橘橙柚': {taste:'清甜多汁'}, '瓜类': {taste:'清爽脆甜'}, '特色水果': {taste:'当季风味'}
};

function getFruitGuide(name, category) {
  return {...DEFAULT_GUIDE, ...(CATEGORY_GUIDES[category] || {}), ...(GUIDES[name] || {})};
}

module.exports = { getFruitGuide, GUIDES };
