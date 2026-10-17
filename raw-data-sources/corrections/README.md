# corrections

Hand-written corrections of errors in the sources, applied when merging. Each correction names the source record it applies to, the wrong value, the correct value (or null to remove it), the reason, and links to the evidence.

Corrections should also be reported to the source, so it can be fixed there. `npm run report:corrections` writes the unreported ones per source, ready to send. Set `reported` to the date and link of the report once sent.

| File           | Corrects                                                                                |
| -------------- | --------------------------------------------------------------------------------------- |
| `serials.json` | Cartridge label and ROM chip serials (`field`): typos, and serials linked to the wrong game |
| `same-game-stems.json` | Product code stems shared by games in different No-Intro families that are still the same game (see below) |

The evidence is mostly the game code in the ROM header (Game Boy Advance), ROM chip serials, other sources agreeing, and photos of cartridges.

Run `npm run report:label-serials` to see corrections in use and any that no longer match their source, e.g. after the source has fixed the error.

## Same game stems

The last letter of a product code is a region/language letter, e.g. DMG-APAE (USA) and DMG-APAD (Germany), so codes with the same stem are usually the same game. But Nintendo reused some codes for unrelated games in other regions, e.g. CGB-BSUJ is Super Robot Pinball and CGB-BSUE Ultimate Surfing. So when No-Intro puts the games of a stem in different families, they are only merged when confirmed in `same-game-stems.json`, with a reason and evidence.

