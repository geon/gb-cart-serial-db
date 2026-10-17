import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
	loadSameGameStems,
	loadSeparateCodes,
	loadSerialCorrections,
} from "../corrections.ts";
import { buildReleases } from "./build.ts";
import { groupGames } from "./games.ts";
import { keys, recordTitles, sourceLinks, type Sources } from "./links.ts";

// Merges data-sources/*.json into database/releases.json, and lists the stems that weren't followed in
// database/stem-contradictions.json (No-Intro's families disagree), and the stems merging groups without No-Intro entries
// whose titles share no word, to review, in database/stem-unverified.json.

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
const { gameOf, contradictions, unverified } = groupGames(
	sourceLinks(sources, corrections),
	(key) => familyOfRecord.get(key),
	new Set(loadSameGameStems().map(({ stem }) => stem)),
	new Set(loadSeparateCodes().map(({ code }) => code)),
	(key) => titles.get(key) ?? [],
);
const releases = buildReleases(sources, corrections, gameOf);

mkdirSync("database", { recursive: true });
writeFileSync(
	"database/releases.json",
	JSON.stringify(releases, null, "\t") + "\n",
);
writeFileSync(
	"database/stem-contradictions.json",
	JSON.stringify(contradictions, null, "\t") + "\n",
);
writeFileSync(
	"database/stem-unverified.json",
	JSON.stringify(unverified, null, "\t") + "\n",
);
console.log(
	`Wrote ${releases.length} releases of ${new Set(releases.map(({ gameId }) => gameId)).size} games to database/releases.json, ${contradictions.length} stems not followed to database/stem-contradictions.json, ${unverified.length} to review in database/stem-unverified.json`,
);
