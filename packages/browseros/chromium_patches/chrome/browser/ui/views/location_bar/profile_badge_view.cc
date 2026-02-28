// Copyright 2024 BrowserOS Authors
// Profile badge view implementation

#include "chrome/browser/ui/views/location_bar/profile_badge_view.h"

#include <algorithm>

#include "base/strings/string_util.h"
#include "cc/paint/paint_flags.h"
#include "third_party/blink/common/fingerprint/fingerprint_config.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/font_list.h"
#include "ui/gfx/geometry/rect.h"
#include "ui/gfx/geometry/rect_f.h"
#include "ui/gfx/geometry/rounded_corners_f.h"
#include "ui/gfx/geometry/skia_conversions.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/views/controls/label.h"
#include "ui/views/layout/fill_layout.h"

BEGIN_METADATA(ProfileBadgeView)
END_METADATA

ProfileBadgeView::ProfileBadgeView() {
  SetLayoutManager(std::make_unique<views::FillLayout>());

  label_ = AddChildView(std::make_unique<views::Label>());
  label_->SetHorizontalAlignment(gfx::ALIGN_CENTER);
  label_->SetEnabledColor(SK_ColorWHITE);
  label_->SetAutoColorReadabilityEnabled(false);

  // Load profile from fingerprint config if available
  const auto& config = blink::FingerprintConfig::GetInstance();
  if (config.HasProfileBadge()) {
    SetProfile(config.GetProfileName(), config.GetProfileColor());
  }
}

ProfileBadgeView::~ProfileBadgeView() = default;

void ProfileBadgeView::SetProfile(const std::string& name,
                                   const std::string& color) {
  profile_name_ = TruncateName(name);
  profile_color_ = color;
  background_color_ = ParseHexColor(color);

  if (label_) {
    label_->SetText(base::UTF8ToUTF16(profile_name_));
  }

  SetVisible(!profile_name_.empty());
  InvalidateLayout();
  SchedulePaint();
}

void ProfileBadgeView::OnPaint(gfx::Canvas* canvas) {
  if (profile_name_.empty()) {
    return;
  }

  // Draw rounded rectangle background
  cc::PaintFlags flags;
  flags.setColor(background_color_);
  flags.setStyle(cc::PaintFlags::kFill_Style);
  flags.setAntiAlias(true);

  gfx::RectF bounds(GetLocalBounds());
  canvas->DrawRoundRect(bounds, kCornerRadius, flags);

  // Let the label draw itself
  views::View::OnPaint(canvas);
}

gfx::Size ProfileBadgeView::CalculatePreferredSize(
    const views::SizeBounds& available_size) const {
  if (profile_name_.empty() || !label_) {
    return gfx::Size(0, 0);
  }

  gfx::Size label_size = label_->GetPreferredSize();
  int width = label_size.width() + (kHorizontalPadding * 2);
  return gfx::Size(width, kBadgeHeight);
}

void ProfileBadgeView::OnThemeChanged() {
  views::View::OnThemeChanged();
  SchedulePaint();
}

// static
SkColor ProfileBadgeView::ParseHexColor(const std::string& hex_color) {
  if (hex_color.empty()) {
    return SkColorSetRGB(0x21, 0x96, 0xF3);  // Default blue
  }

  std::string color = hex_color;
  // Remove leading '#' if present
  if (color[0] == '#') {
    color = color.substr(1);
  }

  // Handle 3-char shorthand (e.g., "F00" -> "FF0000")
  if (color.length() == 3) {
    std::string expanded;
    for (char c : color) {
      expanded += c;
      expanded += c;
    }
    color = expanded;
  }

  // Parse 6-char hex color
  if (color.length() != 6) {
    return SkColorSetRGB(0x21, 0x96, 0xF3);  // Default blue on parse error
  }

  unsigned int r = 0, g = 0, b = 0;
  if (sscanf(color.c_str(), "%02x%02x%02x", &r, &g, &b) != 3) {
    return SkColorSetRGB(0x21, 0x96, 0xF3);  // Default blue on parse error
  }

  return SkColorSetRGB(r, g, b);
}

// static
std::string ProfileBadgeView::TruncateName(const std::string& name,
                                            size_t max_length) {
  std::string trimmed = name;
  base::TrimWhitespaceASCII(trimmed, base::TRIM_ALL, &trimmed);

  if (trimmed.length() <= max_length) {
    return trimmed;
  }

  // Truncate and add ellipsis
  return trimmed.substr(0, max_length - 1) + "\xE2\x80\xA6";  // UTF-8 ellipsis
}
