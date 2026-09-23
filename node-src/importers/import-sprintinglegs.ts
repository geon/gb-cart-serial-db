import { readFileSync } from "fs";
import { JSDOM } from "jsdom";
import type { Cartridge } from "../../src/Cartridge.js";

const codePattern = /game-([\w\d]+)-\d+-([\w-]+)\.html/;

export function importSprintinglegs(): readonly Cartridge[] {
	const inputPaths = ["agb", "cgb", "dmg"].map(
		(platform) => `assets/sprintinglegs/${platform}.html`,
	);

	const cartridges = inputPaths.flatMap((inputPath) => {
		const dom = new JSDOM(readFileSync(inputPath, { encoding: "utf-8" }));
		const cartridges = [
			...(dom.window.document
				.querySelector("main")
				?.children[1].querySelectorAll("div.images-box-fullset") ?? []),
		].map((div): Cartridge => {
			const href = div
				.querySelector("a")
				?.attributes.getNamedItem("href")?.nodeValue;
			if (!href) {
				throw new Error(`No href in ${div.outerHTML}`);
			}

			const matches = href.replace("%20", "").match(codePattern);
			if (!(matches && matches[0] && matches[2])) {
				throw new Error(`No matches in ${href}`);
			}

			const code = `DMG-${matches[1]}-${matches[2]}`;

			const title = div
				.querySelector("p.game-title")
				?.textContent.replace("&amp;", "&");

			if (!title) {
				throw new Error("Missing title");
			}

			return {
				title,
				code,
			};
		});

		return cartridges;
	});

	return cartridges;
}
