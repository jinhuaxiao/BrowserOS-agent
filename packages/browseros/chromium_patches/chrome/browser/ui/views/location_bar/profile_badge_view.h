// Copyright 2024 BrowserOS Authors
// Profile badge view for displaying profile name in location bar

#ifndef CHROME_BROWSER_UI_VIEWS_LOCATION_BAR_PROFILE_BADGE_VIEW_H_
#define CHROME_BROWSER_UI_VIEWS_LOCATION_BAR_PROFILE_BADGE_VIEW_H_

#include <string>

#include "ui/base/metadata/metadata_header_macros.h"
#include "ui/views/view.h"

namespace views {
class Label;
}  // namespace views

// ProfileBadgeView displays the current profile name as a compact pill-shaped
// badge in the location bar. This helps users identify which profile/store
// they are currently using.
//
// Visual appearance:
// - Pill-shaped (fully rounded) background with configurable color
// - Compact text with auto dark/light contrast
// - Example: (amazon66) browserscan.net/zh
class ProfileBadgeView : public views::View {
  METADATA_HEADER(ProfileBadgeView, views::View)

 public:
  ProfileBadgeView();
  ProfileBadgeView(const ProfileBadgeView&) = delete;
  ProfileBadgeView& operator=(const ProfileBadgeView&) = delete;
  ~ProfileBadgeView() override;

  void SetProfile(const std::string& name, const std::string& color);
  bool HasProfile() const { return !profile_name_.empty(); }

  // views::View overrides
  void OnPaint(gfx::Canvas* canvas) override;
  gfx::Size CalculatePreferredSize(const views::SizeBounds& available_size) const override;
  void OnThemeChanged() override;

 private:
  static SkColor ParseHexColor(const std::string& hex_color);
  static std::string TruncateName(const std::string& name, size_t max_length = 12);
  bool ShouldUseDarkText() const;

  std::string profile_name_;
  std::string profile_color_;
  SkColor background_color_ = SkColorSetRGB(0x21, 0x96, 0xF3);

  raw_ptr<views::Label> label_ = nullptr;

  // Compact layout constants matching location bar aesthetic
  static constexpr int kBadgeHeight = 18;
  static constexpr int kHorizontalPadding = 7;
};

#endif  // CHROME_BROWSER_UI_VIEWS_LOCATION_BAR_PROFILE_BADGE_VIEW_H_
