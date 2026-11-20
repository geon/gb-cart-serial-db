# corrections

Hand-written corrections of errors in the sources, applied when merging. Each correction names the source record it applies to, the wrong value, the correct value (or null to remove it), the reason, and links to the evidence.

Corrections should also be reported to the source, so it can be fixed there. `npm run report:corrections` writes the unreported ones per source, ready to send. Set `reported` to the date and link of the report once sent.

| File           | Corrects                                                                                |
| -------------- | --------------------------------------------------------------------------------------- |
| `serials.json` | Cartridge label and ROM chip serials (`field`): typos, and serials linked to the wrong game |
| `same-game-stems.json` | Product code stems shared by games in different No-Intro families that are still the same game (see below) |
| `added-serials.json` | Label serials a record lacks, e.g. read on photos of the cartridge and confirmed by web searches (see below) |
| `misprinted-serials.json` | Serials printed wrong on real labels, kept as label serials of the release they should have been in (see below) |
| `separate-codes.json` | Product codes that aren't the same game as the rest of their stem, although no No-Intro family contradicts it |

The evidence is mostly the game code in the ROM header (Game Boy Advance), ROM chip serials, other sources agreeing, and photos of cartridges.

Run `npm run report:label-serials` to see corrections in use and any that no longer match their source, e.g. after the source has fixed the error.

## Added serials

Many releases are known only from their ROM, without the serial on their label. `added-serials.json` adds a label serial to a source's record, e.g. AGB-BC2J-JPN to No-Intro's Crayon Shin-chan - Densetsu o Yobu Omake no Miyako Shockgaan! (Japan), so it names the release and joins it with the other sources' records of the code. Like the other corrections, they should be reported to the source.

So far they come from the photos of the gameboy-labels repository: serials read on a label (`npm run -s report:label-serial-candidates -- <gameboy-labels>`) whose product code is the ROM header code of one ROM, and which web searches confirm (`raw-data-sources/web-search/`). A read serial whose code is no ROM's header code is most likely a misread, e.g. AGB-AZOP-EUR for AGB-AZQP-EUR (Treasure Planet), to correct in gameboy-labels instead.

## Misprinted serials

Some serials really are printed wrong on the label, e.g. a run of DuckTales (USA) labels say DMT-DT-USA instead of DMG-DT-USA. They aren't errors to correct: they are added as label serials of the release of the serial they should have been, marked with `misprintOf`, so lookup by the printed serial finds them. Photos in the [gameboy-labels](https://github.com/geon/gameboy-cartridge-labels) repository are cited as `gameboy-labels:<path>`.

## Same game stems

The last letter of a product code is a region/language letter, e.g. DMG-APAE (USA) and DMG-APAD (Germany), so codes with the same stem are usually the same game. But Nintendo reused some codes for unrelated games in other regions, e.g. CGB-BSUJ is Super Robot Pinball and CGB-BSUE Ultimate Surfing. So when No-Intro puts the games of a stem in different families, they are only merged when confirmed in `same-game-stems.json`, with a reason and evidence.

`npm run merge` lists stems that merge groups without a No-Intro entry and with no title word in common in `database/stem-unverified.json`. Most are localized titles of the same game, e.g. Mega Man II and Rockman World 2; the others go in `separate-codes.json`.

