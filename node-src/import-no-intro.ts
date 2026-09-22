import { readFileSync, writeFileSync } from "fs";
import { parse, type TNode } from "txml";
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

		const result = parse(readFileSync(inputPath, { encoding: "utf-8" }));
		const cartridges = result
			.find(
				(node): node is TNode =>
					typeof node === "object" && node.tagName === "datafile",
			)
			?.children.filter(
				(node): node is TNode =>
					typeof node === "object" && node.tagName === "game",
			)
			.map((game): Cartridge | undefined => {
				const serials = game.children
					.filter(
						(node): node is TNode =>
							typeof node === "object" && node.tagName === "source",
					)
					.map(
						(source) =>
							source.children.find(
								(node): node is TNode =>
									typeof node === "object" && node.tagName === "serials",
							)?.attributes.media_serial1,
					)
					.filter(isDefined);
				// console.log(serials);

				const code = serials[0];

				const archive = game.children.find(
					(node): node is TNode =>
						typeof node === "object" && node.tagName === "archive",
				);
				if (!archive) {
					throw new Error("Missing archive.");
				}

				// name region languages
				const title = archive.attributes.name;

				// console.log(title);
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
