import { readFileSync } from "fs";
import { parse } from "csv-pipe";
import type { Cartridge } from "../../src/Cartridge.js";
import type { CartridgesCsvRow } from "../CartridgesCsvRow.js";

export function importGbhwdb(): readonly Cartridge[] {
	const csvPath = "assets/gbhwdb-cartridges.csv";
	const csvCartridges = parse<CartridgesCsvRow>(
		readFileSync(csvPath, { encoding: "utf-8" }),
	);

	const cartridges = csvCartridges.map(
		(row): Cartridge => ({
			code: row.code,
			title: row.game_name,
		}),
	);

	return cartridges;
}
