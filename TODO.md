# Plan

The goal: a full composite database of Game Boy, Game Boy Color and Game Boy Advance cartridges as a collector tells
them apart, with the data of every source consolidated into common properties. Source data that only repeats another
value, or describes something else (e.g. a site's own ids, or dmgpage.com's manuals), is left out.
Formatting it for an application, e.g. the web app below, is out of scope for this repository.

Every datum comes from a source in `raw-data-sources/` (unmodified, with a README on its origin), is parsed to
`data-sources/`, and merged into `database/releases.json` and `database/roms.json`, whose schema is `src/release.ts`.
Source entries in no release are in `database/unmatched.json`. Corrections need evidence and should be reported to their source.

## Done

- Importers: sprintinglegs, game-boy-database.com, no-intro.org, dmgpage.com, gbhwdb.gekkio.fi, GBxDumper,
  libretro-thumbnails, en.wikipedia.org.
- Serial parsing and hand-written corrections (`raw-data-sources/corrections/`).
- The merge: games grouped by checksums, ROM chips, label serials, codes, header codes and code stems (checked against
  No-Intro's families), and ROM-only and label-only games by title. One release per product code on the label, e.g.
  DMG-TRA and DMG-TR for Tetris; Chinese releases are variants of the release they share a ROM with.
- From Wikipedia, per release region: release dates, developers, publishers, titles, cartridge features (rumble,
  real-time clock…), and the game's article.
- ROMs in `database/roms.json`, referenced by id: No-Intro's names, regions, versions, editions, header codes and
  files, with GBxDumper's header titles and save types.
- Titles per release: `title`, as printed or released in the release's language (its serials' country, else English),
  `titleLatin` when that isn't in Latin letters, a source's `titleTranslated`, and `localizedTitles` for releases sold
  in several languages. Latin titles of Japanese releases are only tagged romanized when a source's translation
  differs; else their language is unknown.
- Images per release, best first: gbhwdb cartridge photos, game-boy-database.com box scans, libretro box art, title
  screens and gameplay (libretro names matched by title when No-Intro renamed the ROM).
- Source entries in no release in `database/unmatched.json`: GBxDumper dumps whose CRC32 isn't in No-Intro, libretro
  images of ROMs not in the No-Intro import, and Wikipedia rows matching no game or several.
- Release ids from product codes: ROMs without a label serial are keyed by their header code, e.g. AGB-BKCJ, so their
  revisions are one release and a ROM joins the label release with its header code (e.g. Pokemon Ruby Rev 1 in
  AGB-AXVD), or by their ROM chip's code.
- GBxDumper dumps whose CRC32 isn't in No-Intro, as `otherDumps` of the ROM with their header code (or of those, the
  one of their size): 441 of 510.
- Misprinted label serials, e.g. DMT-DT-USA on DuckTales (USA), kept as label serials of their release
  (`raw-data-sources/corrections/misprinted-serials.json`).
- Review reports in `database/`: stem contradictions, unverified stems, title merges, libretro name matches, Wikipedia
  rows matching several games.

## Next, for the database

1. **Stable release ids, the rest.** Releases without a label serial are keyed by their ROM header code (Game Boy
   Advance) or ROM chip code. 695 still have ROM-number ids, e.g. `dmg-1383`: 608 Game Boy and Game Boy Color releases
   known only from their ROM, and unlicensed and pirate cartridges, whose codes are reused. Once something stores ids,
   keep a list of retired ids.

<!-- 3. **Tags**, e.g. kirby, mario, wario, zelda: a hand-written tag list matched against titles, and Wikidata series as a
   secondary source. -->
<!-- 4. **Label art variants:** a hand-written file for releases whose label art differs, e.g. the Player's Choice Super
   Mario Land. -->
<!-- 5. **Cartridge colors and shells:** a hand-written `cartridge-colors.json` with evidence, for colored shells (Pokémon,
   Donkey Kong Land, Kirby Tilt 'n' Tumble…) and rumble cartridges. Wikipedia's "Cartridge feature" column (imported)
   lists rumble, tilt sensor and infrared games. -->
<!-- 6. Possibly: use gbhwdb's No-Intro names as links; a report of look-alike typos in serials. -->

8. **Missing label serials:** releases known from their ROM but without the serial on their label. 81 added
   (`raw-data-sources/corrections/added-serials.json`), from serials read on gameboy-labels' photos
   (`npm run -s report:label-serial-candidates -- <gameboy-labels>`, 216 candidates) and confirmed by web searches
   (`raw-data-sources/web-search/`, 9 batches: all 148 candidates with one header ROM), and from GBxDumper's game list. A serial is added when its product code is the ROM header code of
   one ROM, and at least 2 exact search results, one of them a catalog or a listing, give a title of that ROM's release.
   The OCR'd title on the photo is support only: it misses Japanese and logo titles.
   - The other 81 searched candidates lack evidence (mostly only ROM-derived lists, or one catalog or listing), or the
     results name another game. AGB-AHPP-UKV (Hot Potato!) has one listing; a search result claiming gbhwdb has it was
     wrong. Next: more sources for the 81 (e.g. fetching the catalog pages
     instead of relying on search summaries).
   - GBxDumper's serials no release has on its label, whose code is the header code of one release: 711. A sample of 40
     (batches 10 and 11) added 14; the other 671 would take about 34 batches (about 2.2M tokens) for roughly 230 more.
   - Back to gameboy-labels: the 62 read serials whose code is no ROM's header code are most likely misreads, e.g.
     AGB-835E-USA (AGB-B35E-USA, Strawberry Shortcake), AGB-AN2E-USA (AGB-AZFE-USA, Need for Speed Porsche Unleashed),
     AGB-AZOP-EUR (AGB-AZQP-EUR, Treasure Planet), AGB-BMAE-USA (AGB-BSME-USA, Metal Slug Advance), CGB-3SZE-USA
     (CGB-BBZE-USA, Dragon Ball Z Legendary Super Warriors).
   - AGB-ADBE-USA was read on a photo of Digimon Battle Spirit 2 (AGB-BDSE-USA), but ADBE is Denki Blocks!: too blurry
     to tell, or a reproduction cartridge with a wrong label. Not added.

9. **Codes without a region suffix don't get their own release.** sprintinglegs lists bare product codes, e.g.
   CGB-BXCP and AGB-BMZJ, and the merge only makes a release per label serial. A bare code that is the ROM header code
   of one of the game's ROMs now joins that ROM's release (AGB-BMZJ is in `agb-1238`), which removed 765 releases
   without a ROM. Left: codes without a ROM header code to match, i.e. Game Boy and Game Boy Color, e.g. CGB-BXCP
   (Xtreme Wheels, Europe), whose sprintinglegs entry is in the US release CGB-BXCE. A product code with a region letter
   that differs from every label serial of the game should probably make (or join) the release of that region. Such a
   release keeps its ROM-number id (`agb-1238`), not the code (see 1).

10. **Unmatched entries:** match more of `database/unmatched.json`, e.g. Wikipedia rows like "Donkey Kong Land" and
    "Bomberman GB" that match no game. 69 GBxDumper dumps are left: 37 whose header code no No-Intro ROM has (mostly
    GBA Video cartridges, e.g. AGB-MCNE-USA, whose releases are known from labels only), and 32 whose code several ROMs
    of the same size have, e.g. revisions.

11. **Check the labels repo and web for more serials:** Match titles with missing serials against images and web search results.
