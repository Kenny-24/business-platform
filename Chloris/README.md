# Chloris（克罗丽丝）V6.6 完整整理版

Chloris 是一套线上鲜花零售项目，包含微信小程序、CloudBase 云函数和 Vue 3 商户管理后台。

## 当前完整功能

### 微信小程序

- 首页轮播、推荐花束、节日提醒、鲜花护理、图鉴和图片定制报价；
- 商品分类、搜索、商品详情、购物车、包装选择与配送下单；
- 花材图鉴、收藏、BIG DAY、收货地址、个人资料和订单状态；
- 图片定制报价闭环：顾客提交需求 → 商户报价 → 顾客同意或拒绝 → 同意后生成待付款订单；
- 微信原生小程序客服入口；
- 首次定位授权与用户最新位置记录。

### Web 商户管理后台

- 商品、库存、轮播图、图鉴、节日、订单和顾客管理；
- 图片定制报价查看、回复报价、跟踪顾客决定和关联订单；
- Excel 数据导入、校验、预览和导入记录；
- 已包含清理后重新构建的生产文件 `huayu-admin-web/dist/`。

## 本次整理与修复

- 补齐并注册 `quote-list`、`quote-detail` 两个小程序页面；
- 补充“定制报价”入口图标，修复页面资源缺失；
- 修复失效图鉴收藏被本地缓存重新写回的问题，云端会自动清理无效收藏 ID；
- 修复 Web 数据导入模板文件名，补充“Chloris 数据导入总模板”；
- 清理旧构建产物、未引用组件和无用图片资源；
- Web 后台版本更新为 `6.6.0` 并完成生产构建；
- 完成 JavaScript、JSON、页面、组件、静态资源与导航路径检查。

## 项目结构

```text
Chloris/
├─ miniprogram/          微信小程序
├─ cloudfunctions/       CloudBase 云函数
├─ huayu-admin-web/      Vue 商户管理后台
├─ docs/                 部署与版本说明
├─ project.config.json   微信开发者工具项目配置
└─ README.md
```

## 首次使用

### 微信小程序

使用微信开发者工具打开项目根目录，确认：

- `project.config.json` 中 AppID 正确；
- `miniprogram/app.js` 中 `CLOUD_ENV_ID` 正确；
- 云开发环境包含所需数据库集合；
- 需要更新的云函数已上传部署。

### Web 后台

```powershell
cd .\huayu-admin-web
npm ci --include=dev
npm run dev
```

浏览器打开终端显示的本地地址，通常为：

```text
http://localhost:5173/
```

生产构建：

```powershell
npm run build
```

## 数据库集合

```text
addresses
admins
atlas
banners
calendarEvents
importJobs
orderLogs
orders
products
quoteRequests
users
```

## 建议重新部署的云函数

使用本整理版时，建议全部重新部署一次：

```text
adminApi
dataImportApi
getHomeData
orderApi
userApi
```

右键云函数目录，选择“上传并部署：云端安装依赖”。

## 当前交易边界

当前代码具备订单状态和待付款流程，但尚未接入真实微信支付、自动退款和自动库存锁定。正式营业前需要进一步接入支付能力并完成隐私、配送、售后和客服测试。
