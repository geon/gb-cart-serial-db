import { readFileSync, writeFileSync } from "node:fs";
import { noIntroDats, parseNoIntroXml, type NoIntroDat } from "./parse.ts";

const inputDirectory = "raw-data-sources/no-intro.org";
const outputPath = "data-sources/no-intro.org.json";

const dats = Object.keys(noIntroDats) as NoIntroDat[];

const entries = dats.flatMap((dat) =>
	parseNoIntroXml(readFileSync(`${inputDirectory}/${dat}.xml`, "utf-8"), dat),
);

writeFileSync(outputPath, JSON.stringify(entries, null, "\t") + "\n");
console.log(`Wrote ${entries.length} entries to ${outputPath}`);
