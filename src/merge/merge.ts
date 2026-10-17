import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
	loadSameGameStems,
	loadSeparateCodes,
	loadSerialCorrections,
} from "../corrections.ts";
import { buildReleases, noIntroSystem, publishedRelease } from "./build.ts";
import { groupGames, mergeByTitle } from "./games.ts";
import { keys, recordTitles, sourceLinks, type Sources } from "./links.ts";
import { addWikipedia } from "./wikipedia.ts";
import { matchLibretro } from "./libretro.ts";

// Merges data-sources/*.json into database/releases.json, and lists the stems that weren't followed in
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
	geon: load("github.com-geon"),
	libretroThumbnails: load("libretro-thumbnails"),
};
const corrections = loadSerialCorrections();

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
	buildReleases(sources, corrections, gameOf),
	load("en.wikipedia.org"),
);

mkdirSync("database", { recursive: true });
writeFileSync(
	"database/releases.json",
	JSON.stringify(releases.map(publishedRelease), null, "\t") + "\n",
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
	`Wrote ${releases.length} releases of ${new Set(releases.map(({ gameId }) => gameId)).size} games to database/releases.json, ${contradictions.length} stems not followed to database/stem-contradictions.json, ${unverified.length} to review in database/stem-unverified.json, ${merges.length} games merged by title in database/title-merges.json, ${fuzzyMatches.length} libretro-thumbnails images matched by title in database/libretro-name-matches.json, ${ambiguous.length} Wikipedia rows matching several games in database/wikipedia-ambiguous.json`,
);
