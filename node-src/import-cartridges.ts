import { readFileSync, writeFileSync } from "fs";
import { parse } from "csv-pipe";
import type { Cartridge } from "../src/Cartridge.js";
import type { CartridgesCsvRow } from "./CartridgesCsvRow.js";

export function uniqueBy<T>(
	array: readonly T[],
	keySelector: (element: T) => string | number,
): T[] {
	const seen = new Set();
	return array.filter((element) => {
		const key = keySelector(element);
		const unseen = !seen.has(key);
		seen.add(key);
		return unseen;
	});
}

function main() {
	const csvPath = "assets/cartridges.csv";
	const csvCartridges = parse<CartridgesCsvRow>(
		readFileSync(csvPath, { encoding: "utf-8" }),
	);

	const cartridges = uniqueBy(csvCartridges, (x) => x.code).map(
		(row): Cartridge => ({
			code: row.code,
			title: row.game_name,
		}),
	);

	const jsonPath = "public/cartridges.json";
	writeFileSync(jsonPath, JSON.stringify(cartridges, null, "\t"));
}

main();
