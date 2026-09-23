import { readFileSync } from "fs";
import { JSDOM } from "jsdom";
import type { Cartridge } from "../../src/Cartridge.js";

export function importSprintinglegs(): readonly Cartridge[] {
	const inputPaths = ["agb", "cgb", "dmg"].map(
		(platform) => `assets/sprintinglegs/${platform}.html`,
	);

	const cartridges = inputPaths.flatMap((inputPath) => {
		const dom = new JSDOM(readFileSync(inputPath, { encoding: "utf-8" }));
		const cartridges = [
			...dom.window.document.querySelectorAll("div._item.row.game"),
		].map((div): Cartridge => {
			const code = div.querySelector("div._gamedmg")?.textContent;
			if (!code) {
				throw new Error(`Missing code`);
			}

			const title =
				div.querySelector("div._gamename")?.childNodes?.[0].nodeValue;
			if (!(title && typeof title === "string")) {
				throw new Error(`Missing title in ${div.innerHTML}`);
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
