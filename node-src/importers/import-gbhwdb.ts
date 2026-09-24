import { readFileSync } from "fs";
import { parse } from "csv-pipe";
import type { Cartridge } from "../../src/Cartridge.js";
import type { CartridgesCsvRow } from "../CartridgesCsvRow.js";
import { isDefined } from "../../src/is-defined.js";

const namePattern = /[^(]+/;

export function importGbhwdb(): readonly Cartridge[] {
	const csvPath = "assets/gbhwdb-cartridges.csv";
	const csvCartridges = parse<CartridgesCsvRow>(
		readFileSync(csvPath, { encoding: "utf-8" }),
	);

	const cartridges = csvCartridges
		.map((row): Cartridge | undefined => {
			const title = row.game_name.match(namePattern)?.[0].trimEnd();
			return !(row.code && title)
				? undefined
				: {
						code: row.code,
						title,
					};
		})
		.filter(isDefined);

	return cartridges;
}
