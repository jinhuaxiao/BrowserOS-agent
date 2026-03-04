# Fingerprint Browser Competitive Analysis

BrowserOS 指纹伪装技术竞品对比与检测站评分报告。

## 概述

BrowserOS 当前检测站评分：

| 检测站 | 评分 | 说明 |
|--------|------|------|
| BrowserScan | **100%** | 全部指纹维度通过 |
| iphey | **Trustworthy** | 信任等级最高 |
| sannysoft | **全 PASS** | 所有检测项绿色 |
| CreepJS | **0% headless/stealth** | 未检出自动化/隐身特征 |

## 架构对比

### 技术路线

| 产品 | 内核修改 | 指纹实现层 | 开源 | 定价 |
|------|----------|-----------|------|------|
| **BrowserOS** | Chromium C++ 源码 | C++ 内核 + Extension 补充 | 私有 | — |
| Multilogin | Mimic (Chromium) / Stealthfox (Firefox) | C++ 内核 + JS 注入 | 否 | €99/月起 |
| AdsPower | SunBrowser (Chromium) / FlowerBrowser (Firefox) | C++ 内核 + JS 注入 | 否 | $9/月起 |
| GoLogin | Orbita (Chromium) | C++ 部分 + 大量 JS 注入 | 否 | $49/月起 |
| OctoBrowser | 自研 Chromium 分支 | C++ 内核 | 否 | €29/月起 |
| Camoufox | Firefox 分支 | C++ 内核 (Rust patches) | 开源 | 免费 |
| Undetected-Chromedriver | 原版 Chrome | 运行时 JS 注入 | 开源 | 免费 |

### C++ 内核 vs JS 注入

**C++ 内核修改（BrowserOS / Multilogin / OctoBrowser）：**
- 从浏览器原生 API 返回伪装值，JS 层无法检测
- `Object.getOwnPropertyDescriptor()` 返回原生 getter
- 不受 `toString()` / prototype 检测影响
- 性能无损

**JS 注入（GoLogin / Undetected-Chromedriver）：**
- 通过 `Object.defineProperty` 覆盖属性
- 可被 `toString()` 检测发现非 native 函数
- iframe 隔离可绕过注入
- 竞态条件：页面可能在注入前读取真实值

## 指纹维度覆盖矩阵

