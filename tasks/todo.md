# Product Bank — Three-dot Menu, Crop Adjuster, Shop Tab Integration

## Phase 3C: Three-dot Menu on ProductBank Cards

- [ ] Add `isOwner` prop to ProductBank (thread from ImmersiveProjectPage → page.tsx)
- [ ] Add three-dot (ellipsis) icon button to ProductCard overlay (top-right, owner-only)
- [ ] Build dropdown menu with options: "Adjust crop", "View product page" (external link)
- [ ] Wire menu state (open/close), close on outside click

## Phase 3D: Crop Adjuster UI

- [ ] Create `CropAdjusterModal` component — modal overlay with:
  - Full source image displayed with current crop region highlighted
  - Drag to pan crop center (cropX, cropY)
  - Slider or pinch to zoom (cropScale, 0.15–1.0)
  - Live preview of resulting crop (1:1 square)
  - "Reset" button (returns to category default)
  - "Save" button → calls `POST /api/products/tags/{tagId}/crop`
- [ ] Wire CropAdjusterModal into three-dot menu "Adjust crop" action
- [ ] Pass tagId + source image URL + current crop params to modal
- [ ] On save success: update local state optimistically, then router.refresh()

## Phase 4: Shop Tab Integration

- [ ] Update ShopFeed to display contextual crops instead of catalog images
- [ ] Fetch crop data for products in the designer profile page query
- [ ] Update ProfileProduct type to include cropUrl
- [ ] Update profile ProductCard to render crop when available, fall back to catalog image

## Verification

- [ ] Three-dot menu only shows for project owners
- [ ] Crop adjuster saves and regenerates crop correctly
- [ ] Shop tab shows crops where available
- [ ] No regressions on public/visitor view of ProductBank
