# Plan

The goal: a database of Game Boy, Game Boy Color and Game Boy Advance cartridges as a collector tells them apart, and
a static web app on GitHub Pages to look them up by label serial and keep track of a collection.

Every datum comes from a source in `raw-data-sources/` (unmodified, with a README on its origin), is parsed to
`data-sources/`, and merged into `database/releases.json`, which keeps only what the web app uses. Corrections need
evidence and should be reported to their source.

## Done

- Importers: sprintinglegs, game-boy-database.com, no-intro.org, dmgpage.com, gbhwdb.gekkio.fi, GBxDumper, my own
  codes (github.com-geon), libretro-thumbnails, en.wikipedia.org.
- Serial parsing and hand-written corrections (`raw-data-sources/corrections/`).
- The merge: games grouped by checksums, ROM chips, label serials, codes, header codes and code stems (checked against
  No-Intro's families), and ROM-only and label-only games by title. One release per product code on the label, e.g.
  DMG-TRA and DMG-TR for Tetris; Chinese releases are variants of the release they share a ROM with.
- Release years from Wikipedia: the earliest year in the release's regions, else the game's.
- Images per release, best first: gbhwdb cartridge photos, game-boy-database.com box scans, libretro box art, title
  screens and gameplay (libretro names matched by title when No-Intro renamed the ROM).
- Review reports in `database/`: stem contradictions, unverified stems, title merges, libretro name matches, Wikipedia
  rows matching several games.

## Next, for the database

1. **Stable release ids.** Releases without a label serial get ids from ROM numbers, e.g. `agb-1459`, which change
   when the merge rules change; collections stored by id would break. Use the product code from the ROM header or ROM
   chip where known (e.g. AGB-BKCJ for Crayon Shin-chan, AGB-B4ZJ for Rockman Zero 4), and keep a list of retired ids.
2. **Display titles.** `title` is often in No-Intro style ("Legend of Zelda, The - Link's Awakening"), and Japanese
   releases mix Japanese script and romaji. Give a Latin `title` (from Wikipedia when matched) and an `originalTitle` in
   Japanese script.
3. **Tags**, e.g. kirby, mario, wario, zelda: a hand-written tag list matched against titles, and Wikidata series as a
   secondary source.
4. **Label art variants:** a hand-written file for releases whose label art differs, e.g. the Player's Choice Super
   Mario Land.
5. **Cartridge colors and shells:** a hand-written `cartridge-colors.json` with evidence, for colored shells (Pokémon,
   Donkey Kong Land, Kirby Tilt 'n' Tumble…) and rumble cartridges. Wikipedia's "Cartridge feature" column (imported)
   lists rumble, tilt sensor and infrared games.
6. Possibly: use gbhwdb's No-Intro names as links; a report of look-alike typos in serials.

## Next, the web app

- Static site on GitHub Pages: Vite + TypeScript (React? undecided), built by `npm run build:site`, deployed by GitHub
  Actions.
- `data/index.json` for the list (~300 KB gzipped: id, titles, system, licensing, year, serials, one image) and a detail
  file per release with a file-safe slug.
- Cards: title, image, year, an "in my collection" toggle and more info. Not the system; the image shows it.
- Search, and lookup by serial: normalize, then exact serial, then product code, then stem.
- Collection in localStorage, saved continuously. Import/export as a text file, one `SERIAL Title` per line (like
  `assets/wishlist.txt` on main); import reads the first word and keeps unmatched lines. My collection is
  `assets/my-games.txt` on main (338 serials).
- GameEye import by title and platform (its CSV has Platform, Title, Country; its `.ged` backup is a zipped SQLite).
- PriceCharting search links are built in the app:
  `https://www.pricecharting.com/search-products?type=prices&q=<title>`.
- Card images need thumbnails, about 300 px wide at JPEG quality 65 (`cjpeg -optimize -progressive`), 12–26 KB each,
  made and hosted by the site build instead of hotlinking `raw.githubusercontent.com`. Screenshots stay native PNG.

## Waiting on me

- Check my own cartridges: `AGB-ABOP-EUR` "David Beckham Soccer" is probably `AGB-ABQP-EUR` (ABOP is Boxing Fever);
  `DMG-LBA` Lemmings is probably `DMG-L8A`.
- The email to sprintinglegs (sprintinglegs@gmail.com) asking for a database export: drafted, not sent.
- The email to the game-boy-database.com team asking to use their cartridge scans as small thumbnails: drafted, not
  sent; their contact address still to be found (the "Why watermarks?" text, a member account, or via dmgpage.com).
- Report the corrections in `raw-data-sources/corrections/` to their sources.

## Separate project: cartridge images

Not in this repository; set up a new one before committing any of it. Experiments so far (scripts not kept in a repo):

- Aligning gbhwdb photos (or my own) to game-boy-database.com's scans of the same serial: SIFT + homography, accurate
  only against the scan of the same country serial, since US and European labels are printed slightly differently.
- The scans' watermark is one overlay scaled to the scan's width and centered; a mask from the average of 59 scans
  covers its letters, outlines and logo (16 % of the frame).
- Straight-on labels composited onto a clean cartridge.
- Damage detection (paused): wear on the top ~10 mm of the label as "lighter and paler than predicted" from a robust
  color mapping, and scratches on the grey side strips.
- The sampled plastic color works great, but the original image needs to be color corrected. If the plasic is near gray, it should be corrected to gray. The plastic often browns with age. In thise cases the label should not be un-browned, only the calculated plastic color. If the plastic is near black, the whole photo should be color balanced too. Watch out for white, yellow, red, blue, marine blue, and pink plastic.
