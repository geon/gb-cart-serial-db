import { readFileSync, writeFileSync } from "node:fs";
import { parseGbxDumperCsv } from "./parse.ts";

const inputPath = "raw-data-sources/github.com-mstroh76-GBxDumper/gbalist.csv";
const outputPath = "data-sources/github.com-mstroh76-GBxDumper.json";

const entries = parseGbxDumperCsv(readFileSync(inputPath, "ascii"));

writeFileSync(outputPath, JSON.stringify(entries, null, "\t") + "\n");
console.log(`Wrote ${entries.length} entries to ${outputPath}`);
