import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseGbhwdbCsv } from "./parse.ts";

// The header and first row of the real export.
const [header, firstRow] = readFileSync(
	"raw-data-sources/gbhwdb.gekkio.fi/cartridges.csv",
	"utf-8",
).split("\n") as [string, string];

function csv(...rows: string[]) {
	return [header, ...rows].join("\n") + "\n";
}

// Replaces the value in a column, by position, in a row with no quoted commas after it.
function withValue(row: string, column: number, value: string) {
	const prefix = row.slice(0, row.indexOf('",') + 2);
	const rest = row.slice(prefix.length).split(",");
	rest[column - 6] = value;
	return prefix + rest.join(",");
}

describe("parseGbhwdbCsv", () => {
	test("parses a cartridge", () => {
		expect(parseGbhwdbCsv(csv(firstRow))).toEqual([
			{
				url: "https://gbhwdb.gekkio.fi/cartridges/AGB-A2CP-0/3615retro-1.html",
				romChipSerial: "AGB-A2CP-0",
				cartridgeSerial: "AGB-A2CP-EUR",
				noIntroName: "Castlevania - Aria of Sorrow (Europe) (En,Fr,De)",
				boardDate: { year: 2003, month: 3 },
				romChipDate: { year: 2003, week: 12 },
				crc32: "d0c91f74",
			},
		]);
	});

	test("leaves out missing values", () => {
		// Columns 6: label code, 12-13: board year and month.
		const row = withValue(
			withValue(withValue(firstRow, 6, ""), 12, ""),
			13,
			"",
		);
		const [cartridge] = parseGbhwdbCsv(csv(row));
		expect(cartridge).not.toHaveProperty("cartridgeSerial");
		expect(cartridge).not.toHaveProperty("boardDate");
	});

	test("throws on unexpected content", () => {
		expect(() =>
			parseGbhwdbCsv(csv(withValue(firstRow, 13, "Marchember"))),
		).toThrow();
		expect(() => parseGbhwdbCsv(csv(withValue(firstRow, 15, "RAM")))).toThrow();
		expect(() => parseGbhwdbCsv(csv(firstRow + ",extra"))).toThrow();
		expect(() =>
			parseGbhwdbCsv(header.replace("game_name", "name") + "\n" + firstRow),
		).toThrow();
	});
});
