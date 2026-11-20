import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
	loadMisprintedSerials,
	loadSameGameStems,
	loadSeparateCodes,
	loadSerialCorrections,
} from "../corrections.ts";
import {
	buildReleases,
	groupRecords,
	noIntroSystem,
	otherDumpsByRom,
	publishedRelease,
	publishedRom,
	recordEntries,
	romId,
	type Records,
} from "./build.ts";
import { groupGames, mergeByTitle } from "./games.ts";
import { keys, recordTitles, sourceLinks, type Sources } from "./links.ts";
import { addWikipedia } from "./wikipedia.ts";
import { matchLibretro } from "./libretro.ts";

// Merges data-sources/*.json into database/releases.json and database/roms.json (see src/release.ts), and writes the
// source entries in no release to database/unmatched.json. Also lists the stems that weren't followed in
// database/stem-contradictions.json (No-Intro's families disagree), and the stems merging groups without No-Intro entries
// whose titles share no word, to review, in database/stem-unverified.json, the games merged by title, to review, in
// database/title-merges.json, the libretro-thumbnails images matched by title instead of exact name in
// database/libretro-name-matches.json, and the rows of Wikipedia's lists matching
// several unrelated games in database/wikipedia-ambiguous.json.

function load<T>(source: string): T {
	return JSON.parse(readFileSync(`data-sources/${source}.json`, "utf-8")) as T;
}

const sources: Sources = {
	noIntro: load("no-intro.org"),
	gameBoyDatabaseCom: load("game-boy-database.com"),
	sprintinglegs: load("sprintinglegs"),
	dmgpage: load("dmgpage.com"),
	gbhwdb: load("gbhwdb.gekkio.fi"),
	gbxDumper: load("github.com-mstroh76-GBxDumper"),
	libretroThumbnails: load("libretro-thumbnails"),
};
const corrections = loadSerialCorrections();
const wikipedia =
	load<NonNullable<Records["en.wikipedia.org"]>>("en.wikipedia.org");

const familyOfRecord = new Map(
	sources.noIntro.map((entry) => [
		keys.record("no-intro.org", entry.url),
		entry.parentUrl ?? entry.url,
	]),
);
const titles = recordTitles(sources);
const grouped = groupGames(
	sourceLinks(sources, corrections),
	(key) => familyOfRecord.get(key),
	new Set(loadSameGameStems().map(({ stem }) => stem)),
	new Set(loadSeparateCodes().map(({ code }) => code)),
	(key) => titles.get(key) ?? [],
);
const { contradictions, unverified } = grouped;
const roms = new Map(
	sources.noIntro.map((entry) => [
		keys.record("no-intro.org", entry.url),
		{
			system: noIntroSystem(entry),
			licensed: entry.licensing === "licensed" && entry.edition !== "Kiosk",
		},
	]),
);
const { gameOf, merges } = mergeByTitle(
	grouped.gameOf,
	(key) => roms.get(key),
	(key) => titles.get(key) ?? [],
);
const { releases, ambiguous } = addWikipedia(
	buildReleases(sources, corrections, gameOf, loadMisprintedSerials()),
	wikipedia,
);

mkdirSync("database", { recursive: true });
writeFileSync(
	"database/releases.json",
	JSON.stringify(releases.map(publishedRelease), null, "\t") + "\n",
);
const releaseRoms = new Set(releases.flatMap(({ roms }) => roms));
const gbxDumperByCrc32 = Map.groupBy(sources.gbxDumper, ({ crc32 }) =>
	crc32.toLowerCase(),
);
const otherDumps = otherDumpsByRom(sources.noIntro, sources.gbxDumper);
writeFileSync(
	"database/roms.json",
	JSON.stringify(
		sources.noIntro
			.filter((entry) => releaseRoms.has(romId(entry)))
			.map((entry) =>
				publishedRom(
					entry,
					entry.files.flatMap(
						({ crc32 }) => gbxDumperByCrc32.get(crc32.toLowerCase()) ?? [],
					),
					otherDumps.get(romId(entry)),
				),
			)
			.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
		null,
		"\t",
	) + "\n",
);
// An entry's identity: its URL, or else its content, since dmgpage.com's entries have none.
const entryKey = (entry: object) =>
	"url" in entry && typeof entry.url === "string"
		? entry.url
		: JSON.stringify(entry);
const merged = new Set([
	...releases.flatMap(({ records }) =>
		recordEntries(records).map(
			({ source, entry }) => `${source} ${entryKey(entry)}`,
		),
	),
	...[...otherDumps]
		.filter(([id]) => releaseRoms.has(id))
		.flatMap(([, dumps]) =>
			dumps.map((dump) => `github.com-mstroh76-GBxDumper ${entryKey(dump)}`),
		),
]);
const unmatched = groupRecords(
	recordEntries({
		"no-intro.org": sources.noIntro,
		"game-boy-database.com": sources.gameBoyDatabaseCom,
		sprintinglegs: sources.sprintinglegs,
		"dmgpage.com": sources.dmgpage,
		"gbhwdb.gekkio.fi": sources.gbhwdb,
		"github.com-mstroh76-GBxDumper": sources.gbxDumper,
		"libretro-thumbnails": sources.libretroThumbnails,
		"en.wikipedia.org": wikipedia,
	}).filter(({ source, entry }) => !merged.has(`${source} ${entryKey(entry)}`)),
);
writeFileSync(
	"database/unmatched.json",
	JSON.stringify(unmatched, null, "\t") + "\n",
);
writeFileSync(
	"database/stem-contradictions.json",
	JSON.stringify(contradictions, null, "\t") + "\n",
);
const { fuzzyMatches } = matchLibretro(
	sources.noIntro,
	sources.libretroThumbnails,
);
writeFileSync(
	"database/libretro-name-matches.json",
	JSON.stringify(fuzzyMatches, null, "\t") + "\n",
);
writeFileSync(
	"database/title-merges.json",
	JSON.stringify(merges, null, "\t") + "\n",
);
writeFileSync(
	"database/wikipedia-ambiguous.json",
	JSON.stringify(ambiguous, null, "\t") + "\n",
);
writeFileSync(
	"database/stem-unverified.json",
	JSON.stringify(unverified, null, "\t") + "\n",
);
console.log(
	`Wrote ${releases.length} releases of ${new Set(releases.map(({ gameId }) => gameId)).size} games to database/releases.json, ${Object.entries(
		unmatched,
	)
		.map(([source, entries]) => `${entries.length} ${source} entries`)
		.join(
			", ",
		)} in no release to database/unmatched.json, ${contradictions.length} stems not followed to database/stem-contradictions.json, ${unverified.length} to review in database/stem-unverified.json, ${merges.length} games merged by title in database/title-merges.json, ${fuzzyMatches.length} libretro-thumbnails images matched by title in database/libretro-name-matches.json, ${ambiguous.length} Wikipedia rows matching several games in database/wikipedia-ambiguous.json`,
);
