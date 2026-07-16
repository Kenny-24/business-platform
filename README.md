# 花予小程序完整项目 V3.0

本项目包含：

```text
cloudfunctions/       CloudBase 云函数
huayu-admin-web/      商户 Web 管理后台
local-assets-backup/  已移出小程序主包的历史业务图片
docs/                 部署与数据说明
miniprogram/          微信小程序顾客端
project.config.json   微信开发者工具项目配置
```

## 本版本重点

- 首页商品、横幅、节日和图鉴全部读取同一个 `getHomeData` 数据源；
- 首页、分类、日历、购物车、图鉴使用同一份云端商品状态；
- 新增独立“花予图鉴”页面，包含“全部”和“我的”两个分类；
- 图鉴以自适应卡片展示，支持搜索、收藏与养护说明；
- Web 后台图鉴支持分类、颜色、季节、场景、首页精选、发布状态和排序；
- 首页图鉴优先展示后台设置为“首页精选”的前 3 条；
- 修复购物车下拉刷新无法停止的问题；
- 大型业务图片移至 `local-assets-backup`，正式图片统一走 CloudBase；
- 清理 `.DS_Store`，不把 macOS 隐藏文件交付到项目中。

## 首次覆盖前必须保留

请先备份你当前文件中的真实配置：

```text
project.config.json 中的小程序 AppID
huayu-admin-web/public/huayu-config.js 中的 Publishable Key
cloudfunctions/adminApi 的 HUAYU_BOOTSTRAP_CODE 环境变量
```

本交付包中的 `project.config.json` 使用 `touristappid`，覆盖后请把你原项目的真实 AppID 填回去。

## 数据库集合

至少创建以下空集合：

```text
admins
products
banners
atlas
calendarEvents
```

建议全部设置为仅管理端可读写，小程序通过云函数读取公开数据。

## 部署

1. 将整个项目复制到本地；
2. 填回 AppID 和 Web Publishable Key；
3. 在微信开发者工具中分别部署 `getHomeData` 和 `adminApi`；
4. 在 `huayu-admin-web` 执行 `npm ci` 与 `npm run dev`；
5. 清除微信开发者工具缓存并重新编译。
