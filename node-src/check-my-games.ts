import { readFileSync } from "fs";
import type { Cartridge } from "../src/Cartridge.js";
import _cartridges from "../public/cartridges.json";

function main() {
	const myGamesPath = "assets/my-games.txt";
	const myGames = new Set(
		readFileSync(myGamesPath, { encoding: "utf-8" })
			.split("\n")
			.filter((x) => x),
	);

	const cartridges = _cartridges as readonly Cartridge[];
	const cartridgeCodes = new Set(cartridges.map((x) => x.code));

	const verified = cartridges.filter((x) => myGames.has(x.code));
	const unrecognized = [...myGames].filter((x) => !cartridgeCodes.has(x));

	console.log("verified", verified);
	console.log("unrecognized", unrecognized);
	console.log("cartridges", cartridges.length);
	console.log("verified", verified.length);
	console.log("unrecognized", unrecognized.length);
}

main();
