# Chloris（克罗丽丝）V6.13 商业运营版

Chloris 是一套线上鲜花零售项目，包含微信小程序、CloudBase 云函数和 Vue 3 商户管理后台。本版本围绕节日预售、限时商品、预约销售和合作工作室履约进行了商业化改造。

## V6.13 核心功能

### 微信小程序

- 首页、分类、商品详情、购物车、订单、定制报价、BIG DAY、收货地址和鲜花护理；
- 分类新增“限时推出”和“情人节预定”；
- 商品支持“现货销售”和“预约销售”两种模式；
- 限时商品按照后台设置的开始、结束时间自动展示或下架；
- 节日预售商品按照活动开放时间、配送日期、商品预约限量和活动总产能校验；
- 配送时段不得早于下单时间两小时，预约商品同时受活动配送区间限制；
- 已删除图鉴和积分相关功能，优惠券功能保留。

### Web 商户管理后台

- 商品、库存、轮播图、日历节日、订单、顾客、定制报价和数据导入；
- 节日预售与限时活动后台：活动时间、配送区间、预约截止、订单上限、产能上限、关联商品和预售进度；
- 商品商业运营设置：销售模式、限时窗口、预约窗口、配送区间、预约限量、产能单位和指定工作室；
- 工作室合作后台：工作室档案、默认每日产能、特殊日期停接或调整、订单接单和确认制作；
- 工作室接单时自动校验当日订单数和产能单位，避免超量分配。

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

## 新增数据库集合

首次使用 V6.13 前，请在云开发数据库创建以下空集合：

```text
festivalCampaigns
studios
```

现有核心集合：

```text
addresses
admins
banners
calendarEvents
festivalCampaigns
importJobs
orderLogs
orders
products
quoteRequests
studios
users
```

图鉴集合不再被本版本代码使用；确认不再需要历史数据后，可自行备份并删除旧 `atlas` 集合。

## 需要重新部署的云函数

```text
adminApi
dataImportApi
getHomeData
orderApi
userApi
```

在微信开发者工具中右键对应云函数目录，选择“上传并部署：云端安装依赖”。

## Web 后台运行与构建

```powershell
cd .\huayu-admin-web
npm ci --include=dev
npm run dev
```

生产构建：

```powershell
npm run build
```

V6.13 的后台功能位于 `huayu-admin-web/src/`。部署静态后台前必须重新执行生产构建，不能继续使用旧版本构建产物。

## 推荐配置顺序

1. 创建 `festivalCampaigns` 和 `studios` 集合；
2. 部署全部云函数；
3. 在后台新增合作工作室并设置每日产能；
4. 新增情人节或其他节日活动；
5. 将商品关联到活动，或直接在商品页设置预约/限时参数；
6. 重新构建并部署 Web 后台；
7. 清除小程序缓存后重新编译，完成下单、接单和制作流程测试。

## 当前交易边界

当前代码保留人工确认订单和待付款流程，尚未接入真实微信支付、自动退款与强事务库存扣减。正式营业前仍需根据实际经营主体接入微信支付，并完成隐私、配送、售后和财务流程测试。
