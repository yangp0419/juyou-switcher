# 微信支付桌面应用接入文档

## 1. 接入范围

当前项目支持微信支付 API v3 Native 扫码支付，桌面应用需要接入两类能力：

- 管理员配置微信支付参数
- 用户发起微信支付充值/订阅，并展示二维码、查询支付状态

微信支付密钥只允许配置到服务端，桌面应用不能直接调用微信支付官方接口，也不能在本地保存商户私钥或 API v3 Key。

## 2. 基础信息

### 服务端地址

```text
{SERVER_URL}
```

示例：

```text
https://api.example.com
```

### API 基础路径

```text
/api
```

### 通用请求头

已登录用户请求需要带：

```http
Juyouapi-User: {user_id}
```

如果使用 access token，还需要：

```http
Authorization: {access_token}
```

说明：当前后端管理接口直接读取完整 `Authorization` header 后传给 `model.ValidateAccessToken`，不是标准 `Bearer xxx` 形式。

### 认证方式

桌面应用有两种方式：

#### 方式 A：Session Cookie

先调用登录接口，保存服务端返回的 Cookie，后续请求带 Cookie 和 `Juyouapi-User`。

适合 Electron / WebView / 内嵌浏览器场景。

#### 方式 B：Access Token

使用用户的 `access_token` 调用接口，同时带 `Juyouapi-User`。

适合原生桌面客户端请求 HTTP API。

## 3. 管理员登录

### 接口

```http
POST /api/user/login
```

### 认证

无需认证。

### 请求体

```json
{
  "username": "admin",
  "password": "your-password"
}
```

如果启用了 2FA，可能需要：

```json
{
  "username": "admin",
  "password": "your-password",
  "mfa_code": "123456"
}
```

### 响应示例

```json
{
  "success": true,
  "message": "",
  "data": {
    "id": 1,
    "username": "admin",
    "role": 100,
    "status": 1,
    "access_token": "..."
  }
}
```

### 桌面应用需要保存

```text
user_id = data.id
access_token = data.access_token
Set-Cookie = 响应头里的 session cookie
```

管理员配置微信支付需要 root 权限，也就是 `role >= 100`。

## 4. 获取当前配置

### 接口

```http
GET /api/option/
```

### 权限

Root 管理员。

### 请求头

使用 Cookie：

```http
Juyouapi-User: 1
Cookie: session=...
```

或使用 access token：

```http
Juyouapi-User: 1
Authorization: {access_token}
```

### 响应示例

```json
{
  "success": true,
  "message": "",
  "data": [
    {
      "key": "WeChatPayEnabled",
      "value": "true"
    },
    {
      "key": "WeChatPayAppId",
      "value": "wx1234567890"
    },
    {
      "key": "WeChatPayMchId",
      "value": "1900000001"
    },
    {
      "key": "WeChatPayMchSerialNo",
      "value": "ABCDEF123456"
    },
    {
      "key": "WeChatPayNotifyUrl",
      "value": "https://api.example.com/api/wechatpay/webhook"
    },
    {
      "key": "WeChatPayUnitPrice",
      "value": "1"
    },
    {
      "key": "WeChatPayMinTopUp",
      "value": "1"
    }
  ]
}
```

### 敏感配置说明

敏感配置不会返回给前端/桌面应用：

```text
WeChatPayAPIv3Key
WeChatPayPrivateKey
```

所以桌面应用展示配置页时：

- API v3 Key 输入框应显示为空
- 商户私钥 PEM 输入框应显示为空
- 用户不填写时，不要提交这两个字段
- 用户填写时，才提交更新

## 5. 保存微信支付配置

### 接口

```http
PUT /api/option/
```

### 权限

Root 管理员。

### Content-Type

```http
Content-Type: application/json
```

### 请求头

```http
Juyouapi-User: {user_id}
Authorization: {access_token}
```

或使用 Cookie 认证。

### 请求体格式

每次只更新一个 key：

```json
{
  "key": "WeChatPayEnabled",
  "value": "true"
}
```

当前后端不是批量保存接口，桌面应用需要逐项调用 `PUT /api/option/`。

## 6. 微信支付配置项

### 6.1 启用微信支付

```json
{
  "key": "WeChatPayEnabled",
  "value": "true"
}
```

关闭：

```json
{
  "key": "WeChatPayEnabled",
  "value": "false"
}
```

### 6.2 微信 AppID

```json
{
  "key": "WeChatPayAppId",
  "value": "wx1234567890abcdef"
}
```

### 6.3 商户号

```json
{
  "key": "WeChatPayMchId",
  "value": "1900000001"
}
```

### 6.4 商户证书序列号

```json
{
  "key": "WeChatPayMchSerialNo",
  "value": "1234567890ABCDEF1234567890ABCDEF12345678"
}
```

### 6.5 API v3 Key

```json
{
  "key": "WeChatPayAPIv3Key",
  "value": "your-api-v3-key"
}
```

注意：