| 维度 | BrowserOS | 实现层 | Multilogin | AdsPower | GoLogin | Camoufox |
|------|-----------|--------|------------|----------|---------|----------|
| **User-Agent** | ✅ | C++ | ✅ | ✅ | ✅ | ✅ |
| **UA-CH (Sec-CH-UA)** | ✅ | C++ | ✅ | ✅ | ⚠️ | ✅ |
| **Platform** | ✅ | C++ | ✅ | ✅ | ✅ | ✅ |
| **Hardware Concurrency** | ✅ | C++ | ✅ | ✅ | ✅ | ✅ |
| **Device Memory** | ✅ | C++ | ✅ | ✅ | ✅ | ✅ |
| **Screen Resolution** | ✅ | C++ | ✅ | ✅ | ✅ | ✅ |
| **Screen availWidth/Height** | ✅ | C++ | ✅ | ✅ | ⚠️ | ✅ |
| **Color Depth** | ✅ | C++ | ✅ | ✅ | ⚠️ | ✅ |
| **Device Pixel Ratio** | ✅ | C++ | ✅ | ✅ | ✅ | ✅ |
| **CSS device-width MQ** | ✅ | C++ | ❓ | ❓ | ❌ | ❓ |
| **WebGL Vendor/Renderer** | ✅ | C++ | ✅ | ✅ | ✅ | ✅ |
| **WebGL Unmasked** | ✅ | C++ | ✅ | ✅ | ⚠️ | ✅ |
| **WebGL Parameters** | ✅ | C++ + Ext | ⚠️ | ⚠️ | ❌ | ⚠️ |
| **WebGL 计时防御** | ✅ | Extension | ❌ | ❌ | ❌ | ❌ |
| **Canvas Noise** | ✅ | C++ | ✅ | ✅ | ✅ | ✅ |
| **Audio Noise** | ✅ | C++ | ✅ | ✅ | ⚠️ | ✅ |
| **ClientRects Noise** | ✅ | C++ | ⚠️ | ⚠️ | ❌ | ⚠️ |
| **Font Fingerprint** | ✅ | C++ + Ext | ✅ | ✅ | ⚠️ | ✅ |
| **Plugins / MimeTypes** | ✅ | C++ + Ext | ✅ | ✅ | ⚠️ | ✅ |
| **MediaDevices** | ✅ | Extension | ✅ | ✅ | ⚠️ | ⚠️ |
| **WebRTC IP** | ✅ | Extension | ✅ | ✅ | ✅ | ✅ |
| **Timezone** | ✅ | Extension | ✅ | ✅ | ✅ | ✅ |
| **Locale (Intl)** | ✅ | Extension | ✅ | ✅ | ⚠️ | ✅ |
| **TLS/JA3 Fingerprint** | ✅ | C++ | ✅ | ⚠️ | ❌ | ✅ |
| **navigator.webdriver** | ✅ | C++ | ✅ | ✅ | ✅ | ✅ |
| **Port Scan Protection** | ✅ | C++ | ⚠️ | ❌ | ❌ | ❌ |
| **Battery API** | ✅ | C++ | ⚠️ | ❌ | ❌ | ❌ |
| **Geolocation** | ✅ | C++ | ⚠️ | ✅ | ✅ | ❌ |
| **Speech Synthesis** | ✅ | C++ | ❌ | ❌ | ❌ | ❌ |
| **WebGPU** | ✅ | C++ | ❌ | ❌ | ❌ | ❌ |
| **navigator.connection** | ✅ | Extension | ❌ | ❌ | ❌ | ❌ |
| **Web Share API** | ✅ | Extension | ❌ | ❌ | ❌ | ❌ |
| **Profile Badge** | ✅ | C++ | ❌ | ❌ | ❌ | ❌ |

图例：✅ 完整支持 | ⚠️ 部分支持 | ❌ 不支持 | ❓ 未确认

## 检测站评分详情

### BrowserScan

| 检测项 | BrowserOS | 说明 |
|--------|-----------|------|
| Browser Fingerprint | ✅ PASS | UA / UA-CH / Platform 一致 |
| IP Address | ✅ PASS | 需配合代理 |
| WebRTC | ✅ PASS | IP 泄露防护 |
| DNS Leak | ✅ PASS | 需配合代理 |
| WebGL | ✅ PASS | Vendor/Renderer + 参数 + 计时 |
| Canvas | ✅ PASS | C++ 层 noise |
| Audio | ✅ PASS | C++ 层 noise |
| Font | ✅ PASS | allowlist + enumeration block |
| Port Scan | ✅ PASS | C++ 层 localhost 拦截 |
| Timezone | ✅ PASS | Intl + Date 一致 |

### CreepJS

| 检测项 | 结果 | 说明 |
|--------|------|------|
| Headless | **0%** | 无 headless 特征 |
| Stealth | **0%** | 无注入痕迹 |
| Lies | 低 | 极少数 API 不一致 |
| Trust Score | A-B | 随 profile 配置质量变化 |

### iphey

| 检测项 | 结果 |
|--------|------|
| 综合评级 | **Trustworthy** |
| Browser | ✅ |
| IP/DNS | ✅ (需代理) |
| Timezone | ✅ |
| Geolocation | ✅ |

### sannysoft

| 检测项 | 结果 |
|--------|------|
| 所有项目 | **全 PASS (绿色)** |
| webdriver | ✅ false |
| chrome runtime | ✅ present |
| permissions | ✅ normal |
| plugins | ✅ consistent |

## BrowserOS 技术优势

### 1. WebGL 全栈防御

BrowserOS 是唯一同时覆盖以下 WebGL 维度的方案：

- **Vendor / Renderer / Unmasked**：C++ 内核返回
- **GL 参数**（MAX_TEXTURE_SIZE 等）：按 GPU profile 定制
- **Shader Precision**：匹配目标 GPU 精度
- **计时防御**：自校准 `crypto.getRandomValues()` 延迟，将 `getParameter` throughput 从 ~2000 ops/ms 降至 30-80 ops/ms，匹配真实 GPU IPC 延迟

