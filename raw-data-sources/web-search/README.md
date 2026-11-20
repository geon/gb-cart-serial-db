# web-search

Web searches for label serials that photos of cartridges show but no source lists, made to verify them before adding them
in `raw-data-sources/corrections/added-serials.json`.

The candidates come from the [gameboy-labels](https://github.com/geon/gameboy-cartridge-labels) repository: serials
read on label photos (`generated/read-serials/serials.json`) that gb-game-list lacks, whose product code is the ROM
header code of one release (`npm run -s report:label-serial-candidates -- <gameboy-labels>`).

| File                  | Searched   | Serials |
| --------------------- | ---------- | ------- |
| `serials-batch1.json` | 2026-11-19 | 20      |
| `serials-batch2.json` | 2026-11-19 | 20      |
| `serials-batch3.json` | 2026-11-19 | 20      |
| `serials-batch4.json` | 2026-11-19 | 20      |
| `serials-batch5.json` | 2026-11-20 | 19 |
| `serials-batch6.json` | 2026-11-20 | 19 |
| `serials-batch7.json` | 2026-11-20 | 19 |
| `serials-batch8.json` | 2026-11-20 | 19 |
| `serials-batch9.json` | 2026-11-20 | 17 |

Each serial was searched once with Claude Code's WebSearch tool in its "extended" mode, the bare serial as the query
(quoted serials in "standard" mode found nothing). The results are written from the search tool's summaries; the pages
weren't fetched, so a title or serial is as the summary gave it. For each result:

- `serialShown`: the serial as the page shows it, and `exact` whether it is the searched one.
- `titleFound`: the title the page gives for it.
- `kind`: `catalog` (product ids entered by hand: GameFAQs, VGCollect, arcade-history…), `rom-derived` (lists made from
  ROM dumps or headers, which don't show what the label says), `listing` (shops and auctions) or `other`.

A serial is added when its product code is the header code of one release, and at least 2 exact results, one of them a
catalog or a listing, give a title of that release. Results of kind `other` don't count: they include the gameboy-labels
repository itself.

The summaries can misattribute: in batch 4, a result said gbhwdb lists AGB-AHPP-UKV (Hot Potato!), but gbhwdb has no
AHPP cartridge, so that serial wasn't added. Results from sources already imported are checked against their import.
