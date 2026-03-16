// Copyright 2024 BrowserOS Authors
// Profile badge view implementation

#include "chrome/browser/ui/views/location_bar/profile_badge_view.h"

#include <algorithm>

#include "base/strings/string_util.h"
#include "base/strings/utf_string_conversions.h"
#include "build/build_config.h"
#include "cc/paint/paint_flags.h"
#include "third_party/blink/common/fingerprint/fingerprint_config.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/font.h"
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
  label_->SetAutoColorReadabilityEnabled(false);

  label_->SetFontList(gfx::FontList({"Helvetica Neue", "Arial", "sans-serif"},
                                     gfx::Font::NORMAL, 11,
                                     gfx::Font::Weight::MEDIUM));

  // Load profile from fingerprint config if available
  const auto& config = blink::FingerprintConfig::GetInstance();
  if (config.HasProfileBadge()) {
    SetProfile(config.GetProfileName(), config.GetProfileColor(),
               config.GetProfileCountry(), config.GetProfileIp());
  }
}

ProfileBadgeView::~ProfileBadgeView() = default;

void ProfileBadgeView::SetProfile(const std::string& name,
                                   const std::string& color,
                                   const std::string& country,
                                   const std::string& ip) {
  profile_name_ = TruncateName(name);
  profile_color_ = color;
  profile_country_ = country;
  profile_ip_ = ip;
  background_color_ = ParseHexColor(color);

  if (label_) {
    std::u16string display_text;
    if (!profile_country_.empty()) {
#if BUILDFLAG(IS_WIN)
      // Windows Segoe UI Emoji doesn't render flag emoji — use text fallback
      display_text = u"[" + base::UTF8ToUTF16(profile_country_) + u"] " +
                     base::UTF8ToUTF16(profile_name_);
#else
      std::u16string flag = CountryToFlagEmoji(profile_country_);
      if (!flag.empty()) {
        display_text = flag + u" " + base::UTF8ToUTF16(profile_name_);
      } else {
        display_text = base::UTF8ToUTF16(profile_name_);
      }
#endif
    } else {
      display_text = base::UTF8ToUTF16(profile_name_);
    }
    label_->SetText(display_text);

    // Use white text for dark backgrounds, dark text for light backgrounds
    label_->SetEnabledColor(ShouldUseDarkText() ? SkColorSetRGB(0x20, 0x20, 0x20)
                                                 : SK_ColorWHITE);

    // Set tooltip: "name | IP | country" when proxy info available
    if (!profile_ip_.empty()) {
      std::u16string tooltip = base::UTF8ToUTF16(name);
      tooltip += u" | " + base::UTF8ToUTF16(profile_ip_);
      if (!profile_country_.empty()) {
        tooltip += u" | " + base::UTF8ToUTF16(profile_country_);
      }
      SetTooltipText(tooltip);
    }
  }

  SetVisible(!profile_name_.empty());
  InvalidateLayout();
  SchedulePaint();
}

void ProfileBadgeView::OnPaint(gfx::Canvas* canvas) {
  if (profile_name_.empty()) {
    return;
  }

  cc::PaintFlags flags;
  flags.setAntiAlias(true);

  gfx::RectF bounds(GetLocalBounds());
  const float radius = static_cast<float>(kCornerRadius);

  // Fill background
  flags.setColor(background_color_);
  flags.setStyle(cc::PaintFlags::kFill_Style);
  canvas->DrawRoundRect(bounds, radius, flags);

  // Subtle 1px border for depth (12% black overlay)
  flags.setColor(SkColorSetA(SK_ColorBLACK, 30));
  flags.setStyle(cc::PaintFlags::kStroke_Style);
  flags.setStrokeWidth(1.0f);
  gfx::RectF stroke_bounds(bounds);
  stroke_bounds.Inset(0.5f);
  canvas->DrawRoundRect(stroke_bounds, radius - 0.5f, flags);

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

bool ProfileBadgeView::ShouldUseDarkText() const {
  // Calculate relative luminance using sRGB coefficients
  int r = SkColorGetR(background_color_);
  int g = SkColorGetG(background_color_);
  int b = SkColorGetB(background_color_);
  double luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 186.0;
}

// static
SkColor ProfileBadgeView::ParseHexColor(const std::string& hex_color) {
  if (hex_color.empty()) {
    return SkColorSetRGB(0x21, 0x96, 0xF3);  // Default blue
  }

  std::string color = hex_color;
  if (color[0] == '#') {
    color = color.substr(1);
  }

  if (color.length() == 3) {
    std::string expanded;
    for (char c : color) {
      expanded += c;
      expanded += c;
    }
    color = expanded;
  }

  if (color.length() != 6) {
    return SkColorSetRGB(0x21, 0x96, 0xF3);
  }

  uint32_t rgb = 0;
  if (!base::HexStringToUInt(color, &rgb)) {
    return SkColorSetRGB(0x21, 0x96, 0xF3);
  }

  return SkColorSetRGB((rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF);
}

// static
std::u16string ProfileBadgeView::CountryToFlagEmoji(
    const std::string& country_code) {
  if (country_code.length() != 2) {
    return std::u16string();
  }
  // Regional Indicator Symbol Letters: U+1F1E6 ('A') to U+1F1FF ('Z')
  // Each letter is in the supplementary plane, requiring a surrogate pair in UTF-16
  char c0 = base::ToUpperASCII(country_code[0]);
  char c1 = base::ToUpperASCII(country_code[1]);
  if (c0 < 'A' || c0 > 'Z' || c1 < 'A' || c1 > 'Z') {
    return std::u16string();
  }

  std::u16string result;
  // First regional indicator symbol (surrogate pair)
  uint32_t cp0 = 0x1F1E6 + (c0 - 'A');
  result += static_cast<char16_t>(0xD800 + ((cp0 - 0x10000) >> 10));
  result += static_cast<char16_t>(0xDC00 + ((cp0 - 0x10000) & 0x3FF));
  // Second regional indicator symbol (surrogate pair)
  uint32_t cp1 = 0x1F1E6 + (c1 - 'A');
  result += static_cast<char16_t>(0xD800 + ((cp1 - 0x10000) >> 10));
  result += static_cast<char16_t>(0xDC00 + ((cp1 - 0x10000) & 0x3FF));
  return result;
}

// static
std::string ProfileBadgeView::TruncateName(const std::string& name,
                                            size_t max_length) {
  std::string trimmed = name;
  base::TrimWhitespaceASCII(trimmed, base::TRIM_ALL, &trimmed);

  if (trimmed.length() <= max_length) {
    return trimmed;
  }

  return trimmed.substr(0, max_length - 1) + "\xE2\x80\xA6";  // UTF-8 ellipsis
}
