# Juyou API 接口文档

## 概览

Juyou API 是一个兼容多种 AI 模型提供商的统一网关服务，支持 OpenAI、Claude、Gemini 等协议，提供完整的用户管理、令牌管理、渠道管理、计费与订阅功能。

**基础信息：**
- 基础路径：`/api` (管理接口)、`/v1` (中继接口)
- 认证方式：Session Cookie (用户登录)、Bearer Token (API 调用)、Header Token (`x-api-key` 等)
- 响应格式：标准信封 `{"success": true/false, "message": "...", "data": ...}` 或上游兼容格式
- 时间格式：Unix 时间戳（秒）

**通用响应头：**
- `Juyouapi-User`: 当前用户 ID（用于前端权限判断）
- `x-聚游助手api-version`: 系统版本号
- `Access-Control-Allow-Origin`: CORS 允许的来源
- `Access-Control-Allow-Credentials`: 是否允许携带凭证

**通用错误码：**
- `200 OK`: 请求成功
- `401 Unauthorized`: 未登录或 Token 无效
- `403 Forbidden`: 权限不足
- `429 Too Many Requests`: 请求频率过高
- `500 Internal Server Error`: 服务器错误

---

## 目录

1. [用户相关](#用户相关)
2. [令牌管理](#令牌管理)
3. [渠道管理](#渠道管理)
4. [模型管理](#模型管理)
5. [日志查询](#日志查询)
6. [中继接口](#中继接口)
7. [视频生成](#视频生成)
8. [订阅管理](#订阅管理)
9. [充值支付](#充值支付)
10. [部署管理](#部署管理)

---

## 用户相关

### 用户注册

**接口：** `POST /api/user/register`

**认证：** 无需认证

**功能说明：** 创建新用户账户，支持邮箱验证码和邀请码功能

**请求体：**
```json
{
  "username": "string",           // 用户名，3-20字符，字母数字下划线
  "password": "string",           // 密码，最少8字符
  "verification_code": "string",  // 邮箱/手机验证码（如果系统启用）
  "email": "string (可选)",       // 邮箱地址
  "aff_code": "string (可选)"    // 邀请码，用于推广返佣
}
```

**响应：**
```json
{
  "success": true,
  "message": "注册成功",
  "data": null
}
```

**错误示例：**
```json
{
  "success": false,
  "message": "用户名已存在",
  "data": null
}
```

---

### 用户登录

**接口：** `POST /api/user/login`

**认证：** 无需认证

**功能说明：** 用户登录并获取 Session Cookie，后续请求需携带此 Cookie

**请求体：**
```json
{
  "username": "string",  // 用户名或邮箱
  "password": "string",  // 密码
  "mfa_code": "string (可选)"  // 双因素认证码（如果用户启用了 2FA）
}
```

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "id": 1,                          // 用户 ID，重要：用于后续 API 请求的 Juyouapi-User 头
    "username": "admin",              // 用户名
    "display_name": "管理员",          // 显示名称
    "role": 100,                      // 角色：1=普通用户, 10=管理员, 100=超级管理员
    "status": 1,                      // 状态：1=正常, 2=已禁用
    "email": "admin@example.com",     // 邮箱
    "phone": "13800138000",           // 手机号
    "quota": 1000000,                 // 剩余额度（单位：分，$10.00 = 1000000）
    "used_quota": 50000,              // 已使用额度
    "request_count": 100,             // 总请求次数
    "group": "default",               // 用户组，影响权限和倍率
    "aff_code": "ABC123",             // 用户的邀请码
    "inviter_id": 0,                  // 邀请人 ID（0 表示无邀请人）
    "access_token": "",               // 访问令牌（某些场景使用）
    "permissions": []                 // 权限列表（管理员功能）
  }
}
```

**重要提示：**
- 登录成功后会设置 `session` Cookie（HttpOnly, SameSite=Lax, 30天有效期）
- 前端需要保存 `data.id`，在后续 API 请求中作为 `Juyouapi-User` 请求头的值
- 前端需要开启 `credentials: 'include'` 以携带 Cookie

**角色权限说明：**
- `role=1` (普通用户): 只能管理自己的令牌和查看自己的日志
- `role=10` (管理员): 可以查看所有用户和日志，管理渠道
- `role=100` (超级管理员): 拥有全部权限，包括系统配置

---

### 邮箱验证码登录

**接口：** `POST /api/user/login/email-code`

**认证：** 无需认证

**请求体：**
```json
{
  "email": "user@example.com",
  "code": "123456",
  "aff_code": "string (可选)"
}
```

**响应：** 同用户登录

---

### 手机验证码登录

**接口：** `POST /api/user/login/phone-code`

**认证：** 无需认证

**请求体：**
```json
{
  "phone": "13800138000",
  "code": "123456",
  "aff_code": "string (可选)"
}
```

**响应：** 同用户登录

---

### 退出登录

**接口：** `GET /api/user/logout`

**认证：** Session Cookie (用户登录)

**响应：**
```json
{
  "success": true,
  "message": "注销成功"
}
```

---

### 获取当前用户信息

**接口：** `GET /api/user/self`

**认证：** Session Cookie

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "id": 1,
    "username": "user",
    "display_name": "User Name",
    "role": 1,
    "status": 1,
    "email": "user@example.com",
    "phone": "13800138000",
    "quota": 1000000,
    "used_quota": 50000,
    "request_count": 100,
    "group": "default",
    "aff_code": "ABC123",
    "aff_count": 5,
    "aff_quota": 50000,
    "setting": {},
    "permissions": []
  }
}
```

---

### 更新用户信息

**接口：** `PUT /api/user/self`

**认证：** Session Cookie

**请求体：**
```json
{
  "username": "new_username (可选)",
  "display_name": "New Display Name (可选)",
  "password": "new_password (可选)",
  "original_password": "old_password (修改密码时必填)"
}
```

**响应：**
```json
{
  "success": true,
  "message": "更新成功"
}
```

---

### 使用兑换码充值

**接口：** `POST /api/user/topup`

**认证：** Session Cookie

**请求体：**
```json
{
  "key": "REDEMPTION-CODE-HERE"
}
```

**响应：**
```json
{
  "success": true,
  "message": "兑换成功",
  "data": 100000
}
```

---

## 令牌管理

### 获取令牌列表

**接口：** `GET /api/token`

**认证：** Session Cookie + `Juyouapi-User` 请求头

**功能说明：** 获取当前用户的所有 API Token，支持分页查询

**请求头：**
```
Cookie: session=xxx
Juyouapi-User: 1
```

**Query 参数：**
- `p` / `page`: 页码 (默认 1)
- `page_size`: 每页数量 (默认 10，最大 100)

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "page": 1,                    // 当前页码
    "page_size": 10,              // 每页数量
    "total": 25,                  // 总记录数
    "items": [
      {
        "id": 1,                            // Token ID，用于查看密钥、更新、删除
        "user_id": 1,                       // 所属用户 ID
        "name": "生产环境令牌",              // Token 名称，便于识别用途
        "key": "sk-****masked****",         // 掩码后的密钥，完整密钥需单独查询
        "status": 1,                        // 状态：1=启用, 2=禁用
        "remain_quota": 50000,              // 剩余额度（分）
        "unlimited_quota": false,           // 是否无限额度
        "expired_time": 1735689600,         // 过期时间（Unix时间戳），-1=永不过期
        "created_time": 1704067200,         // 创建时间
        "accessed_time": 1735689600,        // 最后访问时间
        "used_quota": 10000,                // 已使用额度
        "model_limits_enabled": false,      // 是否启用模型限制
        "model_limits": "",                 // 允许的模型列表（逗号分隔）
        "allow_ips": "",                    // IP 白名单（逗号分隔），空=不限制
        "group": "default",                 // 用户组，影响模型访问权限
        "cross_group_retry": false,         // 跨组重试：失败时尝试其他组的渠道
        "DeletedAt": null                   // 软删除时间（null=未删除）
      }
    ]
  }
}
```

**字段说明：**

- **remain_quota**: 单位为"分"（1美元 = 100分 = 100000），例如 50000 = $0.50
- **status**: 
  - `1` - 正常启用
  - `2` - 已禁用（禁用后无法调用 API）
- **expired_time**: 
  - `-1` - 永不过期
  - `> 0` - 具体过期时间戳
  - 过期后 Token 自动失效
- **unlimited_quota**: 
  - `true` - 无限额度，不扣费
  - `false` - 按实际使用扣除 remain_quota
- **model_limits_enabled + model_limits**: 
  - 启用后只能调用指定模型
  - 格式：`"gpt-4,claude-3-opus,gemini-pro"`
- **allow_ips**: 
  - IP 白名单，只允许指定 IP 调用
  - 格式：`"1.2.3.4,5.6.7.8"` 或 CIDR `"192.168.1.0/24"`
  - 空字符串 = 不限制
- **cross_group_retry**: 
  - 当前组的渠道都失败时，尝试其他组
  - 用于提高可用性

---

### 创建令牌

**接口：** `POST /api/token`

**认证：** Session Cookie + `Juyouapi-User` 请求头

**功能说明：** 创建新的 API Token，创建时返回完整密钥（只显示一次）

**请求头：**
```
Cookie: session=xxx
Juyouapi-User: 1
Content-Type: application/json
```

**请求体：**
```json
{
  "name": "生产环境令牌",                // 必填：Token 名称
  "remain_quota": 100000,               // 可选：初始额度（分），0=使用用户额度
  "expired_time": 1767225600,           // 可选：过期时间戳，-1=永不过期
  "unlimited_quota": false,             // 可选：是否无限额度
  "model_limits_enabled": true,         // 可选：是否启用模型限制
  "model_limits": "gpt-4,claude-3-opus", // 可选：允许的模型（逗号分隔）
  "allow_ips": "1.2.3.4,5.6.7.8",       // 可选：IP 白名单（逗号分隔）
  "group": "default",                   // 可选：用户组
  "cross_group_retry": false            // 可选：跨组重试
}
```

**响应：**
```json
{
  "success": true,
  "message": "创建成功",
  "data": {
    "id": 10,                                               // Token ID
    "key": "sk-AbCdEfGhIjKlMnOpQrStUvWxYz1234567890",      // 完整密钥（仅此一次显示）
    "name": "生产环境令牌",
    "status": 1,
    "remain_quota": 100000,
    "created_time": 1704067200
  }
}
```

**重要提示：**
- ⚠️ **完整密钥仅在创建时返回一次**，请立即保存
- 创建后列表中只显示掩码版本 `sk-****masked****`
- 如需再次查看完整密钥，使用下方"查看令牌密钥"接口

**字段配置建议：**

1. **生产环境令牌**：
   ```json
   {
     "name": "生产环境",
     "unlimited_quota": false,
     "remain_quota": 1000000,
     "expired_time": 1767225600,
     "model_limits_enabled": true,
     "model_limits": "gpt-4-turbo,claude-3-sonnet",
     "allow_ips": "YOUR_SERVER_IP",
     "cross_group_retry": true
   }
   ```

2. **测试环境令牌**：
   ```json
   {
     "name": "测试环境",
     "unlimited_quota": false,
     "remain_quota": 100000,
     "expired_time": -1,
     "model_limits_enabled": true,
     "model_limits": "gpt-3.5-turbo",
     "allow_ips": "",
     "cross_group_retry": false
   }
   ```

3. **无限额度令牌**（管理员）：
   ```json
   {
     "name": "管理员令牌",
     "unlimited_quota": true,
     "expired_time": -1,
     "model_limits_enabled": false
   }
   ```

---

### 查看令牌密钥

**接口：** `POST /api/token/:id/key`

**认证：** Session Cookie + `Juyouapi-User` 请求头

**功能说明：** 查看指定 Token 的完整密钥，有严格限流保护

**限流：** 此接口受 `CriticalRateLimit` 保护，频繁调用会返回 429

**请求示例：**
```bash
POST /api/token/5/key
Cookie: session=xxx
Juyouapi-User: 1
```

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "key": "sk-AbCdEfGhIjKlMnOpQrStUvWxYz1234567890"
  }
}
```

---

### 更新令牌

**接口：** `PUT /api/token`

**认证：** Session Cookie + `Juyouapi-User` 请求头

**功能说明：** 更新令牌配置（不包括密钥本身）

**请求体：**
```json
{
  "id": 5,
  "name": "新名称",
  "status": 1,
  "remain_quota": 200000,
  "unlimited_quota": false,
  "expired_time": 1799999999,
  "model_limits_enabled": true,
  "model_limits": "gpt-4,claude-3",
  "allow_ips": "1.2.3.4",
  "cross_group_retry": true
}
```

**响应：**
```json
{
  "success": true,
  "message": "更新成功"
}
```

---

### 删除令牌

**接口：** `DELETE /api/token/:id`

**认证：** Session Cookie + `Juyouapi-User` 请求头

**响应：**
```json
{
  "success": true,
  "message": "删除成功"
}
```

---

---

### 更新令牌

**接口：** `PUT /api/token`

**认证：** Session Cookie

**请求体：**
```json
{
  "id": 10,
  "name": "Updated Token Name",
  "remain_quota": 200000,
  "status": 1
}
```

**响应：**
```json
{
  "success": true,
  "message": "更新成功"
}
```

---

### 删除令牌

**接口：** `DELETE /api/token/:id`

**认证：** Session Cookie

**路径参数：**
- `id`: 令牌 ID

**响应：**
```json
{
  "success": true,
  "message": "删除成功"
}
```

---

### 查看令牌密钥

**接口：** `POST /api/token/:id/key`

**认证：** Session Cookie

**路径参数：**
- `id`: 令牌 ID

**响应：**
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "key": "sk-AbCdEfGhIjKlMnOpQrStUvWxYz1234567890"
  }
}
```

---

### OpenAI 兼容 - 查询订阅信息

**接口：** `GET /dashboard/billing/subscription` 或 `GET /v1/dashboard/billing/subscription`

**认证：** Bearer Token / `x-api-key` Header

**响应：**
```json
{
  "object": "billing_subscription",
  "has_payment_method": true,
  "soft_limit_usd": 100.0,
  "hard_limit_usd": 200.0,
  "system_hard_limit_usd": 500.0,
  "access_until": 1767225600
}
```

---

### OpenAI 兼容 - 查询使用量

**接口：** `GET /dashboard/billing/usage` 或 `GET /v1/dashboard/billing/usage`

**认证：** Bearer Token

**响应：**
```json
{
  "object": "list",
  "total_usage": 12.50
}
```

---

## 渠道管理

> **权限要求：** 渠道管理功能需要管理员权限（role >= 10）

### 获取渠道列表

**接口：** `GET /api/channel`

**认证：** Session Cookie + `Juyouapi-User` 请求头（管理员）

**功能说明：** 获取所有 API 渠道配置，渠道是连接到上游 API 提供商的配置

**Query 参数：**
- `p` / `page`: 页码（默认 1）
- `page_size`: 每页数量（默认 10）

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "page": 1,
    "page_size": 10,
    "total": 50,
    "items": [
      {
        "id": 1,                                    // 渠道 ID
        "type": 1,                                  // 渠道类型（见下方类型说明）
        "name": "OpenAI Official",                  // 渠道名称
        "status": 1,                                // 状态：1=启用, 2=禁用, 3=自动禁用（余额不足等）
        "key": "sk-****masked****",                 // API Key（掩码）
        "base_url": "https://api.openai.com",       // 基础 URL
        "models": "gpt-4,gpt-3.5-turbo,dall-e-3",   // 支持的模型（逗号分隔）
        "model_mapping": "",                        // 模型映射（JSON 字符串）
        "group": "default,vip",                     // 所属用户组（逗号分隔）
        "balance": 50.25,                           // 余额（美元）
        "used_quota": 125000,                       // 已使用额度（分）
        "weight": 100,                              // 权重（越大优先级越高）
        "priority": 0,                              // 优先级（数字越小越优先，相同优先级按权重）
        "test_time": 1704067200,                    // 最后测试时间
        "response_time": 250,                       // 平均响应时间（毫秒）
        "config": "{}",                             // 额外配置（JSON 字符串）
        "created_time": 1704067200,                 // 创建时间
        "proxy": "",                                // 代理地址（HTTP/SOCKS5）
        "rate_limit": 100,                          // 速率限制（请求/分钟）
        "balance_updated_time": 1704067200          // 余额更新时间
      }
    ]
  }
}
```

**渠道类型说明（type）：**
- `1` - OpenAI
- `2` - Azure OpenAI
- `3` - Anthropic (Claude)
- `4` - Google (Gemini/PaLM)
- `5` - AWS Bedrock
- `8` - 自定义/其他兼容 OpenAI 格式的服务
- `14` - Cohere
- `15` - Stability AI
- `33` - Cloudflare Workers AI
- 更多类型见系统配置

**字段详解：**

- **status 状态码：**
  - `1` - 正常启用
  - `2` - 手动禁用
  - `3` - 自动禁用（余额不足、连续失败等）

- **weight 权重：**
  - 同优先级渠道按权重随机选择
  - 权重 100 vs 200，后者被选中概率是前者的 2 倍
  - 用于负载均衡

- **priority 优先级：**
  - 数字越小越优先（0 > 1 > 2）
  - 高优先级渠道全失败后才尝试低优先级
  - 用于主备切换

- **group 用户组：**
  - 逗号分隔的组名列表
  - 只有组内用户的请求会使用此渠道
  - 例如：`"default,vip"` 表示 default 和 vip 组用户可用

- **models 模型列表：**
  - 逗号分隔的模型名
  - 支持通配符：`"gpt-4*"` 匹配所有 gpt-4 系列
  - 空字符串 = 支持所有模型

- **model_mapping 模型映射：**
  - JSON 格式：`{"gpt-4": "gpt-4-0613", "claude-3": "claude-3-opus"}`
  - 将请求的模型名映射到上游实际模型名
  - 用于模型别名或版本管理

- **balance 余额：**
  - 上游账户余额（美元）
  - 系统会自动查询并更新
  - 低于阈值时自动禁用渠道

- **proxy 代理：**
  - 格式：`http://user:pass@host:port` 或 `socks5://host:port`
  - 访问上游 API 时使用的代理
  - 用于网络受限环境

---
        "type": 1,
        "name": "OpenAI Official",
        "status": 1,
        "weight": 100,
        "base_url": "https://api.openai.com",
        "models": ["gpt-4", "gpt-3.5-turbo"],
        "group": ["default"],
        "balance": 50.0,
        "priority": 0
      }
    ],
    "total": 50,
    "page": 1,
    "page_size": 10
  }
}
```

---

### 创建渠道

**接口：** `POST /api/channel`

**认证：** Session Cookie + `Juyouapi-User` 请求头（管理员）

**功能说明：** 添加新的上游 API 渠道

**请求体：**
```json
{
  "type": 1,                                    // 必填：渠道类型（见上方类型说明）
  "name": "OpenAI 主渠道",                       // 必填：渠道名称
  "key": "sk-xxxxxxxxxxxxxxxx",                 // 必填：上游 API Key
  "base_url": "https://api.openai.com/v1",      // 可选：基础 URL，不同类型有默认值
  "models": "gpt-4,gpt-3.5-turbo",              // 可选：支持的模型，空=全部
  "model_mapping": "{\"gpt-4\":\"gpt-4-0613\"}", // 可选：模型映射 JSON
  "group": "default,vip",                       // 可选：用户组，空=default
  "weight": 100,                                // 可选：权重（默认 100）
  "priority": 0,                                // 可选：优先级（默认 0）
  "proxy": "",                                  // 可选：代理地址
  "rate_limit": 100,                            // 可选：速率限制（请求/分钟，0=不限制）
  "config": "{\"organization\":\"org-xxx\"}"    // 可选：额外配置 JSON
}
```

**响应：**
```json
{
  "success": true,
  "message": "创建成功",
  "data": {
    "id": 25                    // 新创建的渠道 ID
  }
}
```

**配置示例：**

1. **OpenAI 官方渠道：**
```json
{
  "type": 1,
  "name": "OpenAI 官方",
  "key": "sk-xxxxxxxxxxxxxxxx",
  "base_url": "https://api.openai.com/v1",
  "models": "gpt-4,gpt-4-turbo,gpt-3.5-turbo",
  "group": "default",
  "weight": 100,
  "priority": 0
}
```

2. **Azure OpenAI：**
```json
{
  "type": 2,
  "name": "Azure OpenAI",
  "key": "your-azure-key",
  "base_url": "https://your-resource.openai.azure.com",
  "models": "gpt-4",
  "model_mapping": "{\"gpt-4\":\"your-deployment-name\"}",
  "group": "vip",
  "weight": 200,
  "priority": 0
}
```

3. **Claude (Anthropic)：**
```json
{
  "type": 3,
  "name": "Claude 官方",
  "key": "sk-ant-xxxxxxxxxxxxxxxx",
  "base_url": "https://api.anthropic.com",
  "models": "claude-3-opus,claude-3-sonnet,claude-3-haiku",
  "group": "default,vip",
  "weight": 100,
  "priority": 0
}
```

4. **自定义兼容 API：**
```json
{
  "type": 8,
  "name": "自建模型服务",
  "key": "any-key",
  "base_url": "https://your-api.example.com/v1",
  "models": "*",
  "group": "internal",
  "weight": 100,
  "priority": 1
}
```

---

### 更新渠道

**接口：** `PUT /api/channel`

**认证：** Session Cookie + `Juyouapi-User` 请求头（管理员）

**功能说明：** 更新渠道配置

**请求体：**
```json
{
  "id": 25,                             // 必填：渠道 ID
  "name": "OpenAI 主渠道（更新）",        // 可选：更新名称
  "status": 1,                          // 可选：1=启用, 2=禁用
  "key": "sk-new-key",                  // 可选：更新 API Key
  "base_url": "https://new-url.com",    // 可选：更新基础 URL
  "models": "gpt-4",                    // 可选：更新模型列表
  "group": "vip",                       // 可选：更新用户组
  "weight": 150,                        // 可选：更新权重
  "priority": 1,                        // 可选：更新优先级
  "proxy": "http://proxy:8080",         // 可选：更新代理
  "rate_limit": 200                     // 可选：更新速率限制
}
```

**响应：**
```json
{
  "success": true,
  "message": "更新成功",
  "data": null
}
```

**常见更新场景：**

- **临时禁用渠道：** `{"id": 1, "status": 2}`
- **调整权重负载：** `{"id": 1, "weight": 200}`
- **切换优先级：** `{"id": 1, "priority": 1}`
- **更新过期 Key：** `{"id": 1, "key": "sk-new-key"}`

---

### 删除渠道

**接口：** `DELETE /api/channel/:id`

**认证：** Session Cookie + `Juyouapi-User` 请求头（管理员）

**功能说明：** 软删除渠道，删除后无法恢复

**路径参数：**
- `id`: 渠道 ID

**响应：**
```json
{
  "success": true,
  "message": "删除成功",
  "data": null
}
```

---

### 测试渠道

**接口：** `GET /api/channel/test/:id`

**认证：** Session Cookie + `Juyouapi-User` 请求头（管理员）

**功能说明：** 测试渠道连通性和响应时间

**路径参数：**
- `id`: 渠道 ID

**响应：**
```json
{
  "success": true,
  "message": "测试成功",
  "data": {
    "response_time": 245,           // 响应时间（毫秒）
    "balance": 48.75,               // 当前余额（如支持查询）
    "status": "healthy"             // 健康状态
  }
}
```

---

### 批量操作渠道

**接口：** `POST /api/channel/batch`

**认证：** Session Cookie + `Juyouapi-User` 请求头（管理员）

**功能说明：** 批量启用/禁用/删除渠道

**请求体：**
```json
{
  "action": "enable",               // enable=启用, disable=禁用, delete=删除
  "ids": [1, 2, 3, 5, 8]           // 渠道 ID 数组
}
```

**响应：**
```json
{
  "success": true,
  "message": "成功操作 5 个渠道",
  "data": null
}
```

---

---

### 测试渠道

**接口：** `GET /api/channel/test/:id`

**认证：** Session Cookie (管理员)

**路径参数：**
- `id`: 渠道 ID

**响应：**
```json
{
  "success": true,
  "message": "测试成功",
  "data": {
    "latency": 250,
    "status": "ok"
  }
}
```

---

### 更新渠道余额

**接口：** `GET /api/channel/update_balance/:id`

**认证：** Session Cookie (管理员)

**路径参数：**
- `id`: 渠道 ID

**响应：**
```json
{
  "success": true,
  "message": "更新成功",
  "data": {
    "balance": 45.50
  }
}
```

---

## 模型管理

### 获取模型列表 (OpenAI 兼容)

**接口：** `GET /v1/models`

**认证：** Bearer Token / `x-api-key`

**响应：**
```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4",
      "object": "model",
      "created": 1678339200,
      "owned_by": "openai"
    },
    {
      "id": "claude-3-opus-20240229",
      "object": "model",
      "created": 1709251200,
      "owned_by": "anthropic"
    }
  ]
}
```

---

### 获取模型详情

**接口：** `GET /v1/models/:model`

**认证：** Bearer Token

**路径参数：**
- `model`: 模型名称

**响应：**
```json
{
  "id": "gpt-4",
  "object": "model",
  "created": 1678339200,
  "owned_by": "openai"
}
```

---

### 获取用户可用模型

**接口：** `GET /api/user/models`

**认证：** Session Cookie

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": [
    {
      "model_name": "gpt-4",
      "pricing": {
        "input": 0.03,
        "output": 0.06,
        "unit": "1M tokens"
      }
    },
    {
      "model_name": "claude-3-opus-20240229",
      "pricing": {
        "input": 0.015,
        "output": 0.075,
        "unit": "1M tokens"
      }
    }
  ]
}
```

