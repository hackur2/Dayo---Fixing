# DaYo Responsive Design Review

Project: **DaYo!: A Progressive Web-Based Food Ordering and Inventory Control System with AI Menu Suggestions**

This document records the current intended responsive behavior of the frontend.

## 1. Main Rule

```txt
Customer pages       → mobile-first
Admin/Super Admin    → desktop-first, with tablet/phone adaptations
```

Responsive testing should focus on behavior, not only specific device names.

Recommended checkpoints:

```txt
Desktop/laptop: 1366px or similar
Tablet/iPad:    768px–900px
Phone:          390px–430px
Very small:     around 360px–380px
```

## 2. Customer Menu

The Customer Menu is designed around narrow/mobile use and expands at larger widths.

Important behavior:

- top header and floating bag remain available;
- categories can be opened through the collapsible category sidebar;
- subcategory pills scroll horizontally when needed;
- menu cards and promo content adjust with viewport size;
- item details modal must fit the screen;
- bottom checkout bar must not hide important content;
- AI floating assistant stays visible while browsing the menu;
- AI floating assistant is hidden while an item-details modal is open;
- AI chat modal is sized for phone use and constrained by viewport height.

Customer Menu CSS currently includes checkpoints around:

```txt
max-width: 380px
min-width: 768px
min-width: 1024px
```

Other Customer pages use tablet enhancements starting around `768px` while remaining mobile-friendly by default.

## 3. Customer Cart / Checkout / Status / Receipt / Feedback

These pages use mobile-first single-column layouts and receive wider-screen adjustments at approximately `768px`.

Testing should confirm:

- forms remain readable;
- action buttons remain reachable;
- long item names do not break layout;
- totals remain visible;
- no important action is hidden behind fixed elements;
- empty/error/success states fit narrow screens.

## 4. Shared Admin/Super Admin Layout

Admin and Super Admin share:

```txt
AdminShell.jsx
adminLayout.css
```

Therefore responsive shell changes apply to both roles.

### Above 1100px

- full left sidebar;
- main content uses larger padding;
- footer actions stay at the bottom of the sidebar.

### 1100px and below

- sidebar reduces to approximately 220px;
- main content padding is reduced.

### 900px and below

The management layout changes substantially:

- sidebar becomes a full-width sticky top section;
- navigation links become a horizontal scrollable row;
- page content moves below the management header/navigation;
- **View Customer Menu** and **Logout** become a fixed bottom action bar;
- the two bottom actions remain side-by-side;
- extra bottom padding is added to the main content so the fixed bar does not cover cards/tables.

### 560px and below

- bottom action spacing and text size become more compact;
- both bottom actions remain side-by-side;
- main content padding is further reduced.

## 5. Manual POS

Manual POS has additional responsive rules independent of the shared Admin shell.

Current checkpoints:

```txt
1180px
720px
520px
```

Expected behavior:

### Desktop

- menu area and Current Order panel can appear side-by-side.

### 1180px and below

- POS layout stacks so Current Order does not become too narrow.

### 720px and below

- spacing/cards/toolbar are reduced for smaller screens.

### 520px and below

- menu becomes a narrow-phone-friendly single-column layout where needed.

## 6. Tables

Admin/Super Admin pages contain wide data tables.

Responsive behavior must prevent the whole page from breaking horizontally. Table wrappers/module CSS should handle horizontal overflow when the data cannot reasonably fit.

Test especially:

```txt
Order Summary
Inventory
Orders
Staff Monitor
Feedback
```

## 7. Modals

Test all management and customer modals on tablet/phone sizes:

```txt
Customer Item Details
Admin Order Details
Inventory Add/Edit
Staff Add/Edit/Directory
```

A modal should:

- remain within the viewport;
- allow its own vertical scrolling when necessary;
- keep the close/action controls reachable;
- not be covered by fixed navigation/action bars.

## 8. Responsive Regression Checklist

After layout changes, verify all three sizes:

```txt
Desktop
Tablet
Phone
```

Check:

- no overlapping fixed elements;
- no hidden final table rows/cards;
- no clipped buttons;
- readable text sizes;
- horizontal navigation remains usable;
- logout/customer-menu actions remain reachable on management pages;
- Customer checkout/bag actions remain reachable;
- modal layering is correct.
