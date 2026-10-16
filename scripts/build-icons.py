#!/usr/bin/env python3
"""
BugSnap Icon Generation Pipeline
Extracts, masks, scales, and optimizes the approved brand icon into:
- Master 1024x1024 transparent RGBA squircle tile
- Shipped extension icons (16, 32, 48, 128) in public/icons/
- Store listing icon (512) in assets/store/
- 2x brand mark (96) in src/assets/brand/

This script is a developer utility and is not required for extension build.
Requires: Python 3 with Pillow (PIL).
"""

import os
import sys
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

# Exact detected tile bounds in Glossy_Ladybug_Scanner_Icon.png (1254x1254)
# Left: 125, Top: 110, Right: 1125, Bottom: 1110 (1000x1000 square tile)
TILE_CROP_BOX = (125, 110, 1125, 1110)
SQUIRCLE_EXPONENT = 4.5
INSET_SRC_PX = 1.5  # Inset by 1.5 source px to eliminate background halo

def make_squircle_mask(size, inset_px=1.5, scale=4, exponent=SQUIRCLE_EXPONENT):
    """
    Renders an anti-aliased squircle mask at `scale`x resolution and downsamples with BOX filter.
    Formula: |(x - c)/r|^n + |(y - c)/r|^n <= 1.0
    """
    s_hi = size * scale
    c_hi = s_hi / 2.0
    r_hi = c_hi - (inset_px * scale)
    y_coords = np.arange(s_hi, dtype=np.float32) + 0.5
    x_coords = np.arange(s_hi, dtype=np.float32) + 0.5
    dy = np.abs(y_coords - c_hi) / r_hi
    dx = np.abs(x_coords - c_hi) / r_hi
    dist = (dy[:, None] ** exponent + dx[None, :] ** exponent)
    mask_hi = ((dist <= 1.0) * 255).astype(np.uint8)
    return Image.fromarray(mask_hi, mode='L').resize((size, size), Image.Resampling.BOX)

def make_inner_stroke(size, stroke_width_px=1.0, stroke_alpha=0.14, inset_px=0.0, scale=4, exponent=SQUIRCLE_EXPONENT):
    """
    Generates a 1px inner stroke matching the squircle boundary with opacity fading inward.
    """
    s_hi = size * scale
    c_hi = s_hi / 2.0
    r_outer = c_hi - (inset_px * scale)
    r_inner = r_outer - (stroke_width_px * scale)
    
    y_coords = np.arange(s_hi, dtype=np.float32) + 0.5
    x_coords = np.arange(s_hi, dtype=np.float32) + 0.5
    
    dy_out = np.abs(y_coords - c_hi) / r_outer
    dx_out = np.abs(x_coords - c_hi) / r_outer
    outer_hi = (dy_out[:, None] ** exponent + dx_out[None, :] ** exponent) <= 1.0
    
    dy_in = np.abs(y_coords - c_hi) / r_inner
    dx_in = np.abs(x_coords - c_hi) / r_inner
    inner_hi = (dy_in[:, None] ** exponent + dx_in[None, :] ** exponent) <= 1.0
    
    stroke_hi = (outer_hi.astype(np.float32) - inner_hi.astype(np.float32)) * stroke_alpha * 255.0
    stroke_mask = Image.fromarray(stroke_hi.astype(np.uint8), mode='L').resize((size, size), Image.Resampling.BOX)
    
    # RGBA black with stroke_mask as alpha
    stroke_arr = np.zeros((size, size, 4), dtype=np.uint8)
    stroke_arr[:, :, 3] = np.array(stroke_mask)
    return Image.fromarray(stroke_arr, mode='RGBA')

def apply_edge_stroke(image_rgba, stroke_width_px=1.0, stroke_alpha=0.14):
    """Applies the inner stroke to an RGBA image."""
    stroke = make_inner_stroke(image_rgba.width, stroke_width_px, stroke_alpha)
    return Image.alpha_composite(image_rgba, stroke)

def build_master_1024(original_path, master_path):
    """Phase 2: Extracts 1024x1024 transparent RGBA master."""
    orig = Image.open(original_path)
    crop = orig.crop(TILE_CROP_BOX)
    tile_1024 = crop.resize((1024, 1024), Image.Resampling.LANCZOS).convert('RGBA')
    
    mask = make_squircle_mask(1024, inset_px=INSET_SRC_PX)
    tile_1024.putalpha(mask)
    
    # Assert corner pixels are alpha 0 and center is 255
    alpha = np.array(tile_1024.getchannel('A'))
    corners = [int(alpha[0, 0]), int(alpha[0, -1]), int(alpha[-1, 0]), int(alpha[-1, -1])]
    center_alpha = int(alpha[512, 512])
    
    print(f"Asserting master alpha: corners={corners}, center={center_alpha}")
    assert all(c == 0 for c in corners), f"Corners must be 0, got {corners}"
    assert center_alpha == 255, f"Center must be 255, got {center_alpha}"
    
    tile_1024.save(master_path, format='PNG', optimize=True)
    print(f"Master 1024 saved to {master_path} ({os.path.getsize(master_path):,} bytes)")
    return tile_1024

