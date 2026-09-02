# Vercel Image Transformation Usage Report

Date: 2026-09-02

## Executive summary

The high Vercel Image Transformation usage is mostly caused by normal `next/image` behavior, not by a custom transformation endpoint in this app.

This repo uses `next/image` in 35 files with 58 `<Image>` component occurrences. On Vercel, every optimized `next/image` request is served through `/_next/image?url=...&w=...&q=...`. A cache miss for one unique source URL, width, quality, and accepted output format is billed as an Image Transformation. Later requests can become Image Cache Reads instead.

There are also a few code patterns that likely amplify the count:

- The home hero mounts all 3 full-screen slide images at once, even when 2 are invisible.
- The home gallery renders many remote gallery images, including duplicated infinite-scroll columns.
- Listing pages fetch and/or render large batches of API images.
- Admin pages also use optimized `<Image>` previews for remote stored images.
- Several local PNG hero images are very large, so Vercel has good reason to transform them, although source size affects transformation cost/work more than the count.

## What Vercel is counting

According to Vercel's Image Optimization documentation:

- A framework `Image` component, including Next.js `next/image`, uses Vercel's image optimization pipeline.
- If optimization is enabled and the optimized image is not cached, Vercel fetches, transforms, caches, and serves it. That cache miss is billed as an Image Transformation and an Image Cache Write.
- Vercel's cache key includes the source URL, requested width, quality, and normalized `Accept` header.
- Next.js replaces image sources with URLs like `/_next/image?url={source}&w={width}&q={quality}`.

References:

- <https://vercel.com/docs/image-optimization>
- <https://vercel.com/docs/pricing/manage-and-optimize-usage#image-optimization>
- <https://nextjs.org/docs/pages/api-reference/components/image>

## Local code findings

### 1. Remote API images are explicitly enabled for optimization

`next.config.ts` allows remote images from the backend:

```ts
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "sunnytour.premiumasp.net",
      pathname: "/images/**",
    },
  ],
},
```

The shared API helper converts relative API image paths into full backend URLs:

```ts
export const API_BASE_URL = "https://sunnytour.premiumasp.net/";

export function getImageUrl(imageUrl: string | null | undefined) {
  ...
  return getApiUrl(imageUrl);
}
```

This means images from trips, trip types, destinations, gallery, and blogs are eligible for Vercel optimization.

Relevant files:

- `next.config.ts`
- `src/shared/config/api.ts`
- `src/features/tours/api/get-trips.ts`
- `src/features/tours/api/get-trip.ts`
- `src/features/gallery/api/get-gallery-images.ts`
- `src/features/categories/api/get-trip-types.ts`
- `src/features/categories/api/get-destinations.ts`
- `src/features/destinations/api/get-popular-destinations.ts`
- `src/features/blogs/api/get-blogs.ts`

### 2. Home hero mounts every slide image at once

`src/features/hero/components/hero-section.tsx` maps all `heroSlides` and renders every background image into the DOM. Only opacity changes:

```tsx
{heroSlides.map((slide, i) => (
  <div style={{ opacity: i === slideIndex ? 1 : 0 }}>
    <Image
      src={slide.image}
      fill
      priority={i === 0}
      sizes="100vw"
    />
  </div>
))}
```

Current local hero sources:

- `/Hero/boat.png` - about 7.06 MB
- `/Hero/sunset.png` - about 2.88 MB
- `/Hero/prim.png` - about 4.10 MB

Because all three images are mounted in the first viewport, the browser can request optimized variants for all of them during/near initial page load. Across mobile, tablet, desktop, DPR, and browser format differences, those same 3 sources can become multiple transformed variants.

Assessment: likely code-level amplifier. The carousel can probably render only the active image plus a controlled preload for the next image.

### 3. Home gallery renders many remote images and duplicates columns

`src/features/gallery/components/home-gallery-section.tsx` currently:

- Fetches all gallery images.
- Uses the first 6 images on mobile.
- On desktop, renders 2 middle images plus left/right columns.
- Builds each left/right column with 6 images and duplicates each column for infinite scrolling.

Important code:

