// Copyright 2025 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef CHROME_BROWSER_UI_VIEWS_SIDE_PANEL_CLASH_OF_GPTS_CLASH_OF_GPTS_WINDOW_H_
#define CHROME_BROWSER_UI_VIEWS_SIDE_PANEL_CLASH_OF_GPTS_CLASH_OF_GPTS_WINDOW_H_

#include <memory>

#include "base/memory/raw_ptr.h"
#include "ui/views/widget/widget.h"
#include "ui/views/widget/widget_delegate.h"

class Browser;
class ClashOfGptsCoordinator;
class ClashOfGptsView;

namespace views {
class Widget;
}  // namespace views

// ClashOfGptsWindow manages the window containing the Clash of GPTs UI.
class ClashOfGptsWindow : public views::WidgetDelegate {
 public:
  ClashOfGptsWindow(Browser* browser, ClashOfGptsCoordinator* coordinator);
  ~ClashOfGptsWindow() override;

  // Shows the window
  void Show();

  // Closes the window
  void Close();

  // Returns true if the window is showing
  bool IsShowing() const;

  // Gets the main view
  ClashOfGptsView* GetView() { return view_; }
  
  // Sets the widget (called by coordinator after creation)
  void SetWidget(views::Widget* widget) { widget_ = widget; }

  // Clear browser pointer to prevent dangling raw_ptr during shutdown.
  // Called by coordinator before destroying this window.
  void ClearBrowser() { browser_ = nullptr; }
  
  // views::WidgetDelegate:
  views::Widget* GetWidget() override;
  const views::Widget* GetWidget() const override;
  std::u16string GetWindowTitle() const override;
  bool CanResize() const override;
  bool CanMaximize() const override;
  bool CanMinimize() const override;
  bool ShouldShowCloseButton() const override;
  views::View* GetContentsView() override;
  ui::ImageModel GetWindowIcon() override;
  ui::ImageModel GetWindowAppIcon() override;

 private:

  raw_ptr<Browser> browser_;
  raw_ptr<ClashOfGptsCoordinator> coordinator_;
  raw_ptr<ClashOfGptsView> view_ = nullptr;
  
  // Widget is owned by the coordinator, we just keep a raw pointer
  raw_ptr<views::Widget> widget_ = nullptr;
};

#endif  // CHROME_BROWSER_UI_VIEWS_SIDE_PANEL_CLASH_OF_GPTS_CLASH_OF_GPTS_WINDOW_H_