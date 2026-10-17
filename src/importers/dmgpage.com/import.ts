import { readFileSync, writeFileSync } from "node:fs";
import { parseDmgpageHtml } from "./parse.ts";

const inputPath =
	"raw-data-sources/dmgpage.com/dmg-codes-spielanleitungen-module.html";
const outputPath = "data-sources/dmgpage.com.json";

const entries = parseDmgpageHtml(readFileSync(inputPath, "utf-8"));

writeFileSync(outputPath, JSON.stringify(entries, null, "\t") + "\n");
console.log(`Wrote ${entries.length} entries to ${outputPath}`);
