import { readFileSync } from "node:fs";
import { parseLabelSerials } from "../serials.ts";
import { correctSerials, loadSerialCorrections } from "../corrections.ts";
import type { NoIntroEntry } from "../importers/no-intro.org/parse.ts";
import type { GameBoyDatabaseComEntry } from "../importers/game-boy-database.com/parse.ts";
import type { DmgpageEntry } from "../importers/dmgpage.com/parse.ts";
import type { GbhwdbCartridge } from "../importers/gbhwdb.gekkio.fi/parse.ts";
import type { GeonEntry } from "../importers/github.com-geon/parse.ts";

// Lists label serials from all sources that were corrected or fixed, are other publishers' codes, or were rejected,
// and region suffixes that are rare enough to be typos.

function load<T>(source: string): T[] {
	return JSON.parse(
		readFileSync(`data-sources/${source}.json`, "utf-8"),
	) as T[];
}

// GBxDumper is left out: its serials are built from the ROM header's game code, not read from labels.
const records: readonly {
	source: string;
	record?: string;
	serials: string[];
}[] = [
	...load<NoIntroEntry>("no-intro.org").map((entry) => ({
		source: "no-intro.org",
		record: entry.url,
		serials: entry.cartridgeSerials,
	})),
	...load<GameBoyDatabaseComEntry>("game-boy-database.com").map(
		({ url, serial }) => ({
			source: "game-boy-database.com",
			record: url,
			serials: [serial],
		}),
	),
	...load<DmgpageEntry>("dmgpage.com").map(({ code }) => ({
		source: "dmgpage.com",
		serials: [code],
	})),
	...load<GbhwdbCartridge>("gbhwdb.gekkio.fi").map(
		({ url, cartridgeSerial }) => ({
			source: "gbhwdb.gekkio.fi",
			record: url,
			serials: cartridgeSerial ? [cartridgeSerial] : [],
		}),
	),
	...load<GeonEntry>("github.com-geon").map(({ serial }) => ({
		source: "github.com-geon",
		serials: [serial],
	})),
];

const corrections = loadSerialCorrections();

const values = records.flatMap(({ source, record, serials }) =>
	correctSerials(
		corrections,
		source,
		record ?? "",
		"cartridgeSerials",
		serials,
	).map((raw) => ({
		source,
		raw,
	})),
);

const parsed = values.flatMap((value) =>
	parseLabelSerials(value.raw).map((result) => ({ ...value, result })),
);

const sources = [...new Set(values.map(({ source }) => source))];

function section(title: string, lines: readonly string[]) {
	const uniqueLines = [...new Set(lines)];
	console.log(`\n## ${title} (${uniqueLines.length})\n`);
	console.log(uniqueLines.map((line) => `  ${line}`).join("\n") || "  -");
}

console.log(
	`${values.length} label serials: ${["nintendo", "other", "rejected"]
		.map(
			(kind) =>
				`${parsed.filter(({ result }) => result.kind === kind).length} ${kind}`,
		)
		.join(", ")}`,
);

for (const source of sources) {
	const fromSource = parsed.filter((value) => value.source === source);
	console.log(`\n# ${source}`);
	section(
		"Fixed",
		fromSource.flatMap(({ raw, result }) =>
			result.kind === "nintendo" && result.fixes.length
				? [`${raw} -> ${result.serial} (${result.fixes.join(", ")})`]
				: [],
		),
	);
	section(
		"Other publishers' codes",
		fromSource.flatMap(({ result }) =>
			result.kind === "other" ? [result.serial] : [],
		),
	);
	section(
		"Rejected",
		fromSource.flatMap(({ raw, result }) =>
			result.kind === "rejected" ? [JSON.stringify(raw)] : [],
		),
	);
}

const regionSerials = parsed.flatMap(({ source, result }) =>
	result.kind === "nintendo" && result.region
		? [{ source, region: result.region, serial: result.serial }]
		: [],
);
const regions = [...new Set(regionSerials.map(({ region }) => region))];
console.log("\n# All sources");
section(
	"Rare regions (3 or fewer serials)",
	regions
		.map((region) => ({
			region,
			serials: regionSerials.filter((serial) => serial.region === region),
		}))
		.filter(({ serials }) => serials.length <= 3)
		.map(
			({ region, serials }) =>
				`${region}: ${serials.map(({ serial, source }) => `${serial} (${source})`).join(", ")}`,
		),
);

const unusedCorrections = corrections.filter(
	(correction) =>
		correction.field === "cartridgeSerials" &&
		!records.some(
			({ source, record, serials }) =>
				source === correction.source &&
				record === correction.record &&
				serials.includes(correction.wrong),
		),
);
section(
	"Corrections (raw-data-sources/corrections/serials.json)",
	corrections
		.filter(({ field }) => field === "cartridgeSerials")
		.map(
			({ source, title, wrong, correct }) =>
				`${source}: ${title}: ${wrong} -> ${correct ?? "(removed)"}`,
		),
);
section(
	"Unused corrections (no longer match their source)",
	unusedCorrections.map(
		({ source, title, wrong }) => `${source}: ${title}: ${wrong}`,
	),
);
