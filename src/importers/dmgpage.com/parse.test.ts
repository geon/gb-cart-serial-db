import { describe, expect, test } from "vitest";
import { parseDmgpageHtml } from "./parse.ts";

const orange = '<strong><span style="color:#ff6600">*</span></strong>';
const green = '<span style="color:#00ff00">*</span>';

function page(...paragraphs: string[]) {
	return `<div class="entry-content">
		<p>Druckerzeugnisse von Nintendo besitzen in der Regel einen eindeutigen DMG-Code.</p>
		<p><strong>Spielanleitungen/Module</strong></p>
		${paragraphs.map((paragraph) => `<p class="wp-block-paragraph">${paragraph}</p>`).join("")}
	</div>`;
}

describe("parseDmgpageHtml", () => {
	test("parses entries, skipping intro and letter headings", () => {
		const html = page(
			`<strong><span style="color:#ff6600">0-9<br></span>DMG-F4-NOE-1</strong>&nbsp;(4-in-1 Funpak, GER)`,
			[
				`<span style="color:#ff6600"><strong>A</strong></span>`,
				`<strong>DMG-APXP-EUR</strong> (a bug&#8217;s life, UK/GER)${orange}`,
				`<strong>G-DMG-LO-NOE </strong>(Adventures of Lolo, GER)${green}`,
				`<strong>DMG-OB-</strong><strong>NOE-1</strong>&nbsp;(Raging Fighter, GER)`,
				`<strong>G/DMG-YK-NOE-1</strong> (Soccer, GER)`,
				`<strong>DMG-QT-USA</strong> (Q*bert, US)`,
			].join("<br>"),
		);

		expect(parseDmgpageHtml(html)).toEqual([
			{
				code: "DMG-F4-NOE-1",
				title: "4-in-1 Funpak",
				regions: ["GER"],
				gameBoyColorCompatible: false,
				hasSuperGameBoyManual: false,
			},
			{
				code: "DMG-APXP-EUR",
				title: "a bug’s life",
				regions: ["UK", "GER"],
				gameBoyColorCompatible: true,
				hasSuperGameBoyManual: false,
			},
			{
				code: "G-DMG-LO-NOE",
				title: "Adventures of Lolo",
				regions: ["GER"],
				gameBoyColorCompatible: false,
				hasSuperGameBoyManual: true,
			},
			{
				code: "DMG-OB-NOE-1",
				title: "Raging Fighter",
				regions: ["GER"],
				gameBoyColorCompatible: false,
				hasSuperGameBoyManual: false,
			},
			{
				code: "G/DMG-YK-NOE-1",
				title: "Soccer",
				regions: ["GER"],
				gameBoyColorCompatible: false,
				hasSuperGameBoyManual: false,
			},
			{
				code: "DMG-QT-USA",
				title: "Q*bert",
				regions: ["US"],
				gameBoyColorCompatible: false,
				hasSuperGameBoyManual: false,
			},
		]);
	});

	test("throws on unexpected content", () => {
		const variants = [
			`<strong>DMG-AW-NOE</strong> Alleyway`,
			`<strong>DMG-AW-NOE</strong> (Alleyway, GER)<span style="color:#0000ff">*</span>`,
		];
		for (const variant of variants) {
			expect(() => parseDmgpageHtml(page(variant))).toThrow();
		}
		expect(() =>
			parseDmgpageHtml("<div class='entry-content'></div>"),
		).toThrow();
	});
});
