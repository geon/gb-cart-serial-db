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

const codePattern = /game-([\w\d]+)-\d+-([\w-]+)\.html/;

function main() {
	const htmlPath =
		"assets/Game Boy Database - Fullset (NOE, NOE-1, NOE-2, NOE-3, NOE-4, NOE-5, NNOE, NNOE-1).html";
	const dom = new JSDOM(readFileSync(htmlPath, { encoding: "utf-8" }));
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

		const matches = href.match(codePattern);
		if (!(matches && matches[0] && matches[2])) {
			throw new Error(`No matches in ${href}`);
		}

		const code = `DMG-${matches[1]}-${matches[2]}`;

		const title = div.querySelector("p.game-title")?.textContent;

		if (!title) {
			throw new Error("Missing title");
		}

		return {
			title,
			code,
		};
	});

	const jsonPath = "public/cartridges.json";
	writeFileSync(jsonPath, JSON.stringify(cartridges, null, "\t"));
}

main();
