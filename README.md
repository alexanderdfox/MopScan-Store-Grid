# MopScan Store Grid

A paint-style, grid-based floor safety planner for Walmart + Sam's Club environments. Build a store layout, label aisles and shelving, and track cleaned vs wet zones without using a camera. Includes pinch-zoom, pan, mini-map navigation, and export/import of layouts.

## Features

- **Store layout grid** with tile types: floor, shelf, entry, checkout, blocked
- **Clean status tracking**: cleaned, wet, unknown
- **Paint tools**: brush, paint fill bucket, rectangle fill, lasso fill
- **Smooth drawing** with brush radius + line interpolation
- **Pan & zoom** (mouse wheel, pinch, Shift/Alt/right-drag, or Pan tool)
- **Mini-map** navigator with viewport box and click-to-jump
- **Presets** for common store formats
- **Export/Import JSON** to share layouts
- **Local storage** to save a layout per device

## Quick Start

```bash
cd /Users/alexanderfox/Documents/Frosty/MopFloor
python3 -m http.server 8080
```

Open:

```
http://localhost:8080
```

## How to Use

1. Set **Grid Columns/Rows** to match your store footprint.
2. Use **Tile** mode to paint shelves, entries, checkout zones, and blocked areas.
3. Switch to **Status** mode and mark cleaned/wet areas.
4. Use **Pan / Move** (toolbar) or pinch-to-zoom to navigate large layouts.
5. Export JSON to share a layout with another device/store.

## Tools & Shortcuts

- **Brush size**: toolbar slider
- **Paint tools**: Brush, Fill, Rect, Lasso
- **Pan**: Pan tool, right-drag, Shift/Alt-drag, or Spacebar
- **Zoom**: mouse wheel or pinch

## Project Files

- `index.html`
- `styles.css`
- `script.js`

## Notes

- Layouts are stored in `localStorage` only.
- No camera required.
- Designed for rapid in-field updates by floor staff.
