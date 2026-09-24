import { readFileSync } from "fs";
import { parse, type TNode } from "txml";
import type { Cartridge } from "../../src/Cartridge.js";
import { isDefined } from "../../src/is-defined.js";

const nameAttributePattern = /[^(]+/;

export function importNoIntro(): readonly Cartridge[] {
	const platforms = ["dmg", "cgb", "agb"];
	const platformUpperCaseSet = new Set(platforms.map((x) => x.toUpperCase()));

	const cartridges = platforms.flatMap((platform): readonly Cartridge[] => {
		const inputPath = `assets/no-intro.org/${platform}.xml`;

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
				.flatMap((game): Cartridge[] => {
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
						.filter(isDefined)
						.filter((code) => platformUpperCaseSet.has(code.slice(0, 3)));

					const archive = game.children.find(
						(node): node is TNode =>
							typeof node === "object" && node.tagName === "archive",
					);
					if (!archive) {
						throw new Error("Missing archive.");
					}

					// Contains more stuff.
					// name (tag1) (tag2)
					const attribute = archive.attributes.name;
					if (!attribute) {
						throw new Error("Missing attribute.");
					}

					const match = attribute.match(nameAttributePattern);
					const title = match && match[0]?.trimEnd().replace("&amp;", "&");
					if (!title) {
						throw new Error(`Missing title in ${attribute}`);
					}

					return serials.map((code) => ({
						code,
						title,
					}));
				}) ?? [];

		return cartridges;
	});

	return cartridges;
}
