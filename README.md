# Mission: Impossible

Static event site for IEEE CIS, SSN Student Branch, for IEEE Day 2026. Plain HTML, CSS and JavaScript modules; no dependencies, framework or build step.

## Run locally

Use any static HTTP server from the project directory. For example:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. Serve over HTTP rather than opening `index.html` directly, so JavaScript modules load correctly.

## Deploy

The installed Vercel CLI is outdated. Upgrade for best compatibility:

```sh
npm i -g vercel@latest
```

From the project directory, run `vercel` for a preview deployment, or `vercel --prod` to publish to production. Sign in and follow the CLI prompts. No build command is needed.

Alternatively, push the project to a Git repository and import it in the Vercel dashboard. Choose the **Other** framework preset, leave the build command empty, and serve the project root. `vercel.json` enables clean URLs and caches `/assets/*` for one year.

Assets are cached as immutable. When replacing an asset, give it a new filename and update its references to avoid serving a cached version.

## Files and ownership

- `index.html`: semantic markup, copy, metadata and behaviour hooks.
- `js/config.js`: the single CONFIG object containing event facts, links and lists.
- `js/main.js`: content rendering, countdown, links, leak toggles, sticky bar and footer sequence.
- `js/fx.js`: visual effects: the Descent hero scroll sequence, the directive decrypt and the countdown tick.
- `css/tokens.css`, `css/base.css`, `css/sections.css`: styling; currently minimal readable defaults.
- `assets/`: media, images and logos.

Behaviour uses `data-*` hooks; styling uses classes. Beauty work may add wrappers and classes to the HTML but must preserve copy, links and behaviour hooks. Visual effects must respect `data-motion="reduced"` on the root element.

Metadata in `<head>` is present before JavaScript runs so link preview crawlers can read it. Keep its title and description aligned with CONFIG when updating event copy. Once the domain is confirmed, use absolute URLs for the Open Graph and Twitter images and add `og:url` and a canonical URL.

## Hero scroll sequence

The hero background is the Descent sequence, scrubbed on a canvas as the visitor scrolls through a pinned hero. The title, then the tagline, directive and countdown, then the meta strip and buttons are revealed in three beats. `assets/hero-poster.jpg` is the first frame and is shown instead of the sequence when reduced motion or data saver is on, or when the hero content is too tall to fit one screen.

The three chapters live in `source/`: descent, infiltration and extraction. To regenerate every second frame with the free local AI upscaler:

1. Download the [macOS Real-ESRGAN release](https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-macos.zip) and extract its binary and `models/` into `tools/realesrgan/` (ignored by Git).
2. Run `chmod +x tools/realesrgan/realesrgan-ncnn-vulkan`. If macOS blocks it, run `xattr -dr com.apple.quarantine tools/realesrgan`.
3. Install ffmpeg with `npm install` and Pillow with `python3 -m pip install Pillow`.
4. Run `python3 tools/extract_frames.py --upscale`.

The script extracts lossless PNGs into a temporary folder, runs `realesr-animevideov3` at 2x, then exports desktop WebP at 2400px wide/quality 86 and mobile WebP at 1080px wide/quality 78. If the combined desktop sets exceed 25 MB (decimal), it re-encodes desktop at quality 80 and reports the new total. Posters use the first upscaled frame at JPEG quality 88. The manifest records frame counts, asset paths and export settings. Use `--upscale-model realesrgan-x4plus` if a visual comparison favors that model. This release produces tile seams with x4plus at `-s 2`, so that optional path uses its native 4x network and downsamples to 2x. Chapter names can be supplied to process a subset. Running without `--upscale` retains the original 1280px/720px extraction.

Assets are cached as immutable; regenerated assets may require a cache refresh when deployed.

## Assets to add

- `assets/og.jpg`: the social preview image, ideally 1200 × 630 pixels.
- `assets/favicon.ico`: the favicon placeholder referenced in the head.
- Approved IEEE CIS / SSN logos or other event images for the visual pass, as needed.

Do not use the film's logo, theme music or actor likenesses.

## Open items

- Real rules text: confirm the final rules and rulebook content.
- Bypass code details: confirm the benefit and how it is awarded on site.
- Room number: replace `TBA` in CONFIG.
- Wi-Fi/power: confirm participant access and availability.
- Domain: confirm the public domain and final social preview URLs.
