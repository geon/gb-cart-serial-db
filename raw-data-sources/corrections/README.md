# corrections

Hand-written corrections of errors in the sources, applied when merging. Each correction names the source record it applies to, the wrong value, the correct value (or null to remove it), the reason, and links to the evidence.

Corrections should also be reported to the source, so it can be fixed there. `npm run report:corrections` writes the unreported ones per source, ready to send. Set `reported` to the date and link of the report once sent.

| File           | Corrects                                                                                |
| -------------- | --------------------------------------------------------------------------------------- |
| `serials.json` | Cartridge label and ROM chip serials (`field`): typos, and serials linked to the wrong game |

The evidence is mostly the game code in the ROM header (Game Boy Advance), ROM chip serials, other sources agreeing, and photos of cartridges.

Run `npm run report:label-serials` to see corrections in use and any that no longer match their source, e.g. after the source has fixed the error.
