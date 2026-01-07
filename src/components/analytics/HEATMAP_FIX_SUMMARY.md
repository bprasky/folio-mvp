# Room×Phase Heatmap — Bug Fixes

## Issues Fixed

### 1. **Falsy 0 → Hidden** ✅
**Problem**: `{c.ratePct && <span>...</span>}` hides 0% because 0 is falsy
**Fix**: Explicit rendering with null coalescence
```typescript
const rate = c.ratePct != null ? safeInt(c.ratePct) : computeRate(saves, tags);
// Then ALWAYS render:
<div>{rate}%</div>  // Shows "0%" instead of hiding
```

### 2. **NaN or Undefined Rate** ✅
**Problem**: Missing `ratePct` causes `undefined` to render (nothing shows)
**Fix**: Compute rate when missing
```typescript
function computeRate(saves: number, tags: number) {
  if (saves <= 0) return 0;
  const r = Math.round((tags / saves) * 100);
  return Number.isFinite(r) ? r : 0;
}

function safeInt(n: any, fallback = 0) {
  return Number.isFinite(n) ? (n as number) : fallback;
}
```

### 3. **Absolute Children Clipped** ✅
**Problem**: `overflow-hidden` + rounded corners clip asset gap badges
**Fix**: 
- Added `bg-white` to cell for clean backdrop
- Added `px-2` horizontal padding to prevent edge clipping
- Removed `overflow-hidden` from cell container
- Asset gap badges use `absolute top-1 right-1` with enough padding

### 4. **Z-index / Opacity Issues** ✅
**Problem**: `opacity-0 group-hover:opacity-100` leaves labels invisible
**Fix**: 
- Removed ALL conditional opacity
- "saves → tags" sublabel ALWAYS visible with `text-[11px] text-[#6B7280]`
- No hover-dependent visibility

## Implementation Details

### Cell Structure
```typescript
<div className="relative flex flex-col items-center justify-center
     h-20 rounded-lg border-2 bg-white px-2 text-center">
  
  {/* % value — NEVER hide 0 */}
  <div className="num text-[18px] font-bold text-[#111827]">
    {rate}%  {/* Even 0 renders */}
  </div>

  {/* Subline: saves → tags (always visible) */}
  <div className="mt-1 text-[11px] text-[#6B7280] whitespace-nowrap">
    {saves} → {tags}
  </div>

  {/* Asset gap (optional) */}
  {c.assetGap && (
    <div className="absolute top-1 right-1 ...">
      {c.assetGap}
    </div>
  )}
</div>
```

### Data Handling
```typescript
const cellData = data.find(x => x.room === r && x.phase === p);
const c: Cell = cellData 
  ? { /* map existing data */ }
  : { /* zero-state fallback */ room: r, phase: p, saves: 0, tags: 0, ratePct: 0 };

return <CellBox c={c} />;  // ALWAYS renders something
```

### Tooltip (Native)
Uses HTML `title` attribute with multi-line format:
```
Kitchen · FF&E
214 saves → 176 tags
Rate 82% (+37 pts vs cohort)
Asset gap: none
```

## Test Cases Covered

✅ **0% cell** (no saves/tags): Shows "0%" and "0 → 0"
✅ **Computed rate** (saves/tags provided, ratePct null): Calculates 50% from 36→18
✅ **Fully provided** (all fields): Shows exact data
✅ **Asset gap present**: Badge visible in top-right
✅ **Negative delta**: Shows "-6 pts" correctly

## Color Contrast
- **Dark text on light backgrounds**: `text-[#111827]` for rates
- **Never white on white**: All backgrounds use `/10` opacity variants
- **Hover states**: Scale + shadow, no color inversion

## Grid Layout
```typescript
grid-cols-[120px_repeat(4,minmax(0,1fr))]
```
- Fixed 120px for room labels
- Equal flex columns for phases
- Gap-3 for breathing room
- No overflow clipping

## Result
**Every single cell now shows:**
1. ✅ Percentage value (0-100%)
2. ✅ "X → Y" sublabel
3. ✅ Proper color coding
4. ✅ Asset gap badge (if present)
5. ✅ Full tooltip on hover

**No more blank cells!**









