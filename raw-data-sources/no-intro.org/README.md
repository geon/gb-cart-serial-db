# no-intro.org

"DB Export" DAT files from No-Intro's DAT-o-MATIC (https://datomatic.no-intro.org), with full details: dump sources, printed serials and scene releases.

| File      | Original file name                                         | Downloaded from                                                                 |
| --------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `dmg.xml` | Nintendo - Game Boy (DB Export) (20260919-114245).xml         | https://datomatic.no-intro.org/index.php?page=manager&s=46&download=405 |
| `cgb.xml` | Nintendo - Game Boy Color (DB Export) (20260921-124904).xml   | https://datomatic.no-intro.org/index.php?page=manager&s=47&download=392 |
| `agb.xml` | Nintendo - Game Boy Advance (DB Export) (20260919-175115).xml | https://datomatic.no-intro.org/index.php?page=manager&s=23&download=403 |

The date in each file name is the export version, also in the `<version>` header: Game Boy and Game Boy Advance were exported 2026-09-19, Game Boy Color 2026-09-21. Each was downloaded as a zip containing the single XML file, from the "DB" tab of the download page https://datomatic.no-intro.org/index.php?page=download&s=64. The files are unmodified.

Each entry links to its record page on DAT-o-MATIC, e.g. https://datomatic.no-intro.org/index.php?page=show_record&s=46&n=1317, built from the system id and archive number.

Imported to `data-sources/no-intro.org.json` with `npm run import:no-intro.org`. Only physical, official-era releases are imported; see `src/importers/no-intro.org/parse.ts`.
