import { readFileSync, writeFileSync } from "node:fs";
import { parseGeonCsv } from "./parse.ts";

const inputPath = "raw-data-sources/github.com-geon/collection.csv";
const outputPath = "data-sources/github.com-geon.json";

const entries = parseGeonCsv(readFileSync(inputPath, "utf-8"));

writeFileSync(outputPath, JSON.stringify(entries, null, "\t") + "\n");
console.log(`Wrote ${entries.length} entries to ${outputPath}`);
