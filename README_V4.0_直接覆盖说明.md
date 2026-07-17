# 花予 V4.0 第一版交易闭环直接覆盖说明

直接覆盖包不会包含以下真实配置：

```text
project.config.json
huayu-admin-web/public/huayu-config.js
```

因此不会覆盖你的真实微信 AppID 和 Web Publishable Key。

解压后第一层直接看到：

```text
miniprogram/
cloudfunctions/
huayu-admin-web/
docs/
VERIFY_V4_0.ps1
```

把这些内容复制到当前项目根目录，选择替换同名文件。

之后依次完成：

```text
1. 创建 users、addresses、orders、orderLogs
2. 部署 userApi、orderApi、adminApi
3. 运行 VERIFY_V4_0.ps1
4. 启动 Web 后台
5. 清除微信开发者工具全部缓存并重新编译
6. 按 docs/07_V4.0_部署指南.md 测试订单闭环
```
