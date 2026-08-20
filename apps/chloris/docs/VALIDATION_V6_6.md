# Chloris V6.6 完整性检查

本整理版已完成以下检查：

- JavaScript 语法检查通过；
- JSON 文件解析通过；
- 小程序页面目录与 `app.json` 注册项一致；
- 页面导航目标均已注册；
- 自定义组件引用完整；
- 本地图片引用完整；
- “定制报价”入口图标已补齐；
- 无效图鉴收藏 ID 会由 `userApi` 校验并清理，个人中心收藏数量以有效云端数据为准；
- Web 数据导入模板文件名已修复；
- 数据导入总模板已生成；
- Web 后台 `npm ci --include=dev` 成功；
- Web 后台 `npm run build` 成功；
- 五个云函数的 `package-lock.json` 已与 `package.json` 同步，`npm ci` 检查通过；
- 小程序本地文件体积低于 2MB；
- 未包含 `node_modules`、Git 数据、系统缓存或历史重复构建文件。
