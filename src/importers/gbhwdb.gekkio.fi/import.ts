import { readFileSync, writeFileSync } from "node:fs";
import { parseGbhwdbCsv } from "./parse.ts";

const inputPath = "raw-data-sources/gbhwdb.gekkio.fi/cartridges.csv";
const outputPath = "data-sources/gbhwdb.gekkio.fi.json";

const cartridges = parseGbhwdbCsv(readFileSync(inputPath, "utf-8"));

writeFileSync(outputPath, JSON.stringify(cartridges, null, "\t") + "\n");
console.log(`Wrote ${cartridges.length} cartridges to ${outputPath}`);