def build_full_artwork_icon(master_1024, canvas_size, tile_size, stroke_alpha=0.14, unsharp=False):
    """Renders full artwork (tile + ladybug + brackets) centered with transparent margin."""
    tile = master_1024.resize((tile_size, tile_size), Image.Resampling.LANCZOS)
    if unsharp:
        # Light unsharp mask: radius 0.6, percent 40 (threshold 3)
        tile = tile.filter(ImageFilter.UnsharpMask(radius=0.6, percent=40, threshold=3))
    
    # Apply inner stroke to tile
    tile = apply_edge_stroke(tile, stroke_width_px=1.0, stroke_alpha=stroke_alpha)
    
    # Place on canvas
    canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    offset = (canvas_size - tile_size) // 2
    canvas.paste(tile, (offset, offset), tile)
    return canvas

def build_simplified_icon(master_1024, crop_1000, size, ladybug_width_ratio=0.72, stroke_alpha=0.16):
    """
    Renders simplified icon (16 or 32):
    - No corner brackets
    - Enlarged, contrast/saturation-boosted ladybug centered on frosted tile
    - 1px squircle inner stroke for edge contrast
    """
    # 1. Base tile texture from master without brackets
    tile = master_1024.resize((size, size), Image.Resampling.LANCZOS)
    
    # 2. Extract ladybug from crop_1000 (x: 270..730, y: 240..780)
    # The ladybug sits in the center with a clean frosted background
    ladybug_raw = crop_1000.crop((270, 240, 730, 780)).convert('RGBA')
    
    # Enhance saturation (1.25x) and contrast (1.20x) so dots, seam, and red shell pop at small sizes
    ladybug_enh = ImageEnhance.Color(ladybug_raw).enhance(1.25)
    ladybug_enh = ImageEnhance.Contrast(ladybug_enh).enhance(1.20)
    
    # Calculate target dimensions
    lb_target_w = int(round(size * ladybug_width_ratio))
    aspect = ladybug_raw.height / ladybug_raw.width
    lb_target_h = int(round(lb_target_w * aspect))
    
    # If height exceeds size - 2, scale to fit height
    if lb_target_h > size - 2:
        lb_target_h = size - 2
        lb_target_w = int(round(lb_target_h / aspect))
    
    ladybug_scaled = ladybug_enh.resize((lb_target_w, lb_target_h), Image.Resampling.LANCZOS)
    
    # 3. Create clean frosted tile base
    tile_mask = make_squircle_mask(size, inset_px=0.5)
    base_tile = Image.new('RGBA', (size, size), (248, 246, 246, 255))
    
    # Center ladybug on the tile
    pos_x = (size - lb_target_w) // 2
    pos_y = (size - lb_target_h) // 2
    base_tile.paste(ladybug_scaled, (pos_x, pos_y))
    base_tile.putalpha(tile_mask)
    
    # 4. Apply inner edge stroke
    icon = apply_edge_stroke(base_tile, stroke_width_px=1.0, stroke_alpha=stroke_alpha)
    return icon

def build_store_512(master_1024, out_path):
    """
    Renders 512x512 Chrome Web Store icon:
    ~432px tile centered in 512x512 canvas with a soft, elegant drop shadow.
    """
    tile_size = 432
    tile = master_1024.resize((tile_size, tile_size), Image.Resampling.LANCZOS)
    tile = apply_edge_stroke(tile, stroke_width_px=1.5, stroke_alpha=0.12)
    
    canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    
    # Soft drop shadow
    shadow_mask = make_squircle_mask(tile_size, inset_px=0.0)
    shadow_tile = Image.new('RGBA', (tile_size, tile_size), (0, 0, 0, 60))
    shadow_tile.putalpha(shadow_mask)
    
    shadow_canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    offset = (512 - tile_size) // 2
    shadow_canvas.paste(shadow_tile, (offset, offset + 8), shadow_tile)
    # Blur the shadow
    shadow_canvas = shadow_canvas.filter(ImageFilter.GaussianBlur(radius=12))
    
    # Composite shadow then tile
    canvas = Image.alpha_composite(canvas, shadow_canvas)
    canvas.paste(tile, (offset, offset), tile)
    
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    canvas.save(out_path, format='PNG', optimize=True)
    print(f"Store icon 512 saved to {out_path} ({os.path.getsize(out_path):,} bytes)")

