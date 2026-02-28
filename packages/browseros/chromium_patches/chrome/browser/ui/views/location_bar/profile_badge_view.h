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

// ProfileBadgeView displays the current profile name with a colored background
// in the location bar. This helps users identify which profile/store they are
// currently using, especially useful for multi-account management scenarios.
//
// Visual appearance:
// - Rounded rectangle background with configurable color
// - White text showing profile name (truncated if > 12 characters)
// - Example: [Store A] | https://amazon.com/...
//
// Configuration via fingerprint config:
// - profile_id: Unique identifier for the profile
// - profile_name: Display name shown in the badge
// - profile_color: Background color in hex format (e.g., "#2196F3")
class ProfileBadgeView : public views::View {
  METADATA_HEADER(ProfileBadgeView, views::View)

 public:
  ProfileBadgeView();
  ProfileBadgeView(const ProfileBadgeView&) = delete;
  ProfileBadgeView& operator=(const ProfileBadgeView&) = delete;
  ~ProfileBadgeView() override;

  // Updates the badge with the given profile information
  void SetProfile(const std::string& name, const std::string& color);

  // Returns whether the badge has valid profile data to display
  bool HasProfile() const { return !profile_name_.empty(); }

  // views::View overrides
  void OnPaint(gfx::Canvas* canvas) override;
  gfx::Size CalculatePreferredSize(const views::SizeBounds& available_size) const override;
  void OnThemeChanged() override;

 private:
  // Parses a hex color string (e.g., "#2196F3") to SkColor
  static SkColor ParseHexColor(const std::string& hex_color);

  // Truncates the profile name if it exceeds max length
  static std::string TruncateName(const std::string& name, size_t max_length = 12);

  // Profile data
  std::string profile_name_;
  std::string profile_color_;
  SkColor background_color_ = SkColorSetRGB(0x21, 0x96, 0xF3);  // Default blue

  // UI components
  raw_ptr<views::Label> label_ = nullptr;

  // Layout constants
  static constexpr int kBadgeHeight = 20;
  static constexpr int kHorizontalPadding = 8;
  static constexpr int kCornerRadius = 4;
};

#endif  // CHROME_BROWSER_UI_VIEWS_LOCATION_BAR_PROFILE_BADGE_VIEW_H_