---

### 管理员获取模型元数据列表

**接口：** `GET /api/models`

**认证：** Session Cookie (管理员)

**Query 参数：**
- `page`: 页码
- `page_size`: 每页数量
- `sync_official`: 是否只显示官方同步模型 (0/1)

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "items": [
      {
        "id": 1,
        "model_name": "gpt-4",
        "description": "GPT-4 模型",
        "vendor_id": 1,
        "context_window": 8192,
        "max_output_tokens": 4096,
        "status": 1,
        "pricing": {
          "default": {
            "input": 0.03,
            "output": 0.06
          }
        }
      }
    ],
    "total": 100,
    "page": 1,
    "page_size": 10
  }
}
```

---

### 创建模型元数据

**接口：** `POST /api/models`

**认证：** Session Cookie (管理员)

**请求体：**
```json
{
  "model_name": "custom-model",
  "description": "Custom Model",
  "vendor_id": 1,
  "context_window": 4096,
  "max_output_tokens": 2048,
  "pricing": {
    "default": {
      "input": 0.01,
      "output": 0.02
    }
  }
}
```

**响应：**
```json
{
  "success": true,
  "message": "创建成功",
  "data": {
    "id": 150
  }
}
```

---

### 更新模型元数据

**接口：** `PUT /api/models`

**认证：** Session Cookie (管理员)

**请求体：**
```json
{
  "id": 150,
  "model_name": "custom-model",
  "status": 1,
  "pricing": {
    "default": {
      "input": 0.015,
      "output": 0.03
    }
  }
}
```

**响应：**
```json
{
  "success": true,
  "message": "更新成功"
}
```

---

### 删除模型元数据

**接口：** `DELETE /api/models/:id`

**认证：** Session Cookie (管理员)

**路径参数：**
- `id`: 模型 ID

**响应：**
```json
{
  "success": true,
  "message": "删除成功"
}
```

---

## 日志查询

### 获取日志列表 (管理员)

**接口：** `GET /api/log`

**认证：** Session Cookie (管理员)

**Query 参数：**
- `page`: 页码
- `page_size`: 每页数量
- `start_time`: 开始时间 (Unix 时间戳)
- `end_time`: 结束时间 (Unix 时间戳)
- `model_name`: 模型名称
- `username`: 用户名
- `token_name`: 令牌名称
- `channel_id`: 渠道 ID

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "items": [
      {
        "id": 12345,
        "created_at": 1735689600,
        "type": 1,
        "username": "user",
        "token_name": "My Token",
        "model_name": "gpt-4",
        "quota": 1200,
        "prompt_tokens": 100,
        "completion_tokens": 200,
        "channel_name": "OpenAI Official",
        "content": "Chat completion request",
        "use_time": 2500
      }
    ],
    "total": 5000,
    "page": 1,
    "page_size": 10
  }
}
```

