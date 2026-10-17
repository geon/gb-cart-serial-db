# sprintinglegs

Master lists from the Game Boy database at https://www.sprintinglegs.com/gbdb/, saved from a browser (HTML only).

| File       | Saved from                                               | Page title                   |
| ---------- | -------------------------------------------------------- | ---------------------------- |
| `dmg.html` | https://www.sprintinglegs.com/gbdb/gameslist?consoleID=1 | Game Boy Master List         |
| `cgb.html` | https://www.sprintinglegs.com/gbdb/gameslist?consoleID=2 | Game Boy Color Master List   |
| `agb.html` | https://www.sprintinglegs.com/gbdb/gameslist?consoleID=3 | Game Boy Advance Master List |

Saved 2026-09-22. The files are unmodified; known damage is repaired in the importer (`src/importers/sprintinglegs/parse.ts`).

Imported to `data-sources/sprintinglegs.json` with `npm run import:sprintinglegs`.
