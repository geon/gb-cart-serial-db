import { readFileSync } from "fs";
import type { Cartridge } from "../src/Cartridge.js";
import _cartridges from "../public/cartridges.json";

function main() {
	const tsvPath = "assets/cartridges.tsv";
	const tsvGames = readFileSync(tsvPath, { encoding: "utf-8" })
		.split("\n")
		.filter((x) => x)
		.map((line): Cartridge => {
			const [title, code] = line.split("\t");
			return {
				code,
				title,
			};
		});
	const _tsvGames = new Set(tsvGames.map((x) => x.code));

	const cartridges = _cartridges as readonly Cartridge[];
	const cartridgeCodes = new Set(cartridges.map((x) => x.code));

	const verified = cartridges.filter((x) => _tsvGames.has(x.code));
	const unrecognized = [..._tsvGames].filter((x) => !cartridgeCodes.has(x));

	console.log("verified", verified);
	console.log("unrecognized", unrecognized);
	console.log("cartridges", cartridges.length);
	console.log("verified", verified.length);
	console.log("unrecognized", unrecognized.length);
}

main();
