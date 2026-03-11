# Camoufox (BrowserOS Firefox Engine)

基于 [Camoufox](https://github.com/daijro/camoufox) 的 Firefox 指纹浏览器，添加了 Profile Badge UI 和品牌定制。

## 前置条件

- macOS + Xcode Command Line Tools
- Python 3.12+
- ~40GB 磁盘空间（Firefox 源码 + 编译产物）
- aria2（`brew install aria2`）

## 快速开始

```bash
# 1. 下载 Firefox 源码（~2GB）
make fetch

# 2. 安装 Mozilla 编译依赖（首次）
make bootstrap

# 3. 编译（自动应用 Camoufox + BrowserOS 补丁）
make build

# 4. 打包 macOS .app
make package

# 5. 运行
make run

# 5b. 带 Profile Badge 运行（测试）
make run-profile
```

## 架构

```
Firefox 源码 → Camoufox 补丁 (make dir) → BrowserOS 补丁 (apply-patches.sh) → 编译
```

### 目录结构

```
packages/camoufox/
├── Makefile                    # 构建编排
├── upstream/                   # Camoufox 上游（git clone）
├── additions/                  # 我们的文件，复制到 Firefox 源码树
│   └── browser/base/content/
│       └── browser-profile-badge.js  # Badge 独立模块（备用）
├── patches/
│   ├── ui/
│   │   ├── profile-badge.patch       # 在 browser-init.js 中注入 badge
│   │   └── branding.patch            # 品牌定制（占位）
│   └── config/
│       └── profile-config.patch      # 配置说明（无需修改 MaskConfig）
├── scripts/
│   ├── apply-patches.sh              # 在 Camoufox 之上叠加我们的补丁
│   ├── build.sh                      # 全流程构建脚本
│   └── generate-config.py            # 指纹配置生成
└── configs/
    └── mozconfig                     # Firefox 编译配置覆盖
```

### Profile Badge

利用 Camoufox 已有的 `ChromeUtils.camouGetString()` API 读取配置，在地址栏动态创建 badge 元素：

```
┌──────────────────────────────────────────────────────┐
│ [amazon66 🇺🇸 US] 🔒 browserscan.net                  │
│  ↑ profile badge      ↑ identity box  ↑ URL         │
└──────────────────────────────────────────────────────┘
```

配置通过 `CAMOU_CONFIG` 环境变量传入：

```json
{
  "profile.name": "amazon66",
  "profile.color": "#4CAF50",
  "profile.ip": "203.0.113.42",
  "profile.country": "US"
}
```

### 技术要点

- **不需要修改 MaskConfig** — `MaskConfig::GetString(key)` 已支持任意键名
- **不需要修改 browser.xhtml** — 通过 JS 动态创建 XUL 元素（同 Camoufox cursor-highlighter 方式）
- **亮度自适应文字** — 使用 sRGB 亮度公式（0.299R + 0.587G + 0.114B > 186）自动切换明暗文字
- **国旗 emoji** — 国家代码自动转换为 Regional Indicator Symbols

## 配置生成

```bash
# 输出 JSON
python scripts/generate-config.py \
  --profile-name "amazon66" \
  --profile-color "#4CAF50" \
  --proxy-ip "203.0.113.42" \
  --country "US"

# 输出环境变量
python scripts/generate-config.py --profile-name "shop01" --country "JP" --env
```