---

### 获取用户自己的日志

**接口：** `GET /api/log/self`

**认证：** Session Cookie

**Query 参数：** 同管理员日志接口

**响应：** 同管理员日志接口

---

### 日志统计（管理员）

**接口：** `GET /api/log/stat`

**认证：** Session Cookie + `Juyouapi-User` 请求头（管理员）

**功能说明：** 统计指定时间范围内的请求数据（额度、请求数、Token 数）

**Query 参数：**
- `type`: 日志类型（可选，1=消费, 2=充值, 3=系统）
- `start_timestamp`: 开始时间（Unix 时间戳，秒）
- `end_timestamp`: 结束时间（Unix 时间戳，秒）
- `model_name`: 模型名称（可选，筛选特定模型）
- `username`: 用户名（可选，筛选特定用户）
- `token_name`: Token 名称（可选）
- `channel`: 渠道 ID（可选）
- `group`: 用户组（可选）

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "quota": 214828370,    // 总消耗额度（单位：分，214828370 = $2148.28）
    "rpm": 2500,           // 总请求数（Requests Per Minute 的缩写实际指总请求）
    "tpm": 1192000         // 总 Token 数（Tokens Per Minute 的缩写实际指总 Token）
  }
}
```

**字段说明：**
- **quota**: 总消耗额度，单位为"分"（1 美元 = 100 分 = 10000）
- **rpm**: 总请求次数（虽然字段名是 rpm，但实际是总数，不是每分钟）
- **tpm**: 总 Token 数（虽然字段名是 tpm，但实际是总数，不是每分钟）

---

### 用户日志统计

**接口：** `GET /api/log/self/stat`

> 注意：接口路径末尾不要加 `/`。正确路径是 `/api/log/self/stat`，不是 `/api/log/self/stat/`。

**认证：** Session Cookie + `Juyouapi-User` 请求头，或 Access Token + `Juyouapi-User` 请求头

**功能说明：** 查询当前用户在指定时间范围内的调用统计数据，用于数据面板中的消耗 Token 数、消耗金额、请求次数等统计卡片。

**请求头：**

| Header | 必填 | 说明 |
|---|---:|---|
| `Authorization` | 桌面应用必填 | 用户 access token，支持 `Bearer <access_token>` 或直接传 token。使用 Session Cookie 登录时可不传 |
| `Juyouapi-User` | 是 | 当前用户 ID，必须和登录 Session 或 access token 对应的用户一致 |

**Query 参数：**

| 参数 | 类型 | 必填 | 示例 | 说明 |
|---|---|---:|---|---|
| `type` | number | 否 | `0` | 日志类型，统计消费日志通常传 `0` |
| `start_timestamp` | number | 否 | `1782316800` | 开始时间，Unix 秒 |
| `end_timestamp` | number | 否 | `1782375496` | 结束时间，Unix 秒 |
| `model_name` | string | 否 | `gpt-4o` | 按模型名称筛选 |
| `token_name` | string | 否 | `my-token` | 按令牌名称筛选 |
| `channel` | number | 否 | `1` | 按渠道 ID 筛选 |
| `group` | string | 否 | `default` | 按用户组筛选 |

> 建议：没有筛选值的参数不要拼到 URL 中，例如不要传 `channel=&group=&model_name=`。时间戳必须使用 Unix 秒，不要使用毫秒。

**成功响应：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "quota": 7941,
    "rpm": 12,
    "tpm": 34567
  }
}
```

