# Nova Seller Profile Badge 实现方案

## 概述

在地址栏（Omnibox）左侧添加一个彩色 Badge，显示当前 Profile 名称，帮助用户识别当前使用的店铺账号。

## 效果预览

```
┌──────────────────────────────────────────────────────────────┐
│  [🏪 店铺A]  |  🔒 https://sellercentral.amazon.com/...      │
└──────────────────────────────────────────────────────────────┘
     ↑ Profile Badge (可配置颜色)
```

## 技术实现

### 1. 需要修改的 Chromium 文件

```
third_party/blink/renderer/core/frame/
├── fingerprint_config.h          # 添加 profile_name 字段
└── fingerprint_config.cc         # 解析 profile_name

chrome/browser/ui/views/location_bar/
├── location_bar_view.h           # 添加 ProfileBadgeView 成员
├── location_bar_view.cc          # 创建和布局 Badge
├── profile_badge_view.h          # 新文件: Badge View 定义
└── profile_badge_view.cc         # 新文件: Badge View 实现

chrome/browser/ui/
└── browser_window.h              # 获取当前 fingerprint config
```

### 2. 配置格式扩展

在 `novaseller_fingerprint.conf` 中添加：

```ini
# Profile identification
profile_id=abc123
profile_name=店铺A
profile_color=#4CAF50
```

### 3. 核心代码实现

#### 3.1 ProfileBadgeView 类定义

```cpp
// chrome/browser/ui/views/location_bar/profile_badge_view.h

#ifndef CHROME_BROWSER_UI_VIEWS_LOCATION_BAR_PROFILE_BADGE_VIEW_H_
#define CHROME_BROWSER_UI_VIEWS_LOCATION_BAR_PROFILE_BADGE_VIEW_H_

#include "ui/views/view.h"
#include "ui/views/controls/label.h"

namespace views {

class ProfileBadgeView : public View {
 public:
  ProfileBadgeView();
  ~ProfileBadgeView() override;

  // 设置 Profile 信息
  void SetProfileName(const std::u16string& name);
  void SetProfileColor(SkColor color);

  // 显示/隐藏
  void SetVisible(bool visible);

 private:
  // UI 组件
  raw_ptr<views::Label> label_ = nullptr;
  SkColor background_color_ = SK_ColorBLUE;

  // View 重写
  void OnPaint(gfx::Canvas* canvas) override;
  gfx::Size CalculatePreferredSize() const override;
};

}  // namespace views

#endif
```

#### 3.2 ProfileBadgeView 实现

```cpp
// chrome/browser/ui/views/location_bar/profile_badge_view.cc

#include "chrome/browser/ui/views/location_bar/profile_badge_view.h"

#include "cc/paint/paint_flags.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/font_list.h"
#include "ui/views/controls/label.h"

namespace views {

ProfileBadgeView::ProfileBadgeView() {
  // 创建标签
  label_ = AddChildView(std::make_unique<views::Label>());
  label_->SetFontList(gfx::FontList().DeriveWithSizeDelta(-1));
  label_->SetEnabledColor(SK_ColorWHITE);
  label_->SetHorizontalAlignment(gfx::ALIGN_CENTER);

  // 默认隐藏
  SetVisible(false);
}

ProfileBadgeView::~ProfileBadgeView() = default;

void ProfileBadgeView::SetProfileName(const std::u16string& name) {
  if (name.empty()) {
    SetVisible(false);
    return;
  }

  // 截断过长的名称
  std::u16string display_name = name;
  if (display_name.length() > 12) {
    display_name = display_name.substr(0, 10) + u"...";
  }

  label_->SetText(display_name);
  SetVisible(true);
  InvalidateLayout();
}

void ProfileBadgeView::SetProfileColor(SkColor color) {
  background_color_ = color;
  SchedulePaint();
}

void ProfileBadgeView::OnPaint(gfx::Canvas* canvas) {
  // 绘制圆角矩形背景
  cc::PaintFlags flags;
  flags.setColor(background_color_);
  flags.setAntiAlias(true);
  flags.setStyle(cc::PaintFlags::kFill_Style);

  gfx::RectF bounds(GetLocalBounds());
  canvas->DrawRoundRect(bounds, 4.0f, flags);

  View::OnPaint(canvas);
}

gfx::Size ProfileBadgeView::CalculatePreferredSize() const {
  gfx::Size label_size = label_->GetPreferredSize();
  // 添加内边距
  return gfx::Size(label_size.width() + 16, label_size.height() + 8);
}

}  // namespace views
```

