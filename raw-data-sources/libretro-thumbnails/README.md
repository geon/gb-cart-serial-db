# libretro-thumbnails

File lists of the libretro-thumbnails image repositories (box art, title screens and gameplay screenshots), named after the No-Intro name of each ROM. The images themselves aren't copied; the importer links to them, pinned to the commit below.

| File                               | Repository                                                      | Commit                                     | Commit date |
| ---------------------------------- | --------------------------------------------------------------- | ------------------------------------------ | ----------- |
| `Nintendo_-_Game_Boy.json`         | https://github.com/libretro-thumbnails/Nintendo_-_Game_Boy         | `f033af49af2d9761d6821aff479bb0ba5feea5e3` | 2026-09-06  |
| `Nintendo_-_Game_Boy_Color.json`   | https://github.com/libretro-thumbnails/Nintendo_-_Game_Boy_Color   | `0931985ba8a3a9f38fb87f006611a13dc094260f` | 2026-09-06  |
| `Nintendo_-_Game_Boy_Advance.json` | https://github.com/libretro-thumbnails/Nintendo_-_Game_Boy_Advance | `23b8665408e767fd3220bfb83fd5ad8dfe1a9aa1` | 2026-09-06  |

Each file is the GitHub API's recursive git tree of the commit, `https://api.github.com/repos/libretro-thumbnails/<repository>/git/trees/<commit>?recursive=1`, downloaded 2026-10-15 and unmodified.

Some images are symlinks to another image. `symlinks.json` holds their targets (box art, title screens and gameplay only), downloaded the same day from `https://raw.githubusercontent.com/libretro-thumbnails/<repository>/<commit>/<path>`.

In the file names, the characters `&*/:` `` ` `` `<>?\|"` of the No-Intro name are replaced by `_`.

Imported to `data-sources/libretro-thumbnails.json` with `npm run import:libretro-thumbnails`.