**字段说明：**
- `quota`: 总消耗额度，用于换算金额
- `rpm`: 请求次数总数（字段名保留为 rpm，但这里表示当前筛选时间范围内的总请求数，不是实时每分钟请求数）
- `tpm`: Token 消耗总数（字段名保留为 tpm，但这里表示当前筛选时间范围内的总 Token 数，不是实时每分钟 Token 数）

**桌面应用请求示例：**
```bash
curl 'https://api.juyouhuyu.top/api/log/self/stat?type=0&start_timestamp=1782316800&end_timestamp=1782375496' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Juyouapi-User: YOUR_USER_ID'
```

```typescript
const response = await axios.get(
  'https://api.juyouhuyu.top/api/log/self/stat',
  {
    params: {
      type: 0,
      start_timestamp: startTimestamp,
      end_timestamp: endTimestamp,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Juyouapi-User': String(userId),
    },
  },
);
```

**浏览器 Session 请求示例：**
```javascript
// 查询最近 7 天的消费统计
const now = Math.floor(Date.now() / 1000);
const sevenDaysAgo = now - 7 * 24 * 3600;

const response = await fetch(
  `/api/log/self/stat?type=0&start_timestamp=${sevenDaysAgo}&end_timestamp=${now}`,
  {
    credentials: 'include',
    headers: { 'Juyouapi-User': String(userId) },
  }
);

const data = await response.json();
console.log('消耗额度:', data.data.quota);
console.log('请求次数:', data.data.rpm);
console.log('Token 数:', data.data.tpm);
```

