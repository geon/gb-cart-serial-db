import { readFileSync, writeFileSync } from "fs";
import { JSDOM } from "jsdom";
import type { Cartridge } from "../src/Cartridge.js";

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

function isDefined<T>(x: T | undefined | null): x is T {
	return x !== undefined && x !== null;
}

function main() {
	const inputPaths = ["dmg", "cgb", "agb"].map(
		(platform) => `assets/no-intro.org/${platform}.xml`,
	);

	const cartridges = inputPaths.flatMap((inputPath) => {
		console.log(inputPath);
		const dom = new JSDOM(readFileSync(inputPath, { encoding: "utf-8" }));
		console.log(dom);
		const cartridges = [
			...(dom.window.document
				.querySelector("datafile")
				?.querySelectorAll("game") ?? []),
		]
			.map((game): Cartridge | undefined => {
				const serials = [...(game.querySelectorAll("serials") ?? [])]
					.map(
						(serial) =>
							serial.attributes.getNamedItem("media_serial1")?.nodeValue,
					)
					.filter(isDefined);

				const code = serials[0];

				const archive = game.querySelector("archive")?.attributes;
				if (!archive) {
					throw new Error("Missing archive.");
				}

				// name region languages
				const title = archive.getNamedItem("name")?.textContent;

				console.log(title);
				return (
					(code &&
						title && {
							code,
							title,
						}) ||
					undefined
				);
			})
			.filter(isDefined);

		return cartridges;
	});

	const jsonPath = "public/cartridges.json";
	writeFileSync(jsonPath, JSON.stringify(cartridges, null, "\t"));
	console.log("done");
}

main();