def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    orig_path = os.path.join(repo_root, 'assets', 'icon-source', 'bugsnap-icon-master-original.png')
    master_path = os.path.join(repo_root, 'assets', 'icon-source', 'bugsnap-icon-master-1024.png')
    
    if not os.path.exists(orig_path):
        print(f"Error: Original artwork not found at {orig_path}")
        sys.exit(1)
        
    print("--- Phase 2: Building Master 1024 ---")
    master_1024 = build_master_1024(orig_path, master_path)
    crop_1000 = Image.open(orig_path).crop(TILE_CROP_BOX)
    
    print("\n--- Phase 3: Building Platform Icons ---")
    public_icons_dir = os.path.join(repo_root, 'public', 'icons')
    os.makedirs(public_icons_dir, exist_ok=True)
    
    # 1. 128px icon: ~12% transparent margin -> 112px tile in 128px canvas
    icon_128_path = os.path.join(public_icons_dir, 'icon-128.png')
    icon_128 = build_full_artwork_icon(master_1024, canvas_size=128, tile_size=112, stroke_alpha=0.14)
    icon_128.save(icon_128_path, format='PNG', optimize=True)
    
    # 2. 48px icon: ~4% transparent margin -> 44px tile in 48px canvas, light unsharp
    icon_48_path = os.path.join(public_icons_dir, 'icon-48.png')
    icon_48 = build_full_artwork_icon(master_1024, canvas_size=48, tile_size=44, stroke_alpha=0.15, unsharp=True)
    icon_48.save(icon_48_path, format='PNG', optimize=True)
    
    # 3. 32px icon: simplified variant without brackets, ladybug ~70% width
    icon_32_path = os.path.join(public_icons_dir, 'icon-32.png')
    icon_32 = build_simplified_icon(master_1024, crop_1000, size=32, ladybug_width_ratio=0.70, stroke_alpha=0.16)
    icon_32.save(icon_32_path, format='PNG', optimize=True)
    
    # 4. 16px icon: simplified variant without brackets, ladybug ~75% width
    icon_16_path = os.path.join(public_icons_dir, 'icon-16.png')
    icon_16 = build_simplified_icon(master_1024, crop_1000, size=16, ladybug_width_ratio=0.74, stroke_alpha=0.18)
    icon_16.save(icon_16_path, format='PNG', optimize=True)
    
    # 5. 512px store icon: assets/store/icon-512.png
    store_512_path = os.path.join(repo_root, 'assets', 'store', 'icon-512.png')
    build_store_512(master_1024, store_512_path)
    
    # 6. 2x Brand mark for UI (96x96): src/assets/brand/bugsnap-mark.png
    brand_dir = os.path.join(repo_root, 'src', 'assets', 'brand')
    os.makedirs(brand_dir, exist_ok=True)
    brand_mark_path = os.path.join(brand_dir, 'bugsnap-mark.png')
    brand_mark = master_1024.resize((96, 96), Image.Resampling.LANCZOS)
    brand_mark = apply_edge_stroke(brand_mark, stroke_width_px=1.0, stroke_alpha=0.14)
    brand_mark.save(brand_mark_path, format='PNG', optimize=True)
    print(f"Brand mark 96 saved to {brand_mark_path} ({os.path.getsize(brand_mark_path):,} bytes)")
    
    # Report byte sizes and budget checks
    shipped_files = [
        ('icon-16.png', icon_16_path),
        ('icon-32.png', icon_32_path),
        ('icon-48.png', icon_48_path),
        ('icon-128.png', icon_128_path),
    ]
    
    print("\n--- Shipped Icon Sizes & Budget Verification ---")
    total_bytes = 0
    all_under_60k = True
    for name, path in shipped_files:
        sz = os.path.getsize(path)
        total_bytes += sz
        under_60 = sz < 60 * 1024
        all_under_60k = all_under_60k and under_60
        print(f"  {name:12s}: {sz:>6,} bytes (under 60 KB: {under_60})")
    
    print(f"Total shipped icons size: {total_bytes:,} bytes ({total_bytes/1024:.1f} KB)")
    print(f"Budget (< 150 KB total): {total_bytes < 150 * 1024}")
    assert all_under_60k, "All shipped icons must be under 60 KB"
    assert total_bytes < 150 * 1024, "Total shipped icon size must be under 150 KB"

if __name__ == '__main__':
    main()
