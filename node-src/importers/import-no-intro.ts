import { readFileSync } from "fs";
import { parse, type TNode } from "txml";
import type { Cartridge } from "../../src/Cartridge.js";

function isDefined<T>(x: T | undefined | null): x is T {
	return x !== undefined && x !== null;
}

export function importNoIntro(): readonly Cartridge[] {
	const inputPaths = ["dmg", "cgb", "agb"].map(
		(platform) => `assets/no-intro.org/${platform}.xml`,
	);

	const cartridges = inputPaths.flatMap((inputPath): readonly Cartridge[] => {
		const result = parse(readFileSync(inputPath, { encoding: "utf-8" }));
		const cartridges =
			result
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
								typeof node === "object" &&
								(node.tagName === "source" || node.tagName === "release"),
						)
						.map(
							(source) =>
								source.children.find(
									(node): node is TNode =>
										typeof node === "object" && node.tagName === "serials",
								)?.attributes.media_serial1,
						)
						.filter(isDefined);

					// if (game.attributes.name?.[0] === "G") {
					// 	console.log(game);
					// }

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

					return (
						(code &&
							title && {
								code,
								title,
							}) ||
						undefined
					);
				})
				.filter(isDefined) ?? [];

		return cartridges;
	});

	return cartridges;
}
