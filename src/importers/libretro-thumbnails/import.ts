import { readFileSync, writeFileSync } from "node:fs";
import {
	parseLibretroThumbnailsTree,
	type GitTree,
	type LibretroThumbnailsRepository,
} from "./parse.ts";

const inputDirectory = "raw-data-sources/libretro-thumbnails";
const outputPath = "data-sources/libretro-thumbnails.json";

const repositories: readonly LibretroThumbnailsRepository[] = [
	"Nintendo_-_Game_Boy",
	"Nintendo_-_Game_Boy_Color",
	"Nintendo_-_Game_Boy_Advance",
];

const symlinks = JSON.parse(
	readFileSync(`${inputDirectory}/symlinks.json`, "utf-8"),
) as Record<LibretroThumbnailsRepository, Record<string, string>>;

const entries = repositories.flatMap((repository) =>
	parseLibretroThumbnailsTree(
		repository,
		JSON.parse(
			readFileSync(`${inputDirectory}/${repository}.json`, "utf-8"),
		) as GitTree,
		symlinks[repository],
	),
);

writeFileSync(outputPath, JSON.stringify(entries, null, "\t") + "\n");
console.log(`Wrote ${entries.length} entries to ${outputPath}`);