- 敏感字段
- 保存后接口不会再返回明文
- 留空时不要提交，否则可能覆盖原值

### 6.6 商户私钥 PEM

```json
{
  "key": "WeChatPayPrivateKey",
  "value": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
}
```

注意：

- 必须是 `apiclient_key.pem` 内容
- 需要保留 PEM 格式换行
- 敏感字段
- 保存后接口不会再返回明文
- 留空时不要提交

### 6.7 自定义回调地址

```json
{
  "key": "WeChatPayNotifyUrl",
  "value": "https://api.example.com/api/wechatpay/webhook"
}
```

可以不填。不填时服务端会自动使用：

```text
{CallbackAddress}/api/wechatpay/webhook
```

### 6.8 单价

```json
{
  "key": "WeChatPayUnitPrice",
  "value": "1"
}
```

注意：当前代码里该字段已配置，但普通充值金额计算暂未实际使用 `WeChatPayUnitPrice`。

### 6.9 最低充值

```json
{
  "key": "WeChatPayMinTopUp",
  "value": "1"
}
```

## 7. 保存配置推荐流程

桌面应用点击“保存微信支付配置”时，建议按以下顺序调用：

```text
1. WeChatPayEnabled
2. WeChatPayAppId
3. WeChatPayMchId
4. WeChatPayMchSerialNo
5. WeChatPayNotifyUrl
6. WeChatPayUnitPrice
7. WeChatPayMinTopUp
8. WeChatPayAPIv3Key      仅用户填写时提交
9. WeChatPayPrivateKey    仅用户填写时提交
```

### 成功响应

```json
{
  "success": true,
  "message": "",
  "data": null
}
```

### 失败响应

```json
{
  "success": false,
  "message": "无权进行此操作，权限不足"
}
```

## 8. JavaScript / Electron 示例

### 8.1 登录并保存 access token