**常见错误：**

```json
{
  "success": false,
  "message": "无权进行此操作，未登录且未提供 access token"
}
```
原因：未携带登录 Cookie，且没有传 `Authorization` 请求头。

```json
{
  "success": false,
  "message": "无权进行此操作，未提供 Juyouapi-User"
}
```
原因：未传 `Juyouapi-User` 请求头。

```json
{
  "success": false,
  "message": "无权进行此操作，Juyouapi-User 与登录用户不匹配"
}
```
原因：`Juyouapi-User` 与当前登录用户或 access token 对应用户不一致。

```json
{
  "success": false,
  "message": "查询统计数据失败"
}
```
原因：后端统计 SQL 执行失败，需要检查服务端日志和数据库兼容性。

---

---

## 中继接口

### OpenAI Chat Completions

**接口：** `POST /v1/chat/completions`

**认证：** Bearer Token

**请求体：**
```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 500,
  "stream": false
}
```

**响应 (非流式)：**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1735689600,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "I'm doing well, thank you! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 15,
    "total_tokens": 35
  }
}
```

**响应 (流式 stream=true)：**
```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1735689600,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant","content":"I'm"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1735689600,"model":"gpt-4","choices":[{"index":0,"delta":{"content":" doing"},"finish_reason":null}]}

