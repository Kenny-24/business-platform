# Chloris V6.19 部署说明：优惠券、日历与物流

## 1. 数据库集合

在 CloudBase 数据库创建：

```text
coupons
userCoupons
```

建议将这两个集合限制为仅云函数读写，顾客端不直接访问数据库。

### 推荐索引

`userCoupons`：

```text
userId + status + expiresAt
couponId + userId
userId + issuedAt
```

`orders`：

```text
userId + createdAt
status + createdAt
trackingNo
```

## 2. 部署云函数

重新部署：

```text
adminApi
getHomeData
orderApi
userApi
```

选择：

```text
上传并部署：云端安装依赖
```

## 3. 初始化优惠券

进入 Web 后台：

```text
优惠券管理 → 初始化推荐券
```

会创建以下模板；同编码模板已存在时自动跳过：

- 新客满99减15：新用户自动发放，7天有效，首个已付款订单可用
- 日常满199减20：15天有效
- 日常满299减35：15天有效
- 复购满199减25：订单完成后自动发放，30天有效，同模板最多同时持有2张
- 售后补偿满69减10：后台指定顾客发放
- 售后补偿满199减20：后台指定顾客发放
- 不定期惊喜满199减25：72小时有效，默认定向30天未购买顾客，默认最多300张、预算7500元

### 统一规则

```text
一单一券
优惠只抵符合条件的商品金额
不抵配送费
提交订单后锁券15分钟
未付款取消或超时关闭后，在有效期内自动返还
限时推出、情人节限定、节日预售、季节限定和定制报价默认不可用
```

不定期惊喜券额外限制：

```text
同一顾客30天最多1张
滚动90天最多3张
已有同等或更高优惠的有效券时跳过
```

## 4. 物流配置

后台订单详情已经支持录入：

```text
快递公司
快递单号
配送备注
```

顾客可在订单详情进入独立“物流信息”页面。

### 快递100实时查询（可选）

在 `orderApi` 云函数环境变量中配置：

```text
KUAIDI100_CUSTOMER
KUAIDI100_KEY
```

未配置时：

- 顾客仍可看到快递公司和运单号
- 页面提示等待物流更新
- 不会伪造轨迹或预计送达时间

已配置时：

- 查询真实轨迹
- 结果缓存30分钟
- 顾客可手动刷新

## 5. 日历商家活动清理

代码已完全移除商家活动创建和展示入口。

历史数据库中 `calendarEvents.region = merchant` 的记录会被自动忽略，不强制删除。确认不再需要历史数据后，可以在 CloudBase 控制台备份并删除这些记录。

## 6. 已删除文件

```text
miniprogram/pages/atlas/
miniprogram/pages/atlas-detail/
miniprogram/services/atlas-favorites.js
miniprogram/services/atlas-purchases.js
huayu-admin-web/src/views/AtlasView.vue
huayu-admin-web/build-v6.13.*（已替换为 build-admin.*）
.DS_Store
._* 等系统冗余文件
```

## 7. Web 后台构建

```bash
cd huayu-admin-web
npm ci --include=dev
npm run build
```

## 8. 验收建议

优惠券：

1. 初始化模板
2. 新用户自动领券
3. 订单结算自动推荐优惠最大且可用的券
4. 手动切换或不使用优惠券
5. 提交订单锁券
6. 取消待付款订单返券
7. 完成订单发复购券
8. 惊喜券频率和预算限制

物流：

1. 后台录入快递公司和运单号
2. 订单详情出现“查看物流”
3. 可复制运单号
4. 未配置接口时不报错
5. 配置接口后可刷新真实轨迹

日历：

1. 顾客端没有“商家活动”图例、筛选或卡片
2. 后台不能新建商家活动
3. 国内、国际和 BIG DAY 正常显示

## 9. 真实支付接入提醒

当前项目尚未接入真实微信支付。后续接入时：

- 支付成功异步回调必须把 `userCoupons.status` 更新为 `used`
- 全额退款时按有效期决定是否返券
- 部分退款应按商品优惠分摊金额计算退款，不直接返券
