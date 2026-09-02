# Image Transformation Reduction Plan

Date: 2026-09-02

Goal: reduce Vercel Image Transformation usage while keeping the website experience visually and behaviorally the same.

Related audit: `IMAGE_TRANSFORMATION_REPORT.md`

## Non-negotiable user experience contract

The public website must look and feel the same after these changes.

Allowed tradeoff:

- Images may be slightly less sharp or slightly more compressed if the site still looks professional.

Not allowed:

- No layout changes.
- No section removals.
- No visible image count reductions on public pages.
- No animation timing changes.
- No carousel behavior changes that users can feel.
- No gallery motion changes that users can feel.
- No navigation, filtering, pagination, checkout, cart, or admin workflow regressions.
- No blank image flashes during carousel or gallery transitions.
- No layout shift caused by replacing `next/image` with plain `img`.

Every reduction should come from invisible implementation changes, lower image quality/variant count, caching policy, asset format conversion, or bypassing optimization for assets where optimization gives no real user benefit.

## Guiding principles

- Keep `next/image` for important public photos where it protects performance: hero, trip, destination, gallery, and blog photos.
- Use lower image quality settings where acceptable instead of changing UI composition.
- Bypass optimization for SVGs, GIFs, tiny decorative images, and admin-only thumbnails/previews.
- Keep exact dimensions, CSS classes, object-fit behavior, rounded corners, and animation wrappers when changing image rendering.
- Make changes in small deployable steps and verify both Vercel usage and visual parity after each step.

References:

- <https://vercel.com/docs/image-optimization>
- <https://vercel.com/docs/pricing/manage-and-optimize-usage#image-optimization>
- <https://nextjs.org/docs/pages/api-reference/components/image>

## Success metrics

Track these in Vercel before and after each deployed phase:

- Image Transformations per day.
- Image Cache Reads per day.
- Top transformed source URLs.
- Number of widths/formats generated per top source URL.
- Home page Lighthouse image-related warnings.
- Largest Contentful Paint on home, trips, and gallery pages.

Target outcome:

- Reduce avoidable transformations by 30-50% on common browsing paths.
- Preserve the same public UI, animation, layout, and interaction behavior.
- Accept only mild image quality reduction where it lowers transformation variants or bandwidth.
- Keep LCP the same or better.

## Phase 0 - Baseline usage and visual snapshots

Before changing code, collect a Vercel usage baseline and visual baseline.

Tasks:

1. Open Vercel project usage/observability for Image Optimization.
2. Export or screenshot the top 20 image URLs by transformation count.
3. Group them by source:
   - `/Hero/*`
   - `/images/Gallery/*`
   - `/images/Trips/*`
   - `/images/Destinations/*`
   - `/images/TripTypes/*`
   - admin paths
4. Note which widths appear most often for the same source.
5. Record 7-day totals for Image Transformations and Image Cache Reads.
6. Capture before screenshots or short recordings for:
   - Home desktop.
   - Home mobile.
   - Hero carousel after at least one slide transition.
   - Home gallery desktop while scrolling animation is active.
   - Gallery page and lightbox.
   - Trips listing.
   - Trip detail.
   - Blog listing/detail.
   - Admin list/edit pages that show image previews.

No user-facing impact.

Exit criteria:

- Baseline usage is documented.
- Visual references exist so later phases can be checked for exact layout and animation parity.

## Phase 1 - No-visible-change optimization policy

This should be the safest first code pass because it does not change layout, animations, section structure, or public interactions.

### 1. Constrain image quality variants

Preferred change:

- Add `qualities: [70]` to `next.config.ts`.
- Keep all existing components, dimensions, animation wrappers, and `sizes` props unchanged in this step.

Example:

```ts
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "sunnytour.premiumasp.net",
      pathname: "/images/**",
    },
  ],
  qualities: [70],
},
```

Expected user impact:

- Same layout, same animation, same image count, same behavior.
- Images may be slightly more compressed, which is the allowed exception.

Validation:

- Compare screenshots for home hero, trip cards, gallery cards, lightbox, blog images, and destination cards.
- If images look noticeably poor, try `qualities: [75]` instead.

