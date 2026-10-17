import { readFileSync, writeFileSync } from "node:fs";
import { parseWikipediaHtml } from "./parse.ts";

const outputPath = "data-sources/en.wikipedia.org.json";

const entries = (["dmg", "cgb", "agb"] as const).flatMap((list) =>
	parseWikipediaHtml(
		list,
		readFileSync(`raw-data-sources/en.wikipedia.org/${list}.html`, "utf-8"),
	),
);

writeFileSync(outputPath, JSON.stringify(entries, null, "\t") + "\n");
console.log(`Wrote ${entries.length} entries to ${outputPath}`);
