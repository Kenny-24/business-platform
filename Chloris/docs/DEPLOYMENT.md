# Chloris V6.6 部署指南

## 一、微信小程序

1. 使用微信开发者工具打开项目根目录 `Chloris/`。
2. 检查 `project.config.json`：
   - `appid` 为当前小程序 AppID；
   - `miniprogramRoot` 为 `miniprogram/`；
   - `cloudfunctionRoot` 为 `cloudfunctions/`。
3. 检查 `miniprogram/app.js` 中的 `CLOUD_ENV_ID`。
4. 在小程序管理后台完成定位隐私接口声明。
5. 清除文件缓存和编译缓存后重新编译。

## 二、数据库集合

必须存在：

- `products`
- `banners`
- `atlas`
- `calendarEvents`
- `users`
- `addresses`
- `orders`
- `orderLogs`
- `admins`
- `importJobs`
- `quoteRequests`

## 三、云函数

建议依次重新部署：

- `cloudfunctions/getHomeData`
- `cloudfunctions/userApi`
- `cloudfunctions/orderApi`
- `cloudfunctions/adminApi`
- `cloudfunctions/dataImportApi`

均选择“上传并部署：云端安装依赖”。

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

构建输出位于 `huayu-admin-web/dist/`。本压缩包已包含最新构建结果。

检查 `public/huayu-config.js`：

- CloudBase 环境 ID 正确；
- Publishable Key 属于当前环境；
- 不要填写 SecretId 或 SecretKey。

## 五、定制报价闭环测试

1. 顾客在小程序提交图片定制需求；
2. Web 后台“图片定制报价”能够看到该记录；
3. 商户填写报价金额与说明；
4. 顾客从“我的 → 定制报价”查看报价；
5. 顾客拒绝后，后台状态更新；
6. 顾客同意后，自动生成待付款订单；
7. 小程序订单详情与 Web 后台订单中均能找到该订单。

## 六、上线前检查

- 首页、分类、日历、图鉴和商品详情均可正常加载；
- 包装图片为 JPG，主包体积低于微信限制；
- 收藏数量与图鉴收藏列表一致；
- 客服入口能打开微信原生小程序客服；
- 数据导入页面的总模板与四个分模板均能下载；
- 商户后台报价状态、订单状态和顾客操作能同步；
- 真机测试定位、地址、图片上传、订单和客服流程。