### 2. Replace or mark SVG images as unoptimized

Candidates:

- `src/features/blogs/components/blogs-section.tsx` uses `/Blogs/plane.svg`.
- `src/features/explore/components/explore-section.tsx` uses `/ExploreSection/plane.svg` twice.

Preferred change:

- Use plain `<img>` for SVG decorations, or keep `<Image unoptimized />`.

Expected user impact:

- No visual change.
- Fewer unnecessary optimization requests.

### 3. Avoid optimizing GIFs

Candidate:

- `app/[locale]/(site)/checkout/success/page.tsx` uses `/succes.gif`.

Preferred change:

- Use plain `<img>` or `<Image unoptimized />`.

Expected user impact:

- No visual change.
- GIFs are not a good target for Vercel image optimization.

### 4. Avoid optimization for tiny decorative PNGs

Candidates:

- `public/HowItWorks/*.png`, each about 4-6 KB.
- `public/AboutUs/temp.png`, `camel.png`, `vist.png`, each only a few KB.

Preferred change:

- Use plain `<img>` or `<Image unoptimized />` where these are rendered.

Expected user impact:

- No visual change.
- Small direct downloads are cheaper than creating optimized variants.

### 5. Consider logo bypass

Candidates:

- `src/features/layout/header/header.tsx`
- `src/features/layout/footer/footer.tsx`
- `src/features/admin/layout/admin-shell.tsx`
- `src/features/admin/auth/components/auth-card.tsx`

Preferred change:

- Keep dimensions fixed.
- Use plain `<img>` for `/Logo.png`, or `<Image unoptimized />`.

Expected user impact:

- No visual change.
- Slightly less optimization usage. The logo is about 85 KB, so this is lower priority than SVG/GIF/tiny PNG cleanup.

Validation:

- Run `bun run lint`.
- Run `bun run build`.
- Check header/footer/admin logo display on desktop and mobile.
- Confirm no layout shift from replacing `<Image>`.

## Phase 2 - Reduce home hero transformations without changing appearance

Current issue:

- `HeroSection` mounts all 3 full-screen background slides at once.
- Hidden slides use opacity but still exist in the DOM.
- Current source sizes are large PNGs:
  - `/Hero/boat.png`: about 7.06 MB
  - `/Hero/prim.png`: about 4.10 MB
  - `/Hero/sunset.png`: about 2.88 MB

Preferred change:

1. Keep the same slide interval.
2. Keep the same fade duration and easing.
3. Keep the same text animation.
4. Keep the same destination card behavior.
5. Render only the active slide plus the outgoing slide during the fade.
6. Keep `priority` only for the first active slide.
7. Preload the next slide before transition using idle-time preload or a hidden preload link.
8. Keep the same overlays, object positioning, and full-screen crop.

Not allowed:

- No jump cuts.
- No changed slide order.
- No changed slide interval.
- No changed animation timing.
- No blank frame while an image loads.
- No visible overlay/crop change.

Optional asset change:

- Convert the 3 hero PNGs to WebP or AVIF at production dimensions.
- Keep visual backups until QA confirms quality.

Expected user impact:

- Same visible hero design and animation.
- Images may be slightly more compressed if Phase 1 quality settings are active.

Expected transformation impact:

- Fewer first-load hero transformations.
- Less work caused by large local PNGs across viewport widths.

Validation:

- Home page desktop, tablet, and mobile screenshots.
- Record or watch at least 2 slide transitions before and after.
- Test on a throttled network.
- Verify carousel transitions do not flash blank.
- Check LCP does not regress.
- Check transformed source URLs in Vercel after deploy.

## Phase 3 - Rework home gallery rendering

Current issue:

- Live API currently returns 28 gallery images.
- Home mobile renders 6 gallery images.
- Home desktop renders 26 gallery image elements because both scrolling columns duplicate their image lists.
- With current data, desktop represents about 14 unique image sources in that section.

Preferred change:

1. Keep the same 3-column desktop layout.
2. Keep the same mobile layout.
3. Keep the same visible image density.
4. Keep the same scroll speed and direction.
5. Keep the same section height.
6. Keep the same click-to-lightbox behavior.
7. Add more exact `sizes` values that match the real rendered column widths.
8. Reduce duplicated optimized requests only if the visual result is identical.