data: [DONE]
```

---

### Claude Messages API

**接口：** `POST /v1/messages`

**认证：** `x-api-key` Header + `anthropic-version` Header

**请求体：**
```json
{
  "model": "claude-3-opus-20240229",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": "Hello, Claude!"
    }
  ]
}
```

**响应：**
```json
{
  "id": "msg_abc123",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! How can I assist you today?"
    }
  ],
  "model": "claude-3-opus-20240229",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 10,
    "output_tokens": 12
  }
}
```

---

### Gemini Generate Content

**接口：** `POST /v1beta/models/{model}:generateContent`

**认证：** `x-goog-api-key` Header 或 Query 参数 `key`

**请求体：**
```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Hello, Gemini!"
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 500
  }
}
```

**响应：**
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "Hello! How can I help you today?"
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP"
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 5,
    "candidatesTokenCount": 10,
    "totalTokenCount": 15
  }
}
```

---

### OpenAI Embeddings

**接口：** `POST /v1/embeddings`

**认证：** Bearer Token

**请求体：**
```json
{
  "model": "text-embedding-ada-002",
  "input": "The quick brown fox jumps over the lazy dog"
}
```

**响应：**
```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [0.0023, -0.0042, ...],
      "index": 0
    }
  ],
  "model": "text-embedding-ada-002",
  "usage": {
    "prompt_tokens": 10,
    "total_tokens": 10
  }
}
```

---

### OpenAI Images Generation

**接口：** `POST /v1/images/generations`

**认证：** Bearer Token

**请求体：**
```json
{
  "model": "dall-e-3",
  "prompt": "A cute cat wearing a hat",
  "n": 1,
  "size": "1024x1024"
}
```

**响应：**
```json
{
  "created": 1735689600,
  "data": [
    {
      "url": "https://example.com/image.png",
      "revised_prompt": "A cute cat wearing a hat"
    }
  ]
}
```

---

### Midjourney Submit Imagine

**接口：** `POST /mj/submit/imagine`

**认证：** Bearer Token

**请求体：**
```json
{
  "prompt": "a beautiful landscape --ar 16:9",
  "notifyHook": "https://example.com/callback"
}
```

**响应：**
```json
{
  "code": "success",
  "message": "",
  "data": {
    "task_id": "mj-abc123",
    "status": "submitted"
  }
}
```

---

### Midjourney Fetch Task

**接口：** `GET /mj/task/:id/fetch`

**认证：** Bearer Token

**路径参数：**
- `id`: 任务 ID

**响应：**
```json
{
  "code": "success",
  "message": "",
  "data": {
    "task_id": "mj-abc123",
    "status": "success",
    "image_url": "https://example.com/result.png",
    "progress": 100
  }
}
```

---

## 视频生成

### 提交视频生成任务

**接口：** `POST /v1/video/generations`

**认证：** Bearer Token

**请求体：**
```json
{
  "model": "kling-v1",
  "prompt": "A dog running in a park",
  "duration": 5,
  "aspect_ratio": "16:9"
}
```

**响应：**
```json
{
  "code": "success",
  "message": "",
  "data": {
    "task_id": "video-abc123",
    "status": "submitted",
    "created_at": 1735689600
  }
}
```

---

### 查询视频任务状态

**接口：** `GET /v1/video/generations/:task_id`

**认证：** Bearer Token

**路径参数：**
- `task_id`: 任务 ID

**响应：**
```json
{
  "code": "success",
  "message": "",
  "data": {
    "task_id": "video-abc123",
    "status": "success",
    "progress": 100,
    "result_url": "https://example.com/video.mp4",
    "created_at": 1735689600,
    "finished_at": 1735689720
  }
}
```

---

### 获取视频内容

**接口：** `GET /v1/videos/:task_id/content`

**认证：** Bearer Token 或 Session Cookie

**路径参数：**
- `task_id`: 任务 ID

**响应：** 视频文件流或重定向到视频 URL

---

### Kling 文生视频

**接口：** `POST /kling/v1/videos/text2video`

**认证：** Bearer Token

**请求体：**
```json
{
  "prompt": "A beautiful sunset over the ocean",
  "duration": 5,
  "mode": "std"
}
```

**响应：**
```json
{
  "code": "success",
  "message": "",
  "data": {
    "task_id": "kling-abc123"
  }
}
```

---

### 即梦视频任务

**接口：** `POST /jimeng`

**认证：** Bearer Token

**Query 参数：**
- `Action`: API 动作 (如 `CVSync2AsyncSubmitTask`)
- `Version`: API 版本 (如 `2022-08-31`)

**请求体：** 根据具体动作而定

**响应：**
```json
{
  "code": "success",
  "message": "",
  "data": {
    "task_id": "jimeng-abc123"
  }
}
```

---

### 查看用户视频任务历史

**接口：** `GET /api/task/self`

**认证：** Session Cookie

