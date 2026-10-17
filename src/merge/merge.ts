import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadSameGameStems, loadSerialCorrections } from "../corrections.ts";
import { buildGames } from "./build.ts";
import { groupGames } from "./games.ts";
import { keys, sourceLinks, type Sources } from "./links.ts";

// Merges data-sources/*.json into database/games.json, and lists the stems that weren't followed in database/stem-contradictions.json.

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
const { gameOf, contradictions } = groupGames(
	sourceLinks(sources, corrections),
	(key) => familyOfRecord.get(key),
	new Set(loadSameGameStems().map(({ stem }) => stem)),
);
const games = buildGames(sources, corrections, gameOf);

mkdirSync("database", { recursive: true });
writeFileSync("database/games.json", JSON.stringify(games, null, "\t") + "\n");
writeFileSync(
	"database/stem-contradictions.json",
	JSON.stringify(contradictions, null, "\t") + "\n",
);
console.log(
	`Wrote ${games.length} games to database/games.json, ${contradictions.length} stems not followed to database/stem-contradictions.json`,
);