Candidate implementation options:

- Option A: keep the duplicate DOM structure but rely on Phase 1/Phase 4 quality and width constraints.
- Option B: keep the visible duplicate loop, but use `unoptimized` only for the duplicated second copy of each scrolling column.
- Option C: keep the same visible loop, but render duplicated loop copies as CSS background layers with the same dimensions and positioning.

Recommended first attempt:

- Option A first because it has the lowest visual risk.
- If Vercel still shows `/images/Gallery/*` as a top transformation driver, try Option B.

Not allowed:

- Do not reduce visible gallery density.
- Do not remove infinite scrolling.
- Do not change animation duration.
- Do not change lightbox behavior.
- Do not change the section's visual balance.

Expected user impact:

- Same gallery appearance and motion.
- Images may be slightly more compressed if Phase 1 quality settings are active.

Expected transformation impact:

- High. This is one of the main visible sources of remote image volume on the home page.

Validation:

- Home page screenshot at desktop and mobile widths.
- Compare a short screen recording of the scrolling columns.
- Confirm gallery still appears full, balanced, and clickable.
- Open lightbox from home gallery.
- Compare Vercel top transformed URLs for `/images/Gallery/*`.

## Phase 4 - Add a tighter Next image sizing policy

Current issue:

- `next.config.ts` only defines `remotePatterns`.
- It does not define `deviceSizes`, `imageSizes`, `qualities`, or `minimumCacheTTL`.
- The app therefore relies on broad framework defaults.

Preferred change:

Add a conservative image config based on current layouts. The widths must still cover full-width hero images and large lightbox images.

Example starting point:

```ts
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "sunnytour.premiumasp.net",
      pathname: "/images/**",
    },
  ],
  deviceSizes: [640, 750, 828, 1080, 1200, 1440],
  imageSizes: [32, 48, 64, 96, 128, 256, 384],
  qualities: [70],
  minimumCacheTTL: 60 * 60 * 24 * 30,
},
```

Important caution:

- Do not make `deviceSizes` too narrow before checking all large layouts.
- Add widths back immediately if any public photo looks noticeably soft.
- If the backend can replace an image while keeping the same URL, a long `minimumCacheTTL` can keep stale optimized images around. The current API image URLs look content-hashed, so a longer TTL is probably safe, but confirm with the backend.

Expected user impact:

- Same layout and animation.
- Possible mild quality or sharpness reduction, which is acceptable only if the site still looks professional.

Expected transformation impact:

- Moderate. This reduces the number of width variants Vercel can generate over time.

Validation:

- `bun run build`
- Check image sharpness on:
  - Home hero
  - Home gallery
  - Trips listing
  - Trip detail
  - Gallery lightbox
  - Blog detail
- Confirm no Next config warnings.
- Confirm screenshots show no layout, crop, or animation differences.

## Phase 5 - Convert/compress large local images without changing display

Purpose: reduce image weight and optimization work while keeping exact layout, crop, and animation behavior.

Candidates:

- `/Hero/boat.png`
- `/Hero/prim.png`
- `/Hero/sunset.png`
- `/Blogs/blogsHero.png`
- `/Trips/HeroTrips.png`
- `/ExploreSection/imageExplore.png`

Preferred change:

1. Generate WebP versions at the same practical display dimensions.
2. Keep the same aspect ratios and crop intent.
3. Update only the image `src` paths.
4. Do not change CSS classes, wrappers, dimensions, object-fit, object-position, animation timing, or overlays.
5. Keep original PNG files until QA confirms the replacements.

Expected user impact:

- Same layout and animation.
- Images may be slightly more compressed, which is the allowed exception.

Expected transformation impact:

- Mostly reduces bandwidth and transformation workload.
- Count reduction may be limited unless combined with Phases 1 and 4.

Validation:

- Before/after screenshots for every affected route.
- Check for color banding, obvious compression blocks, crop changes, and text/overlay readability.
- Check LCP.

## Phase 6 - Use server/API pagination where lists are large