```tsx
const leftBase = buildColumn(rawLeft, COL_SIZE);
const rightBase = buildColumn(rawRight, COL_SIZE);
...
<ScrollColumn items={leftBase} direction="up" />
...
<ScrollColumn items={rightBase} direction="down" />
```

Inside each `ScrollColumn`, the same list is rendered twice:

```tsx
{items.map(... <Image src={img.imageUrl} sizes="33vw" />)}
...
{items.map(... <Image src={img.imageUrl} sizes="33vw" />)}
```

Live API snapshot on 2026-09-02:

- `/api/Gallery/GetAllImages`: 28 images, 28 unique image URLs.
- Home mobile renders 6 of those.
- Home desktop renders 26 image elements in the gallery section, representing about 14 unique sources with the current algorithm.

Assessment: likely code-level amplifier. Even if duplicate elements share browser cache, this section asks Vercel for many remote image variants and keeps introducing more variants across viewport widths and browser formats.

### 4. Trips pages expose many unique remote trip images

Live API snapshot on 2026-09-02:

- `/api/Trips?PageSize=50&PageNumber=1`: 45 trips, 136 unique trip image URLs.
- A 6-trip home fetch for `TypeId=4` returned 20 trip image records.

The home tours section fetches 6 trips:

```tsx
useTripsQuery({
  typeId: selectedTypeId || undefined,
  pageSize: 6,
});
```

Each rendered tour card uses the primary/fallback image through `next/image`:

```tsx
<Image
  src={primaryImage.imageUrl}
  fill
  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
/>
```

The trips listing page fetches `pageSize: 50`, then paginates client-side to 9 visible cards:

```tsx
useTripsQuery({ ..., pageSize: 50 });
const paginatedTrips = trips.slice((currentPage - 1) * 9, currentPage * 9);
```

Assessment: moderate issue. The list only renders 9 cards at a time, but fetching 50 trips pulls metadata for many image URLs to the browser. If pagination is meant to be server-driven, use API pagination instead of client-side slicing.

### 5. Trip detail pages can request up to 5 optimized images immediately

`src/features/tours/components/single/trip-gallery.tsx` renders:

- Primary image with `priority`.
- Up to 4 thumbnails.

```tsx
const displayedThumbnails = otherImages.slice(0, 4);
...
<Image src={primaryImage.imageUrl} priority sizes="(max-width: 1024px) 100vw, 66vw" />
...
<Image src={img.imageUrl} sizes="(max-width: 1024px) 50vw, 33vw" />
```

Assessment: mostly expected for a media-heavy trip detail page. It does multiply unique transformations for every visited trip.

### 6. Gallery page and lightbox can add more variants

The gallery page starts with 8 visible images:

```tsx
const [visibleCount, setVisibleCount] = useState(8);
const visibleImages = images.slice(0, visibleCount);
```

Each card uses:

```tsx
<Image
  src={image.imageUrl}
  fill
  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
/>
```

The lightbox uses the same source with a much larger display size and no explicit `sizes` prop:

```tsx
<Image
  src={image.imageUrl}
  fill
  className="select-none object-contain"
  priority
/>
```

Assessment: expected, but the lightbox can cause an additional larger-width transformation for an image that already had a small thumbnail transformation.

### 7. Blogs page renders every fetched blog card

`src/features/blogs/components/blogs-grid.tsx` fetches up to 50 blogs and renders every filtered blog:

```tsx
const { data: blogs } = useGetBlogsQuery({ pageSize: 50 });
...
filteredBlogs?.map((blog) => <BlogCard blog={blog} />)
```

Current live API snapshot has only 2 blogs and 2 image URLs, so this is not a present-day driver. It can become a driver if the blog count grows.

### 8. Small assets should probably not use Image Optimization

Vercel recommends avoiding Image Optimization for small icons/thumbnails, SVGs, GIFs, and frequently changing images. This app already uses plain `<img>` for remote flag SVGs, which bypasses optimization.

Potential candidates to mark `unoptimized` or replace with plain `<img>`:

- `/Logo.png` in the public header and admin shell. Current file size is about 85 KB.
- Very small decorative PNGs under `public/HowItWorks`.
- SVG decorations currently rendered through `<Image>` in some places, although SVGs generally do not need optimization.
- Admin-only previews where performance is less important than reducing usage.

