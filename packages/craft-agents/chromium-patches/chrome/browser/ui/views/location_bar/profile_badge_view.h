// Copyright 2024 Nova Seller. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef CHROME_BROWSER_UI_VIEWS_LOCATION_BAR_PROFILE_BADGE_VIEW_H_
#define CHROME_BROWSER_UI_VIEWS_LOCATION_BAR_PROFILE_BADGE_VIEW_H_

#include <string>

#include "base/memory/raw_ptr.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/views/view.h"

namespace views {
class Label;
}

// ProfileBadgeView displays a colored badge in the location bar showing
// the current browser profile name. This helps users identify which
// e-commerce store account they are currently using.
//
// The badge appears on the left side of the location bar with:
// - A colored rounded rectangle background
// - White text showing the profile name (truncated if too long)
//
// Example: [店铺A] | https://amazon.com/...
//
class ProfileBadgeView : public views::View {
 public:
  METADATA_HEADER(ProfileBadgeView, views::View)

  ProfileBadgeView();
  ProfileBadgeView(const ProfileBadgeView&) = delete;
  ProfileBadgeView& operator=(const ProfileBadgeView&) = delete;
  ~ProfileBadgeView() override;

  // Sets the profile name to display. If empty, the badge will be hidden.
  // Long names will be truncated with "..." suffix.
  void SetProfileName(const std::u16string& name);

  // Sets the background color of the badge.
  // Default is a blue-grey color (#607D8B).
  void SetProfileColor(SkColor color);

  // Sets both name and color from hex color string (e.g., "#2196F3").
  void SetProfile(const std::string& name, const std::string& hex_color);

  // Returns the current profile name.
  const std::u16string& GetProfileName() const;

  // Returns true if the badge is currently visible.
  bool IsProfileBadgeVisible() const;

  // views::View:
  gfx::Size CalculatePreferredSize(
      const views::SizeBounds& available_size) const override;
  void OnPaint(gfx::Canvas* canvas) override;
  void OnThemeChanged() override;

 private:
  // Updates the label text color based on background color for contrast.
  void UpdateTextColor();

  // Parses a hex color string to SkColor.
  static SkColor ParseHexColor(const std::string& hex_color);

  // Calculates whether text should be light or dark based on background.
  static bool ShouldUseLightText(SkColor background_color);

  // Maximum characters to display before truncating.
  static constexpr size_t kMaxDisplayLength = 12;

  // Padding around the label text.
  static constexpr int kHorizontalPadding = 8;
  static constexpr int kVerticalPadding = 4;

  // Corner radius for the rounded rectangle background.
  static constexpr float kCornerRadius = 4.0f;

  // The label showing the profile name.
  raw_ptr<views::Label> label_ = nullptr;

  // The background color of the badge.
  SkColor background_color_ = SkColorSetRGB(0x60, 0x7D, 0x8B);  // Blue-grey

  // The current profile name (full, not truncated).
  std::u16string profile_name_;
};

#endif  // CHROME_BROWSER_UI_VIEWS_LOCATION_BAR_PROFILE_BADGE_VIEW_H_
