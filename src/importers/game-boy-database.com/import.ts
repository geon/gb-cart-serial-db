import { readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import {
	gameBoyDatabaseComFullsets,
	parseGameBoyDatabaseComFullsetHtml,
	type GameBoyDatabaseComEntry,
} from "./parse.ts";

const inputDirectory = "raw-data-sources/game-boy-database.com";
const outputPath = "data-sources/game-boy-database.com.json";

const listings = gameBoyDatabaseComFullsets.flatMap((fullset) => {
	const html = readFileSync(`${inputDirectory}/${fullset}.html`, "utf-8");
	const entries = parseGameBoyDatabaseComFullsetHtml(html, fullset);
	// Sanity check that nothing was silently skipped.
	const boxCount = html.match(/<div class="images-box-fullset">/g)?.length;
	if (entries.length !== boxCount) {
		throw new Error(
			`${fullset}: parsed ${entries.length} of ${boxCount} entries`,
		);
	}
	return entries;
});

const ids = [...new Set(listings.map(({ id }) => id))].sort((a, b) => a - b);

const entries = ids.map((id) =>
	mergeListings(listings.filter((listing) => listing.id === id)),
);

// An entry listed on several fullset pages; the listings should be identical apart from the page.
function mergeListings(
	listings: readonly GameBoyDatabaseComEntry[],
): GameBoyDatabaseComEntry {
	const [first, ...others] = listings;
	const conflicting = others.filter(
		(other) =>
			!isDeepStrictEqual(
				{ ...first, fullsets: [] },
				{ ...other, fullsets: [] },
			),
	);
	if (!first || conflicting.length) {
		throw new Error(`Conflicting listings: ${JSON.stringify(listings)}`);
	}
	return { ...first, fullsets: listings.flatMap(({ fullsets }) => fullsets) };
}

writeFileSync(outputPath, JSON.stringify(entries, null, "\t") + "\n");
console.log(`Wrote ${entries.length} entries to ${outputPath}`);
