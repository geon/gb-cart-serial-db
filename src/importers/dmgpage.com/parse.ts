import { JSDOM } from "jsdom";

// One line of the list in the blog post "DMG-Codes: Spielanleitungen/Module" at
// https://dmgpage.com/2014/11/28/dmg-codes-spielanleitungenmodule/, listing codes printed on manuals and cartridges.
export type DmgpageEntry = {
	/** As printed, e.g. "DMG-F4-NOE-1", "DMG-P-ACNP-NEU5". Some have a "G-" or "G/" prefix, e.g. "G-DMG-LO-NOE", "G/DMG-YK-NOE-1"; all of them are Super Game Boy compatible games, so it is probably the code of the Super Game Boy manual, but the page doesn't say. */
	code: string;
	/** e.g. "4-in-1 Funpak" */
	title: string;
	/** Languages/countries as abbreviated on the page, e.g. ["UK", "GER", "FR"], ["US"]. */
	regions: string[];
	/** Marked with an orange asterisk: "abwärtskompatible Game Boy Color Spiele". */
	gameBoyColorCompatible: boolean;
	/** Marked with a green asterisk: "besitzen auch Super Game Boy Spielanleitungen". */
	hasSuperGameBoyManual: boolean;
};

const starColors = {
	"#ff6600": "orange",
	"#00ff00": "green",
} as const;

const linePattern =
	/^((?:[A-Z][-/])?(?:DMG|CGB)-[A-Z0-9-]+?) ?\((.+), ([A-Z]+(?:\/[A-Z]+)*)\)((?:\{(?:orange|green)\})*)$/;
// Letter headings, e.g. "A", "0-9".
const headingPattern = /^(?:[A-Z]|0-9)$/;

export function parseDmgpageHtml(html: string): DmgpageEntry[] {
	const document = new JSDOM(html).window.document;
	const content = document.querySelector("div.entry-content");
	if (!content) {
		throw new Error("Missing post content");
	}
	const paragraphs = [...content.querySelectorAll("p")];
	const headingIndex = paragraphs.findIndex(
		(paragraph) => paragraph.textContent?.trim() === "Spielanleitungen/Module",
	);
	if (headingIndex === -1) {
		throw new Error('Missing heading "Spielanleitungen/Module"');
	}
	const lines = paragraphs
		.slice(headingIndex + 1)
		.map(paragraphText)
		.filter((text) => /(?:DMG|CGB)-/.test(text))
		.flatMap((text) => text.split("\n"))
		.map((line) => line.replace(/\s+/g, " ").trim())
		.filter((line) => line && !headingPattern.test(line));

	return lines.map(parseLine);
}

// Text with line breaks, and asterisks replaced by their color, e.g. "{orange}".
function paragraphText(paragraph: Element): string {
	return [...paragraph.childNodes].map(nodeText).join("");
}

function nodeText(node: Node): string {
	if (node.nodeName === "BR") {
		return "\n";
	}
	if (node.nodeType === node.TEXT_NODE) {
		const text = node.textContent ?? "";
		if (text.trim() !== "*") {
			return text;
		}
		const color = node.parentElement
			?.closest("span[style]")
			?.getAttribute("style")
			?.match(/color:(#[0-9a-f]{6})/)?.[1];
		const starColor = starColors[color as keyof typeof starColors];
		if (!starColor) {
			throw new Error(`Asterisk with unexpected color: ${color}`);
		}
		return `{${starColor}}`;
	}
	return [...node.childNodes].map(nodeText).join("");
}

function parseLine(line: string): DmgpageEntry {
	const [, code, title, regions, stars] = line.match(linePattern) ?? [];
	if (!(code && title && regions && stars !== undefined)) {
		throw new Error(`Unexpected line: ${line}`);
	}
	return {
		code,
		title: title.trim(),
		regions: regions.split("/"),
		gameBoyColorCompatible: stars.includes("{orange}"),
		hasSuperGameBoyManual: stars.includes("{green}"),
	};
}
