# Chloris V6.13 部署指南

## 一、微信小程序

1. 使用微信开发者工具打开项目根目录 `Chloris/`；
2. 检查 `project.config.json` 中的 AppID、`miniprogramRoot` 和 `cloudfunctionRoot`；
3. 检查 `miniprogram/app.js` 中的 CloudBase 环境 ID；
4. 清除编译缓存后重新编译；
5. 真机测试现货订单、预约订单、配送时间和定制报价流程。

## 二、数据库集合

V6.13 新增并必须创建：

```text
festivalCampaigns
studios
```

完整核心集合：

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

图鉴集合不再被代码使用。确认历史数据不再需要后，可自行备份并删除旧集合。

## 三、云函数

重新部署以下云函数，并选择“上传并部署：云端安装依赖”：

```text
adminApi
dataImportApi
getHomeData
orderApi
userApi
```

## 四、Web 商户管理后台

进入 `huayu-admin-web/`：

```powershell
npm ci --include=dev
npm run dev
```

生产构建：

```powershell
npm run build
```

构建结果位于 `huayu-admin-web/dist/`。也可以在 Windows 双击 `build-v6.13.bat`。

部署前检查 `public/huayu-config.js`：

- CloudBase 环境 ID 正确；
- Publishable Key 属于当前环境；
- 不得填写 SecretId 或 SecretKey。

## 五、推荐配置顺序

1. 创建 `festivalCampaigns` 和 `studios` 集合；
2. 部署云函数；
3. 在“工作室合作后台”新增工作室并设置默认每日订单、产能上限；
4. 设置节日特殊日期的产能或停接；
5. 在“节日预售与限时活动”创建情人节或其他活动；
6. 关联活动商品，设置预售开放时间、配送日期、预约截止和活动总量；
7. 商品页设置现货/预约模式、单件产能单位及指定工作室；
8. 重新构建 Web 后台并清除小程序缓存。

## 六、上线前测试

- 现货订单不能选择早于下单后两小时的配送时段；
- 预约订单只能选择活动允许的配送日期；
- 活动未开始、已结束或停用时，商品不能继续下单；
- 单品预约限量、活动订单总量和活动产能上限能够拦截超额订单；
- 工作室关闭某日或达到订单/产能上限时，不能继续接单；
- 工作室接单后订单进入待付款，确认制作后进入制作中；
- 限时商品能够按开始和结束时间自动展示、自动下架；
- 优惠券入口仍存在，图鉴和积分入口不再出现。

## 七、当前交易边界

当前项目保留人工确认和线下收款流程，尚未接入真实微信支付、自动退款和强事务库存锁定。正式营业前需要根据经营主体继续接入支付，并完成隐私、财务、配送和售后测试。
