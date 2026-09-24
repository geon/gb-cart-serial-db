import { readFileSync } from "fs";
import type { Cartridge } from "../../src/Cartridge.js";
import { parse } from "csv-pipe";

export function importGeon(): readonly Cartridge[] {
	const inputPath = "assets/geon.csv";
	const csvCartridges = parse<{
		serial: string;
		title: string;
	}>(readFileSync(inputPath, { encoding: "utf-8" }));

	const cartridges = csvCartridges.map(
		(row): Cartridge => ({
			code: row.serial,
			title: row.title,
		}),
	);

	return cartridges;
}