Current issue:

- Trips listing fetches `pageSize: 50`, then slices to 9 visible cards client-side.
- Blogs listing fetches `pageSize: 50`, then renders every filtered result.

Preferred change:

1. Trips page:
   - Request the current page from the API with `PageNumber=currentPage` and the same visible page size.
   - Use the API's total count/page metadata if available.
   - If no total count exists, request one extra item to infer whether a next page exists.
2. Blogs page:
   - Keep the same visible result behavior.
   - Make "See More" fetch the next API page only if the visible behavior remains the same.

Not allowed:

- No visible card count changes.
- No filter behavior changes.
- No search behavior changes.
- No card ordering changes.
- No pagination UI changes.

Expected user impact:

- No visual change.
- Faster API payloads.
- Fewer image URLs introduced to the browser at once.

Expected transformation impact:

- Low to moderate today.
- More important as trips/blogs grow.

Validation:

- Filters still reset pagination correctly.
- Search still works as expected.
- Pagination URLs/behavior remain acceptable.
- No duplicate or missing cards between pages.

## Phase 7 - Admin image policy

Current issue:

- Admin pages preview stored remote images with `next/image`.
- Some upload draft previews already use `unoptimized`, but stored previews generally do not.

Preferred change:

- For admin tables, small previews, and edit forms, use `<Image unoptimized />` or plain `<img>`.
- Keep optimization only for admin views where a large image is intentionally inspected.

Expected user impact:

- No impact on public website visitors.
- Admin previews still load normally.

Expected transformation impact:

- Depends on admin usage. Can be meaningful if admins browse many image-heavy records.

Validation:

- Admin login.
- Trips, destinations, gallery, and blogs list pages.
- Create/edit forms with existing image previews.
- Upload draft previews.

## Deployment order

Recommended order:

1. Phase 0 baseline usage and visual snapshots.
2. Phase 1 no-visible-change optimization policy.
3. Deploy and observe for 24-48 hours.
4. Phase 2 home hero.
5. Deploy and observe for 24-48 hours.
6. Phase 3 home gallery.
7. Deploy and observe for 24-48 hours.
8. Phase 4 image sizing config.
9. Deploy and observe for 24-48 hours.
10. Phase 5 large local image conversion/compression.
11. Phase 6 pagination/data loading.
12. Phase 7 admin image policy.

This order starts with changes that should not alter the UI at all, then moves to implementation changes that require careful visual parity checks.

## QA checklist for every code phase

Run:

- `bun run lint`
- `bun run build`

Public visual checks:

- Home desktop and mobile.
- Header and footer.
- Hero carousel through multiple transitions.
- Category slider.
- Tours carousel/cards.
- Popular destinations.
- Home gallery scrolling columns.
- Gallery page and lightbox.
- Trips listing and trip detail.
- Blog listing and detail.
- Checkout success page.

Interaction checks:

- Locale switcher.
- Header menus.
- Hero slide controls and destination cards.
- Trips filters.
- Trips pagination.
- Add to cart flow.
- Gallery lightbox next/previous/close/zoom.

Failure criteria:

- Any layout difference beyond image compression.
- Any changed animation timing or motion path.
- Any blank image flash.
- Any broken crop/object positioning.
- Any visible missing image.
- Any behavior regression.

If any failure appears, roll back that phase.

## Rollback plan

For each phase:

- Keep the change isolated in its own commit or PR.
- If layout, animations, or interactions change, revert only that phase.
- If images look unacceptably soft, raise quality or revert the image/config change.
- If transformation usage does not improve after a phase, keep the change only if it improves bandwidth or maintainability without violating the user experience contract.

## Definition of done

The plan is complete when:

- Vercel usage shows a sustained drop in Image Transformations for at least 7 days.
- Public routes keep the same layout, animations, and interactions on mobile and desktop.
- The only accepted visual difference is mild image compression or slightly reduced sharpness.
- LCP does not regress on the home page.
- The top transformed URLs no longer include low-value SVG/GIF/icon/small decorative assets.
- The remaining transformations mostly come from real user-facing photos: trip, destination, gallery, blog, and large hero images.
