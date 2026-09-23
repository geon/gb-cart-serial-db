import { readFileSync } from "fs";
import { parse } from "csv-pipe";
import type { Cartridge } from "../../src/Cartridge.js";

export function importGbxDumper(): readonly Cartridge[] {
	const csvPath = "assets/GBxDumper.gbalist.csv";
	const csvCartridges = parse<{
		"Internal name": string;
		Serial: string;
		"ROM size (MBit)": string;
		Complement: string;
		CRC32: string;
		"Memory type": string;
		"RAM size (KBit) ": string;
	}>(readFileSync(csvPath, { encoding: "utf-8" }));

	const cartridges = csvCartridges.map(
		(row): Cartridge => ({
			code: row.Serial,
			title: row["Internal name"],
		}),
	);

	return cartridges;
}
