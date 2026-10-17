import { readFileSync, writeFileSync } from "node:fs";
import {
	parseSprintinglegsHtml,
	repairHtml,
	type SprintinglegsList,
} from "./parse.ts";

const inputDirectory = "raw-data-sources/sprintinglegs";
const outputPath = "data-sources/sprintinglegs.json";

const lists: readonly SprintinglegsList[] = ["dmg", "cgb", "agb"];

const entries = lists
	.flatMap((list) => {
		const html = readFileSync(`${inputDirectory}/${list}.html`, "utf-8");
		const entries = parseSprintinglegsHtml(html, list);
		// Sanity check that nothing was silently skipped.
		const rowCount = repairHtml(html).match(/class="_item row game"/g)?.length;
		if (entries.length !== rowCount) {
			throw new Error(`${list}: parsed ${entries.length} of ${rowCount} rows`);
		}
		return entries;
	})
	.sort((a, b) => a.id - b.id);

const duplicateIds = entries.filter(
	(entry, i) => entry.id === entries[i - 1]?.id,
);
if (duplicateIds.length) {
	throw new Error(`Duplicate ids: ${duplicateIds.map((x) => x.id)}`);
}

writeFileSync(outputPath, JSON.stringify(entries, null, "\t") + "\n");
console.log(`Wrote ${entries.length} entries to ${outputPath}`);