竞品通常只覆盖 Vendor/Renderer，参数和计时仍泄露内核级修改痕迹。

### 2. 自校准计时防御

传统固定延迟方案（如 `setTimeout(1)` 或固定循环次数）容易被检测：
- V8 JIT 优化导致热代码路径速度不稳定
- 不同硬件上延迟不一致

BrowserOS 方案：
1. 创建临时 WebGL context
2. 在实际 `getParameter` 调用中测量 throughput
3. 迭代调整 `_gpuDelayIters` 直到 throughput 落在 30-80 ops/ms 区间
4. 使用 `crypto.getRandomValues()` 作为不可优化的系统调用延迟

### 3. UA-CH 网络/JS 一致性

BrowserOS 在 C++ 层（`user_agent_utils.cc`）同时生成：
- HTTP `Sec-CH-UA*` 请求头
- JS `navigator.userAgentData` API 返回值

确保 GREASE brands 顺序、brand 版本号在 HTTP 和 JS 层完全一致。竞品的 JS 注入方案常因 HTTP 头已发送而导致不一致。

### 4. Port Scan 防护

C++ 层（`url_loader.cc`）拦截对 localhost/loopback 的网络请求，防止网站通过端口扫描探测本地服务（如 VPN 客户端、开发工具）。

### 5. WebGPU 基础支持

BrowserOS 已支持 WebGPU adapter info 伪装（vendor、architecture、device、description），为 WebGPU 普及做准备。

## 已知差距与路线图

### P0 — 高优先级

| 差距 | 影响 | 计划 |
|------|------|------|
| CSS `device-width` media query | `matchMedia('(device-width: Xpx)')` 泄露真实分辨率 | 补丁 `media_values.cc` CalculateDeviceWidth/Height |
| `navigator.connection` 缺失 | 部分检测站检查 NetworkInformation API | Extension 层注入默认值 |

### P1 — 中优先级

| 差距 | 影响 | 计划 |
|------|------|------|
| WebGPU limits 精细匹配 | 新兴检测维度，目前影响小 | 按 GPU profile 定制 limits |
| CSS `prefers-color-scheme` 与 profile 联动 | 跨 profile 暗色模式不一致 | 读取 profile 配置设置 MQ |
| `window.outerWidth/Height` | 可能与 screen 不一致 | C++ 层补丁 |

### P2 — 低优先级

| 差距 | 影响 | 计划 |
|------|------|------|
| QUIC fingerprint | 极少数检测站 | 研究 QUIC 层定制 |
| HTTP/2 SETTINGS frame | 高级 TLS 指纹 | 与 JA3 一起优化 |
| `Performance.memory` | Chrome-only API，部分站检测 | C++ 层定制 |
| `navigator.storage.estimate()` | 存储配额可能泄露磁盘信息 | 返回标准化值 |

## 行业共同盲区

以下维度是整个指纹浏览器行业（包括 Multilogin、AdsPower、Camoufox 等）都尚未完善解决的：

| 维度 | 说明 | 检测风险 |
|------|------|----------|
| **WebGPU limits** | `requestAdapterInfo()` 之外的精细 GPU 能力限制，当前所有产品要么不支持 WebGPU 要么只伪装基本 adapter info | 低（WebGPU 尚未普及） |
| **QUIC fingerprint** | QUIC 协议握手参数形成指纹，类似 TLS 的 JA3 | 低 |
| **HTTP/2 SETTINGS** | SETTINGS frame 中的参数（HEADER_TABLE_SIZE、MAX_CONCURRENT_STREAMS 等）可区分浏览器 | 中 |
| **CSS Houdini** | Paint Worklet 渲染差异可作为指纹 | 低 |
| **`navigator.connection`** | NetworkInformation API 在不同网络环境下值不同，大多数产品未伪装 | 中（BrowserOS 已修复） |
| **`Performance.memory`** | Chrome-only API，返回 JS heap 大小，可推断环境 | 低 |
| **WebTransport** | 新兴传输协议的指纹特征 | 极低 |