**Query 参数：**
- `page`: 页码
- `page_size`: 每页数量
- `platform`: 平台筛选 (可选)
- `status`: 状态筛选 (可选)

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "items": [
      {
        "id": 1,
        "task_id": "video-abc123",
        "platform": "kling",
        "status": "success",
        "progress": 100,
        "result_url": "https://example.com/video.mp4",
        "created_at": 1735689600,
        "quota": 5000
      }
    ],
    "total": 50,
    "page": 1,
    "page_size": 10
  }
}
```

---

## 订阅管理

### 获取订阅套餐列表

**接口：** `GET /api/subscription/plans`

**认证：** 无需认证

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": [
    {
      "id": 1,
      "title": "月度套餐",
      "subtitle": "适合个人使用",
      "price_amount": 9.99,
      "currency": "USD",
      "duration_unit": "month",
      "duration_value": 1,
      "total_amount": 100000,
      "quota_reset_period": "monthly",
      "enabled": true
    },
    {
      "id": 2,
      "title": "年度套餐",
      "subtitle": "更优惠的选择",
      "price_amount": 99.99,
      "currency": "USD",
      "duration_unit": "year",
      "duration_value": 1,
      "total_amount": 1500000,
      "quota_reset_period": "monthly",
      "enabled": true
    }
  ]
}
```

---

### 获取当前用户订阅信息

**接口：** `GET /api/subscription/self`

**认证：** Session Cookie

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "id": 10,
    "user_id": 1,
    "plan_id": 1,
    "amount_total": 100000,
    "amount_used": 25000,
    "start_time": 1735689600,
    "end_time": 1738368000,
    "status": "active",
    "next_reset_time": 1738368000
  }
}
```

---

### 易支付购买订阅

**接口：** `POST /api/subscription/epay/pay`

**认证：** Session Cookie

**请求体：**
```json
{
  "plan_id": 1,
  "payment_method": "alipay"
}
```

**响应：**
```json
{
  "message": "success",
  "data": {
    "trade_no": "SUB20240101123456",
    "order_id": "ORD-ABC123"
  },
  "url": "https://payment.example.com/pay?order=..."
}
```

---

### Stripe 购买订阅

**接口：** `POST /api/subscription/stripe/pay`

**认证：** Session Cookie

**请求体：**
```json
{
  "plan_id": 1
}
```

**响应：**
```json
{
  "message": "success",
  "data": {
    "pay_link": "https://checkout.stripe.com/pay/cs_abc123"
  }
}
```

---

### 微信支付购买订阅

**接口：** `POST /api/subscription/wechatpay/pay`

**认证：** Session Cookie

**请求体：**
```json
{
  "plan_id": 1
}
```

**响应：**
```json
{
  "message": "success",
  "data": {
    "payment_type": "native_qr",
    "code_url": "weixin://wxpay/bizpayurl?pr=abc123",
    "qr_code": "data:image/png;base64,iVBORw0KG...",
    "trade_no": "SUB20240101123456",
    "plan_title": "月度套餐",
    "amount": 9.99,
    "expires_at": 1735690500
  }
}
```

---

### 查询微信订阅支付状态

**接口：** `GET /api/subscription/wechatpay/status`

**认证：** Session Cookie

**Query 参数：**
- `trade_no`: 订单号

**响应：**
```json
{
  "message": "success",
  "data": {
    "trade_no": "SUB20240101123456",
    "status": "success",
    "complete_time": 1735689800,
    "money": 9.99,
    "order_type": "subscription"
  }
}
```

---

### 管理员创建订阅套餐

**接口：** `POST /api/subscription/admin/plans`

**认证：** Session Cookie (管理员)

**请求体：**
```json
{
  "title": "企业套餐",
  "subtitle": "适合团队使用",
  "price_amount": 49.99,
  "currency": "USD",
  "duration_unit": "month",
  "duration_value": 1,
  "total_amount": 500000,
  "quota_reset_period": "monthly",
  "enabled": true
}
```

**响应：**
```json
{
  "success": true,
  "message": "创建成功",
  "data": {
    "id": 5
  }
}
```

---

### 管理员更新订阅套餐

**接口：** `PUT /api/subscription/admin/plans/:id`

**认证：** Session Cookie (管理员)

**路径参数：**
- `id`: 套餐 ID

**请求体：**
```json
{
  "title": "企业套餐 Pro",
  "price_amount": 59.99,
  "enabled": true
}
```

**响应：**
```json
{
  "success": true,
  "message": "更新成功"
}
```

---

### 管理员为用户绑定订阅

**接口：** `POST /api/subscription/admin/bind`

**认证：** Session Cookie (管理员)

**请求体：**
```json
{
  "user_id": 10,
  "plan_id": 1
}
```

**响应：**
```json
{
  "success": true,
  "message": "绑定成功"
}
```

---

## 充值支付

### 获取充值配置信息

**接口：** `GET /api/user/topup/info`

**认证：** Session Cookie

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "min_amount": 10000,
    "exchange_rate": 500000,
    "payment_methods": ["alipay", "wechat", "stripe"]
  }
}
```

---

### 计算充值金额

**接口：** `POST /api/user/amount`

**认证：** Session Cookie

**请求体：**
```json
{
  "amount": 100000
}
```

**响应：**
```json
{
  "message": "success",
  "data": {
    "amount": 100000,
    "money": 0.20
  }
}
```

---

### 易支付充值

**接口：** `POST /api/user/pay`

**认证：** Session Cookie

**请求体：**
```json
{
  "amount": 100000,
  "payment_method": "alipay"
}
```

**响应：**
```json
{
  "message": "success",
  "data": {
    "trade_no": "TOP20240101123456",
    "order_id": "ORD-ABC123"
  },
  "url": "https://payment.example.com/pay?order=..."
}
```

---

### Stripe 充值

**接口：** `POST /api/user/stripe/pay`

**认证：** Session Cookie

**请求体：**
```json
{
  "amount": 100000
}
```

**响应：**
```json
{
  "message": "success",
  "data": {
    "pay_link": "https://checkout.stripe.com/pay/cs_abc123",
    "order_id": "stripe-abc123"
  }
}
```

---

### 微信支付充值

**接口：** `POST /api/user/wechatpay/pay`

**认证：** Session Cookie

**请求体：**
```json
{
  "amount": 100000
}
```

**响应：**
```json
{
  "message": "success",
  "data": {
    "payment_type": "native_qr",
    "code_url": "weixin://wxpay/bizpayurl?pr=abc123",
    "qr_code": "data:image/png;base64,iVBORw0KG...",
    "trade_no": "TOP20240101123456",
    "amount": 100000,
    "money": 0.20,
    "amount_fen": 20,
    "expires_at": 1735690500,
    "order_type": "topup"
  }
}
```

---

### 查询微信充值支付状态

**接口：** `GET /api/user/wechatpay/status`

**认证：** Session Cookie

**Query 参数：**
- `trade_no`: 订单号

**响应：**
```json
{
  "message": "success",
  "data": {
    "trade_no": "TOP20240101123456",
    "status": "success",
    "complete_time": 1735689800,
    "money": 0.20,
    "order_type": "topup"
  }
}
```