#### 3.3 LocationBarView 修改

```cpp
// chrome/browser/ui/views/location_bar/location_bar_view.cc

// 在 Init() 方法中添加:
void LocationBarView::Init() {
  // ... 现有代码 ...

  // 添加 Profile Badge
  profile_badge_ = AddChildViewAt(
      std::make_unique<ProfileBadgeView>(), 0);

  // 从 FingerprintConfig 加载 profile 信息
  UpdateProfileBadge();
}

void LocationBarView::UpdateProfileBadge() {
  // 获取当前 tab 的 fingerprint config
  auto* fingerprint_config = GetFingerprintConfig();
  if (fingerprint_config && !fingerprint_config->profile_name.empty()) {
    profile_badge_->SetProfileName(
        base::UTF8ToUTF16(fingerprint_config->profile_name));

    if (fingerprint_config->profile_color != 0) {
      profile_badge_->SetProfileColor(fingerprint_config->profile_color);
    }
  } else {
    profile_badge_->SetVisible(false);
  }
}
```

### 4. FingerprintConfig 扩展

```cpp
// third_party/blink/renderer/core/frame/fingerprint_config.h

struct FingerprintConfig {
  // ... 现有字段 ...

  // Profile identification
  std::string profile_id;
  std::string profile_name;
  uint32_t profile_color = 0;  // ARGB format
};
```

### 5. 配置解析

```cpp
// third_party/blink/renderer/core/frame/fingerprint_config.cc

void FingerprintConfig::LoadFromFile(const std::string& path) {
  // ... 现有解析代码 ...

  // 解析 profile 信息
  if (key == "profile_id") {
    profile_id = value;
  } else if (key == "profile_name") {
    profile_name = value;
  } else if (key == "profile_color") {
    // 解析颜色值 (支持 #RRGGBB 或 #AARRGGBB)
    profile_color = ParseColorValue(value);
  }
}
```

## browseragent 配置更新

### 更新 browseros-config.ts

需要在生成的配置文件中添加 profile 信息：

```typescript
export interface BrowserOSKernelConfig {
  // ... 现有字段 ...

  // Profile identification
  profile_id: string;
  profile_name: string;
  profile_color: string;  // Hex color: #4CAF50
}
```

## 预设颜色方案

为不同平台/用途提供预设颜色：

| 平台 | 颜色 | Hex |
|------|------|-----|
| Amazon US | 蓝色 | #2196F3 |
| Amazon EU | 绿色 | #4CAF50 |
| Amazon JP | 红色 | #F44336 |
| eBay | 黄色 | #FFC107 |
| Shopee | 橙色 | #FF9800 |
| 自定义 | 紫色 | #9C27B0 |

## 实现步骤

1. **Phase 1**: 更新 browseragent 配置生成，添加 profile_name/color
2. **Phase 2**: 创建 Chromium 补丁文件
3. **Phase 3**: 编译测试 Nova Seller 浏览器
4. **Phase 4**: 集成测试和调优

## 补丁文件结构

```
chromium_patches/
├── chrome/browser/ui/views/location_bar/
│   ├── profile_badge_view.h.patch
│   ├── profile_badge_view.cc.patch
│   ├── location_bar_view.h.patch
│   └── location_bar_view.cc.patch
└── third_party/blink/renderer/core/frame/
    ├── fingerprint_config.h.patch
    └── fingerprint_config.cc.patch
```

## 注意事项

1. **多语言支持**: profile_name 需要支持 UTF-8 编码的中文名称
2. **颜色对比度**: Badge 颜色需要保证与白色文字有足够对比度
3. **响应式布局**: 窗口变窄时，Badge 可能需要隐藏或缩短
4. **主题兼容**: 需要同时支持亮色和暗色主题
