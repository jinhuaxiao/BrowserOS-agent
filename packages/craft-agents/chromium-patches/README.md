# Nova Seller Browser - Chromium Patches

这些补丁用于构建 Nova Seller 指纹浏览器，包含以下功能：

1. **Profile Badge** - 地址栏显示当前 Profile 名称
2. **Navigator 伪装** - platform, userAgent, hardwareConcurrency, deviceMemory
3. **Screen 伪装** - width, height, availWidth, availHeight, colorDepth
4. **WebGL 伪装** - vendor, renderer, unmaskedVendor, unmaskedRenderer

## 目录结构

```
chromium-patches/
├── README.md                                    # 本文件
├── chrome/browser/ui/views/location_bar/
│   ├── profile_badge_view.h                     # Badge 组件头文件 (新增)
│   ├── profile_badge_view.cc                    # Badge 组件实现 (新增)
│   ├── location_bar_view.h.patch                # 添加 Badge 引用
│   ├── location_bar_view.cc.patch               # 创建和布局 Badge
│   └── BUILD.gn.patch                           # 添加新文件到构建
└── third_party/blink/renderer/
    ├── core/frame/
    │   ├── fingerprint_config.h                 # 配置类头文件 (新增)
    │   ├── fingerprint_config.cc                # 配置类实现 (新增)
    │   ├── navigator.cc.patch                   # Navigator 伪装
    │   ├── navigator_base.cc.patch              # hardwareConcurrency 伪装
    │   ├── navigator_device_memory.cc.patch     # deviceMemory 伪装
    │   ├── screen.cc.patch                      # Screen 属性伪装
    │   └── BUILD.gn.patch                       # 添加新文件到构建
    └── modules/webgl/
        ├── webgl_rendering_context_base.cc.patch  # WebGL vendor/renderer
        └── webgl_debug_renderer_info.cc.patch     # unmasked vendor/renderer
```

## 应用补丁

### 前提条件

1. 已获取 Chromium 源码 (推荐版本: 130+)
2. 已安装 depot_tools
3. 源码位置: `/Users/xiaojinhua/chromium/src/`

### 应用步骤

```bash
# 进入 Chromium 源码目录
cd /Users/xiaojinhua/chromium/src

# 1. 复制新文件
cp /Users/xiaojinhua/workplace/browseragent/chromium-patches/chrome/browser/ui/views/location_bar/profile_badge_view.h \
   chrome/browser/ui/views/location_bar/

cp /Users/xiaojinhua/workplace/browseragent/chromium-patches/chrome/browser/ui/views/location_bar/profile_badge_view.cc \
   chrome/browser/ui/views/location_bar/

cp /Users/xiaojinhua/workplace/browseragent/chromium-patches/third_party/blink/renderer/core/frame/fingerprint_config.h \
   third_party/blink/renderer/core/frame/

cp /Users/xiaojinhua/workplace/browseragent/chromium-patches/third_party/blink/renderer/core/frame/fingerprint_config.cc \
   third_party/blink/renderer/core/frame/

# 2. 应用补丁文件
PATCHES_DIR=/Users/xiaojinhua/workplace/browseragent/chromium-patches

# Location bar patches
patch -p1 < $PATCHES_DIR/chrome/browser/ui/views/location_bar/location_bar_view.h.patch
patch -p1 < $PATCHES_DIR/chrome/browser/ui/views/location_bar/location_bar_view.cc.patch
patch -p1 < $PATCHES_DIR/chrome/browser/ui/views/location_bar/BUILD.gn.patch

# Blink frame patches
patch -p1 < $PATCHES_DIR/third_party/blink/renderer/core/frame/navigator.cc.patch
patch -p1 < $PATCHES_DIR/third_party/blink/renderer/core/frame/navigator_base.cc.patch
patch -p1 < $PATCHES_DIR/third_party/blink/renderer/core/frame/navigator_device_memory.cc.patch
patch -p1 < $PATCHES_DIR/third_party/blink/renderer/core/frame/screen.cc.patch
patch -p1 < $PATCHES_DIR/third_party/blink/renderer/core/frame/BUILD.gn.patch

# WebGL patches
patch -p1 < $PATCHES_DIR/third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc.patch
patch -p1 < $PATCHES_DIR/third_party/blink/renderer/modules/webgl/webgl_debug_renderer_info.cc.patch
```

### 自动应用脚本

```bash
# 运行自动应用脚本
/Users/xiaojinhua/workplace/browseragent/chromium-patches/apply-patches.sh
```

## 编译

```bash
cd /Users/xiaojinhua/chromium/src

# 配置构建 (首次)
gn gen out/Release --args='
  is_official_build=true
  is_debug=false
  target_cpu="arm64"
  chrome_pgo_phase=0
  is_component_build=false
  symbol_level=0
'

# 编译
autoninja -C out/Release chrome

# 或者编译 App bundle (macOS)
autoninja -C out/Release chrome/installer/mac
```

## 配置文件格式

Nova Seller 通过配置文件设置指纹信息：

```ini
# Profile 标识 (用于地址栏 Badge)
profile_id=abc123
profile_name=店铺A
profile_color=#2196F3

# Navigator
user_agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
hardware_concurrency=8
device_memory=8
platform=Win32
vendor=Google Inc.
language=en-US
languages=en-US,en

# Screen
screen_width=1920
screen_height=1080
screen_avail_width=1920
screen_avail_height=1040
screen_color_depth=24
screen_pixel_depth=24
device_pixel_ratio=1

# WebGL
webgl_vendor=Google Inc. (NVIDIA)
webgl_renderer=ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)
webgl_unmasked_vendor=Google Inc. (NVIDIA)
webgl_unmasked_renderer=ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)

# Canvas/Audio 噪声
canvas_noise_enabled=true
canvas_noise_level=0.00005
canvas_session_seed=12345678
audio_noise_enabled=true
audio_noise_level=0.00005
audio_session_seed=87654321

# WebRTC
webrtc_disabled=true
webrtc_public_ip=
webrtc_local_ip=192.168.1.100

# 字体
block_font_enumeration=true
fonts_enabled=Arial,Times New Roman,Courier New
```

## 启动方式

```bash
# 通过命令行参数
/Applications/Nova\ Seller.app/Contents/MacOS/Nova\ Seller \
  --fingerprint-config=/path/to/config.conf \
  --user-data-dir=/path/to/profile

# 通过环境变量
export NOVA_SELLER_FINGERPRINT_CONFIG=/path/to/config.conf
/Applications/Nova\ Seller.app/Contents/MacOS/Nova\ Seller
```

## 验证

打开以下网站验证指纹修改是否生效：

- https://browserleaks.com/javascript
- https://browserleaks.com/webgl
- https://browserleaks.com/canvas
- https://fingerprintjs.com/demo

## 品牌资源位置

图标文件已生成在：
```
/Users/xiaojinhua/workplace/browseragent/resources/icons/
├── NovaSeller.icns          # macOS 图标
├── NovaSeller.ico           # Windows 图标
├── icon_*.png               # 各种尺寸 PNG
└── NovaSeller.iconset/      # macOS iconset
```

## 注意事项

1. 补丁基于 Chromium 130+ 版本，其他版本可能需要手动调整
2. 如果补丁应用失败，检查行号是否需要调整
3. 编译前确保已正确配置 depot_tools 环境
4. macOS 编译需要 Xcode Command Line Tools