---

### 查看充值历史

**接口：** `GET /api/user/topup/self`

**认证：** Session Cookie

**Query 参数：**
- `page`: 页码
- `page_size`: 每页数量

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "items": [
      {
        "id": 1,
        "amount": 100000,
        "money": 0.20,
        "trade_no": "TOP20240101123456",
        "payment_method": "wechatpay",
        "status": "success",
        "create_time": 1735689600,
        "complete_time": 1735689800
      }
    ],
    "total": 15,
    "page": 1,
    "page_size": 10
  }
}
```

---

### 管理员查看所有充值记录

**接口：** `GET /api/user/topup`

**认证：** Session Cookie (管理员)

**Query 参数：**
- `page`: 页码
- `page_size`: 每页数量
- `status`: 状态筛选 (可选)

**响应：** 同用户充值历史，但包含所有用户的记录

---

### 管理员手动完成充值

**接口：** `POST /api/user/topup/complete`

**认证：** Session Cookie (管理员)

**请求体：**
```json
{
  "trade_no": "TOP20240101123456"
}
```

**响应：**
```json
{
  "success": true,
  "message": "充值已完成"
}
```

---

## 部署管理

### 获取部署列表

**接口：** `GET /api/deployments`

**认证：** Session Cookie (管理员)

**Query 参数：**
- `page`: 页码
- `page_size`: 每页数量

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "items": [
      {
        "id": "deploy-abc123",
        "name": "My Deployment",
        "status": "running",
        "hardware_type": "gpu-rtx4090",
        "location": "us-west",
        "replicas": 1,
        "created_at": 1735689600,
        "expires_at": 1738368000
      }
    ],
    "total": 5,
    "page": 1,
    "page_size": 10
  }
}
```

---

### 创建部署

**接口：** `POST /api/deployments`

**认证：** Session Cookie (管理员)

**请求体：**
```json
{
  "name": "My Deployment",
  "hardware_type": "gpu-rtx4090",
  "location": "us-west",
  "replicas": 1,
  "duration_hours": 720,
  "image": "pytorch/pytorch:latest"
}
```

**响应：**
```json
{
  "success": true,
  "message": "部署创建成功",
  "data": {
    "id": "deploy-abc123",
    "name": "My Deployment",
    "status": "pending"
  }
}
```

---

### 获取部署详情

**接口：** `GET /api/deployments/:id`

**认证：** Session Cookie (管理员)

**路径参数：**
- `id`: 部署 ID

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "id": "deploy-abc123",
    "name": "My Deployment",
    "status": "running",
    "hardware_type": "gpu-rtx4090",
    "location": "us-west",
    "replicas": 1,
    "created_at": 1735689600,
    "expires_at": 1738368000,
    "endpoints": [
      {
        "url": "https://deploy-abc123.example.com",
        "port": 8080
      }
    ]
  }
}
```

---

### 更新部署

**接口：** `PUT /api/deployments/:id`

**认证：** Session Cookie (管理员)

**路径参数：**
- `id`: 部署 ID

**请求体：**
```json
{
  "replicas": 2
}
```

**响应：**
```json
{
  "success": true,
  "message": "更新成功"
}
```

---

### 续费部署

**接口：** `POST /api/deployments/:id/extend`

**认证：** Session Cookie (管理员)

**路径参数：**
- `id`: 部署 ID

**请求体：**
```json
{
  "duration_hours": 720
}
```

**响应：**
```json
{
  "success": true,
  "message": "续费成功",
  "data": {
    "new_expires_at": 1741046400
  }
}
```

---

### 删除部署

**接口：** `DELETE /api/deployments/:id`

**认证：** Session Cookie (管理员)

**路径参数：**
- `id`: 部署 ID

**响应：**
```json
{
  "success": true,
  "message": "删除成功"
}
```

---

### 估算部署价格

**接口：** `POST /api/deployments/price-estimation`

**认证：** Session Cookie (管理员)

**请求体：**
```json
{
  "hardware_type": "gpu-rtx4090",
  "location": "us-west",
  "replicas": 1,
  "duration_hours": 720
}
```

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": {
    "estimated_cost": 150.00,
    "currency": "USD",
    "breakdown": {
      "hardware": 120.00,
      "network": 20.00,
      "storage": 10.00
    }
  }
}
```

---

### 获取可用硬件类型

**接口：** `GET /api/deployments/hardware-types`

**认证：** Session Cookie (管理员)

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": [
    {
      "id": "gpu-rtx4090",
      "name": "NVIDIA RTX 4090",
      "gpu_count": 1,
      "memory": "24GB",
      "price_per_hour": 0.50
    },
    {
      "id": "gpu-a100",
      "name": "NVIDIA A100",
      "gpu_count": 1,
      "memory": "40GB",
      "price_per_hour": 1.20
    }
  ]
}
```

---

### 获取可用位置

**接口：** `GET /api/deployments/locations`

**认证：** Session Cookie (管理员)

**响应：**
```json
{
  "success": true,
  "message": "",
  "data": [
    {
      "id": "us-west",
      "name": "美国西部",
      "available": true
    },
    {
      "id": "eu-central",
      "name": "欧洲中部",
      "available": true
    }
  ]
}
```

---

## 附录

### 标准响应信封

大部分管理接口使用标准信封格式：

```json
{
  "success": true,
  "message": "操作描述或错误信息",
  "data": "实际数据，可以是对象、数组或基本类型"
}
```

### 错误响应

**标准错误信封：**
```json
{
  "success": false,
  "message": "错误描述信息"
}
```

**OpenAI 兼容错误：**
```json
{
  "error": {
    "message": "错误描述",
    "type": "invalid_request_error",
    "code": "invalid_api_key"
  }
}
```

**任务型错误：**
```json
{
  "code": "error",
  "message": "错误描述",
  "data": null
}
```

### 认证方式

1. **Session Cookie**: 用户登录后，通过浏览器 Cookie 自动携带
2. **Bearer Token**: HTTP Header `Authorization: Bearer sk-xxxxx`
3. **x-api-key**: HTTP Header `x-api-key: sk-xxxxx` (Claude、部分 Gemini 接口)
4. **x-goog-api-key**: HTTP Header `x-goog-api-key: xxxxx` (Gemini 接口)
5. **Query Key**: URL 参数 `?key=xxxxx` (部分 Gemini 接口)

### 分页参数

通用分页 Query 参数：
- `p` 或 `page`: 页码，从 1 开始
- `page_size`: 每页数量，默认 10

分页响应结构：
```json
{
  "items": [...],
  "page": 1,
  "page_size": 10,
  "total": 100
}
```

---

**文档版本：** v1.0  
**最后更新：** 2026-06-23