The app already uses `unoptimized` for some newly selected admin upload previews, but most stored admin images remain optimized.

## Route-level usage estimate

These estimates count image elements/sources the code can render. Vercel transformations can be higher because one source can be transformed for multiple widths, qualities, and output formats over time.

| Route or area | Current image pressure | Why |
| --- | ---: | --- |
| Home page | High | Hero renders 3 full-screen local images; categories render 9 remote images; tours render 6 remote images; popular destinations render 3 remote images; home gallery desktop renders 26 image elements; blogs render 3 or fewer; explore renders a large local background. |
| Gallery page | Medium to high | Fetches 28 gallery images, initially renders 8, then +6 per "See More"; lightbox can request larger variants. |
| Trips listing | Medium | Fetches 50 trips and renders 9 cards per client-side page; current API has 45 unique list-card images and 136 total trip images. |
| Trip detail | Medium per visit | Renders one primary image plus up to four thumbnails above the fold. |
| Blog listing/detail | Low today | Current API has 2 blogs/images, but page is coded to render up to 50 cards. |
| Admin | Variable | Admin tables/forms preview stored images with `next/image`; upload draft previews are sometimes `unoptimized`. |

## Is this a code issue?

Partly.

Expected behavior:

- Using `next/image` on Vercel will create image transformations by design.
- A tourism website is image-heavy, so non-zero Image Optimization usage is normal.
- Responsive `sizes` are generally good for performance, even though they create different cached variants across devices.

Likely code issues or avoidable amplifiers:

- The home hero mounts all slide images immediately instead of just the active slide.
- The home gallery duplicates many image elements to create the infinite scroll effect.
- Some small/static assets use `next/image` even though optimization is unlikely to help.
- Some list pages fetch large batches and do client-side pagination.
- The image config does not constrain `deviceSizes`, `imageSizes`, or `minimumCacheTTL`, so the app uses broad framework defaults.

## Recommended fixes, in priority order

1. Optimize the home hero carousel.
   - Render only the active slide initially.
   - Optionally preload the next slide after first interaction or after idle time.
   - Convert large local PNG hero files to WebP/AVIF at appropriate dimensions.

2. Rework the home gallery.
   - Reduce the number of rendered gallery images in the first view.
   - Avoid duplicate `<Image>` trees for the infinite-scroll illusion when possible.
   - Consider using CSS/background duplication with already optimized static assets, or use a smaller curated featured-gallery endpoint.

3. Add explicit image sizing policy in `next.config.ts`.
   - Define narrower `deviceSizes` and `imageSizes` based on the actual layout widths.
   - Keep `qualities` constrained to `[75]` or another single value.
   - Consider increasing `minimumCacheTTL` if backend image URLs are content-hashed and rarely change.

4. Mark low-value assets as `unoptimized`.
   - SVGs, small decorative PNGs, GIFs, and admin-only previews are good candidates.
   - Be careful with the very large local PNGs: disabling optimization without converting them first would likely hurt bandwidth and performance.

5. Move client-side pagination to API pagination where possible.
   - Trips listing can request the current page instead of fetching 50 records.
   - Blog listing can render a real visible page size instead of all matching results.

6. Use Vercel Observability/Image Optimization views to confirm.
   - Sort by highest transformation count.
   - Check whether the top sources are `/Hero/*`, `/images/Gallery/*`, `/images/Trips/*`, or admin URLs.
   - Compare widths and formats for the same source. Many widths per source confirms responsive variant multiplication.

## Suggested next implementation pass

The most likely first fixes are:

- Change `HeroSection` so only the active background image renders, with a deliberate preload strategy.
- Change `HomeGallerySection` to render fewer initial images and avoid duplicate `<Image>` components where possible.
- Add a conservative `images` config for widths, qualities, and cache TTL.
- Add `unoptimized` or plain `<img>` for SVG/small/decorative/admin-only images.

These changes should reduce transformation volume without removing the performance benefit of optimized trip, destination, and gallery photos.


https://vercel.com/docs/image-optimization
https://vercel.com/docs/pricing/manage-and-optimize-usage#image-optimization
https://nextjs.org/docs/pages/api-reference/components/image