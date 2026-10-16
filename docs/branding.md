# BugSnap Branding & Icon Assets

This document defines the branding asset specifications, source files, margin rules, and generation pipeline for BugSnap.

## 1. Asset Locations

- **Original Artwork Source:**  
  `assets/icon-source/bugsnap-icon-master-original.png`  
  *Preserved byte-identical copy of the approved source artwork (`Glossy_Ladybug_Scanner_Icon.png`, 1254×1254, RGB).*  
  *SHA-256: `9ad472827b009ab5e86be50884a4fbba136d2043a2467d5dbd35f4df28e6eeef`*

- **Transparent Master Tile (1024×1024):**  
  `assets/icon-source/bugsnap-icon-master-1024.png`  
  *1024×1024 RGBA. Continuous-corner squircle (superellipse exponent $n = 4.5$, 1.5px source inset) rendered with 4x supersampling and box filtering. Fully transparent outside tile (alpha 0 at all 4 corners) and solid interior (alpha 255).*

- **Store Listing Artwork (512×512):**  
  `assets/store/icon-512.png`  
  *432px squircle tile centered in 512×512 canvas with a subtle 12px blur drop shadow for Chrome Web Store listing (not shipped inside extension).*

- **Shipped Platform Icons (`public/icons/`):**  
  - `icon-128.png` (128×128): Full artwork, 112px tile centered (~12% margin).
  - `icon-48.png` (48×48): Full artwork, 44px tile centered (~4% margin), light unsharp mask.
  - `icon-32.png` (32×32): Dedicated simplified variant.
  - `icon-16.png` (16×16): Dedicated simplified variant.

- **In-App Brand Mark (`src/assets/brand/`):**  
  - `bugsnap-mark.png` (96×96): Full artwork 2x raster asset bundled via Vite into `src/shared/BrandMark.tsx`. Displayed at 24px in the editor header and 28px in the popup header.

## 2. Margin & Edge Contrast Rules

- **Transparent Margins:**  
  - **128px:** Uses an ~12% transparent canvas margin (112px tile in 128px canvas) following the official Chrome Web Store icon guidelines to prevent edge clipping when rendered inside circular or squircle store containers.
  - **48px:** Uses an ~4% transparent canvas margin (44px tile in 48px canvas).
  - **32px & 16px:** Full bleed within target canvas.

- **Inner Edge Stroke (Required for Light Toolbars):**  
  Because the glossy frosted squircle tile is near-white (RGB ~248,246,246), it would wash out against light browser toolbars. A 1px inner stroke matching the exact squircle geometry with `rgba(0,0,0,0.14)` is composited onto all icons. This provides crisp edge contrast on light backgrounds (delta ≥ 40 RGB units) while remaining subtle and elegant on dark backgrounds.

## 3. Simplified Variants for 16px and 32px

At 16px and 32px, downscaling the full artwork causes the four corner scanner brackets to blur into low-contrast grey smudges, simultaneously squeezing the ladybug into an indistinct red dot.

- **16px Variant:** Corner brackets are dropped. The ladybug is cropped and scaled to fill ~74% of the tile width (11×13px), centered on the frosted tile, with enhanced local contrast and saturation. The red shell, dark head, center seam, and wing dots remain clearly distinguishable.
- **32px Variant:** Corner brackets are omitted in favor of a crisp, recognizable ladybug filling ~70% of the tile width (22×25px) with clearly defined wing dots and antenna highlights.

## 4. Pipeline & Regeneration

The icon suite is generated using a standalone developer script:

```bash
python3 scripts/build-icons.py
```

*Requirements: Python 3 with Pillow (`PIL`). This script is a one-off developer tool and is not wired into `package.json` scripts or extension production builds.*

## 5. Maintenance Note

> **IMPORTANT:** Do not edit the PNGs in `public/icons/` or `src/assets/brand/` by hand. Always update `scripts/build-icons.py` and regenerate all sizes together to maintain identical squircle curvature, alpha consistency, and byte optimization budgets.
