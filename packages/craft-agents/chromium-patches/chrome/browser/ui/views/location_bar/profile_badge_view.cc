// Copyright 2024 Nova Seller. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/views/location_bar/profile_badge_view.h"

#include <algorithm>

#include "base/strings/string_util.h"
#include "base/strings/utf_string_conversions.h"
#include "cc/paint/paint_flags.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/color/color_id.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/color_utils.h"
#include "ui/gfx/font_list.h"
#include "ui/gfx/geometry/rect_f.h"
#include "ui/views/controls/label.h"

ProfileBadgeView::ProfileBadgeView() {
  // Create the label for displaying profile name
  label_ = AddChildView(std::make_unique<views::Label>());

  // Use a slightly smaller font
  label_->SetFontList(gfx::FontList().DeriveWithSizeDelta(-1));

  // Center the text
  label_->SetHorizontalAlignment(gfx::ALIGN_CENTER);
  label_->SetVerticalAlignment(gfx::ALIGN_MIDDLE);

  // Set initial text color (will be updated based on background)
  UpdateTextColor();

  // Start hidden until a profile name is set
  SetVisible(false);
}

ProfileBadgeView::~ProfileBadgeView() = default;

void ProfileBadgeView::SetProfileName(const std::u16string& name) {
  profile_name_ = name;

  if (name.empty()) {
    SetVisible(false);
    return;
  }

  // Truncate long names
  std::u16string display_name = name;
  if (display_name.length() > kMaxDisplayLength) {
    display_name = display_name.substr(0, kMaxDisplayLength - 3) + u"...";
  }

  label_->SetText(display_name);
  SetVisible(true);
  InvalidateLayout();
  SchedulePaint();
}

void ProfileBadgeView::SetProfileColor(SkColor color) {
  if (background_color_ == color) {
    return;
  }

  background_color_ = color;
  UpdateTextColor();
  SchedulePaint();
}

void ProfileBadgeView::SetProfile(const std::string& name,
                                   const std::string& hex_color) {
  SetProfileColor(ParseHexColor(hex_color));
  SetProfileName(base::UTF8ToUTF16(name));
}

const std::u16string& ProfileBadgeView::GetProfileName() const {
  return profile_name_;
}

bool ProfileBadgeView::IsProfileBadgeVisible() const {
  return GetVisible() && !profile_name_.empty();
}

gfx::Size ProfileBadgeView::CalculatePreferredSize(
    const views::SizeBounds& available_size) const {
  if (!GetVisible() || profile_name_.empty()) {
    return gfx::Size();
  }

  gfx::Size label_size = label_->GetPreferredSize();
  return gfx::Size(label_size.width() + kHorizontalPadding * 2,
                   label_size.height() + kVerticalPadding * 2);
}

void ProfileBadgeView::OnPaint(gfx::Canvas* canvas) {
  if (!GetVisible() || profile_name_.empty()) {
    return;
  }

  // Draw rounded rectangle background
  cc::PaintFlags flags;
  flags.setColor(background_color_);
  flags.setAntiAlias(true);
  flags.setStyle(cc::PaintFlags::kFill_Style);

  gfx::RectF bounds(GetLocalBounds());
  canvas->DrawRoundRect(bounds, kCornerRadius, flags);

  // Let the parent class draw children (the label)
  views::View::OnPaint(canvas);
}

void ProfileBadgeView::OnThemeChanged() {
  views::View::OnThemeChanged();
  UpdateTextColor();
}

void ProfileBadgeView::UpdateTextColor() {
  if (!label_) {
    return;
  }

  // Use light text on dark backgrounds, dark text on light backgrounds
  SkColor text_color = ShouldUseLightText(background_color_)
                           ? SK_ColorWHITE
                           : SK_ColorBLACK;
  label_->SetEnabledColor(text_color);
}

// static
SkColor ProfileBadgeView::ParseHexColor(const std::string& hex_color) {
  // Default color if parsing fails
  SkColor default_color = SkColorSetRGB(0x60, 0x7D, 0x8B);  // Blue-grey

  if (hex_color.empty()) {
    return default_color;
  }

  std::string color = hex_color;

  // Remove # prefix if present
  if (color[0] == '#') {
    color = color.substr(1);
  }

  // Parse RGB or ARGB hex string
  if (color.length() == 6) {
    // RGB format: RRGGBB
    unsigned int rgb;
    if (sscanf(color.c_str(), "%x", &rgb) == 1) {
      return SkColorSetRGB((rgb >> 16) & 0xFF,
                           (rgb >> 8) & 0xFF,
                           rgb & 0xFF);
    }
  } else if (color.length() == 8) {
    // ARGB format: AARRGGBB
    unsigned int argb;
    if (sscanf(color.c_str(), "%x", &argb) == 1) {
      return SkColorSetARGB((argb >> 24) & 0xFF,
                            (argb >> 16) & 0xFF,
                            (argb >> 8) & 0xFF,
                            argb & 0xFF);
    }
  }

  return default_color;
}

// static
bool ProfileBadgeView::ShouldUseLightText(SkColor background_color) {
  // Calculate relative luminance using the formula from WCAG 2.0
  // https://www.w3.org/TR/WCAG20/#relativeluminancedef
  double r = SkColorGetR(background_color) / 255.0;
  double g = SkColorGetG(background_color) / 255.0;
  double b = SkColorGetB(background_color) / 255.0;

  // Apply gamma correction
  r = (r <= 0.03928) ? r / 12.92 : pow((r + 0.055) / 1.055, 2.4);
  g = (g <= 0.03928) ? g / 12.92 : pow((g + 0.055) / 1.055, 2.4);
  b = (b <= 0.03928) ? b / 12.92 : pow((b + 0.055) / 1.055, 2.4);

  double luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Use light text if background is dark (luminance < 0.5)
  return luminance < 0.5;
}

BEGIN_METADATA(ProfileBadgeView)
END_METADATA
