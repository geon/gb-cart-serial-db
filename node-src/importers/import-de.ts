import { readFileSync } from "fs";
import type { Cartridge } from "../../src/Cartridge.js";

export function importDe(): readonly Cartridge[] {
	const inputPath = "assets/de.txt";
	const cartridges = readFileSync(inputPath, { encoding: "utf-8" })
		.split("\n")
		.filter((x) => x)
		.map((line): Cartridge => {
			const splitIndex = line.indexOf(" ");
			const code = line.slice(0, splitIndex);
			const title = line.slice(splitIndex + 2, -1);
			return {
				code,
				title,
			};
		});

	return cartridges;
}