```js
async function login(serverUrl, username, password) {
  const res = await fetch(`${serverUrl}/api/user/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || '登录失败');
  }

  return {
    userId: json.data.id,
    role: json.data.role,
    accessToken: json.data.access_token,
  };
}
```

### 8.2 更新单个配置项

```js
async function updateOption(serverUrl, userId, accessToken, key, value) {
  const res = await fetch(`${serverUrl}/api/option/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Juyouapi-User': String(userId),
      'Authorization': accessToken,
    },
    credentials: 'include',
    body: JSON.stringify({
      key,
      value,
    }),
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || `保存 ${key} 失败`);
  }

  return json;
}
```

### 8.3 保存微信支付配置

```js
async function saveWeChatPayConfig(serverUrl, auth, config) {
  const options = [
    ['WeChatPayEnabled', config.enabled ? 'true' : 'false'],
    ['WeChatPayAppId', config.appId || ''],
    ['WeChatPayMchId', config.mchId || ''],
    ['WeChatPayMchSerialNo', config.mchSerialNo || ''],
    ['WeChatPayNotifyUrl', config.notifyUrl || ''],
    ['WeChatPayUnitPrice', String(config.unitPrice || 1)],
    ['WeChatPayMinTopUp', String(config.minTopUp || 1)],
  ];

  if (config.apiV3Key) {
    options.push(['WeChatPayAPIv3Key', config.apiV3Key]);
  }

  if (config.privateKeyPem) {
    options.push(['WeChatPayPrivateKey', config.privateKeyPem]);
  }

  for (const [key, value] of options) {
    await updateOption(
      serverUrl,
      auth.userId,
      auth.accessToken,
      key,
      value,
    );
  }
}
```

## 9. Node.js / Axios 示例

```js
import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.example.com',
  withCredentials: true,
});

async function updateOption(userId, accessToken, key, value) {
  const res = await client.put(
    '/api/option/',
    { key, value },
    {
      headers: {
        'Juyouapi-User': String(userId),
        'Authorization': accessToken,
      },
    },
  );

  if (!res.data.success) {
    throw new Error(res.data.message || `更新 ${key} 失败`);
  }

  return res.data;
}
```

## 10. 用户充值支付流程

配置完成后，普通用户在桌面应用里发起微信支付充值。

### 10.1 获取充值信息

```http
GET /api/user/topup/info
```

### 请求头

```http
Juyouapi-User: {user_id}
Authorization: {access_token}
```

### 响应关键字段

```json
{
  "success": true,
  "data": {
    "enable_wechatpay_topup": true,
    "wechatpay_min_topup": 1,
    "pay_methods": [
      {
        "name": "微信支付",
        "type": "wechatpay_native",
        "color": "#07C160",
        "min_topup": "1"
      }
    ]
  }
}
```

当 `enable_wechatpay_topup` 为 `true` 时，桌面应用可以展示微信支付入口。

### 10.2 计算微信支付金额

```http
POST /api/user/wechatpay/amount
```

### 请求体

```json
{
  "amount": 10
}
```

### 响应示例

```json
{
  "message": "success",
  "data": "10.00"
}
```

### 10.3 创建微信支付订单

```http
POST /api/user/wechatpay/pay
```

### 请求体

```json
{
  "amount": 10
}
```

### 响应示例

```json
{
  "message": "success",
  "data": {
    "payment_type": "native_qr",
    "code_url": "weixin://wxpay/bizpayurl?...",
    "qr_code": "weixin://wxpay/bizpayurl?...",
    "trade_no": "WXPAY-1-1710000000000-AbCdEf",
    "order_id": "WXPAY-1-1710000000000-AbCdEf",
    "amount": 10,
    "money": 10,
    "amount_fen": 1000,
    "expires_at": 1710007200
  }
}
```

桌面应用需要：

- 读取 `data.code_url`
- 将它生成二维码
- 展示给用户用微信扫码
- 保存 `trade_no` 用于查询支付状态

### 10.4 查询充值支付状态

```http
GET /api/user/wechatpay/status?trade_no={trade_no}
```

### 响应示例

```json
{
  "message": "success",
  "data": {
    "trade_no": "WXPAY-1-1710000000000-AbCdEf",
    "status": "pending",
    "complete_time": 0,
    "money": 10
  }
}
```

状态值依赖项目里的充值状态常量，常见含义：

```text
pending  等待支付
success  支付成功
failed   支付失败
expired  已过期
```

如果后端本地状态仍是 pending，该接口会主动向微信查询一次订单状态。

## 11. 订阅套餐微信支付流程

### 11.1 创建订阅支付订单

```http
POST /api/subscription/wechatpay/pay
```

### 请求体

```json
{
  "plan_id": 1
}
```

### 响应示例

```json
{
  "message": "success",
  "data": {
    "payment_type": "native_qr",
    "code_url": "weixin://wxpay/bizpayurl?...",
    "qr_code": "weixin://wxpay/bizpayurl?...",
    "trade_no": "SUBWXPAY-1-1710000000000-AbCdEf",
    "order_id": "SUBWXPAY-1-1710000000000-AbCdEf",
    "plan_id": 1,
    "plan_title": "月度套餐",
    "amount": 29.9,
    "money": 29.9,
    "amount_fen": 2990,
    "expires_at": 1710007200,
    "order_type": "subscription"
  }
}
```

### 11.2 查询订阅支付状态

```http
GET /api/subscription/wechatpay/status?trade_no={trade_no}
```

### 响应示例

```json
{
  "message": "success",
  "data": {
    "trade_no": "SUBWXPAY-1-1710000000000-AbCdEf",
    "status": "success",
    "complete_time": 1710000100,
    "money": 29.9,
    "order_type": "subscription"
  }
}
```

## 12. 微信回调说明

微信支付回调地址是：

```http
POST /api/wechatpay/webhook
```

这个接口由微信支付服务器调用，桌面应用不需要调用。

后台配置里的回调地址应该是公网可访问地址，例如：

```text
https://api.example.com/api/wechatpay/webhook
```

如果不配置 `WeChatPayNotifyUrl`，服务端会自动拼接默认地址。

## 13. 桌面应用 UI 建议

### 管理员配置页

建议字段：

```text
启用微信支付               开关
AppID                     文本输入
商户号                    文本输入
商户证书序列号             文本输入
API v3 Key                密码输入，保存后不回显
商户私钥 PEM              多行文本，保存后不回显
自定义回调地址             文本输入，可选
单价                      数字输入
最低充值                  数字输入
```

敏感字段提示文案：

```text
敏感信息保存后不会回显。留空表示不修改当前配置。
```

### 用户支付页

建议流程：

```text
1. 获取 /api/user/topup/info
2. 判断 enable_wechatpay_topup
3. 用户选择金额
4. 调用 /api/user/wechatpay/pay
5. 用 code_url 渲染二维码
6. 用户扫码支付
7. 每 3-5 秒或用户点击按钮调用 /api/user/wechatpay/status
8. 成功后刷新用户余额
```

## 14. 安全注意事项

- 不要把 `WeChatPayAPIv3Key` 存到桌面应用本地配置文件。
- 不要把 `WeChatPayPrivateKey` 存到桌面应用本地配置文件。
- 桌面应用只作为管理员配置入口，真正保存位置是服务端数据库。
- 敏感字段只在用户主动输入并保存时提交。
- 配置页必须要求 root 管理员登录。
- 不要让普通用户调用 `/api/option/`。
- 微信支付回调地址必须是 HTTPS 公网地址。
- 商户私钥 PEM 必须保持原始换行格式。

## 15. 最小接入清单

桌面应用至少需要实现：

```text
管理员侧：
- POST /api/user/login
- GET /api/option/
- PUT /api/option/

用户侧：
- GET /api/user/topup/info
- POST /api/user/wechatpay/pay
- GET /api/user/wechatpay/status
```

如果接入订阅支付，再增加：

```text
- POST /api/subscription/wechatpay/pay
- GET /api/subscription/wechatpay/status
```
