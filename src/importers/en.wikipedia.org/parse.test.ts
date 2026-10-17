import { describe, expect, test } from "vitest";
import { parseDate, parseWikipediaHtml } from "./parse.ts";

const ref =
	'<sup class="mw-ref reference"><a href="#cite_note-1">[1]</a></sup>';

function page(header: string, ...rows: string[]) {
	return `<table class="wikitable"><tr><td>Not the game table</td></tr></table>
		<table class="wikitable">${header}${rows.map((row) => `<tr>${row}</tr>`).join("")}</table>`;
}

test("parseDate", () => {
	expect(parseDate("December 6, 2000")).toBe("2000-12-06");
	expect(parseDate("April 1995")).toBe("1995-04");
	expect(parseDate("2002")).toBe("2002");
	expect(() => parseDate("Q3 1995")).toThrow();
});

describe("parseWikipediaHtml", () => {
	test("reads the Game Boy list's date columns", () => {
		const html = page(
			`<tr><th rowspan="2">Title</th><th rowspan="2">Developer(s)</th><th rowspan="2">Publisher(s)</th><th colspan="3">Release date</th></tr>
			<tr><th>Japan${ref}</th><th>North America</th><th>PAL region</th></tr>`,
			`<td><i><a href="https://en.wikipedia.org/wiki/Adventure_Island_II">Adventure Island</a></i><br>• <i>Takahashi Meijin no Boken Jima II</i> <sup>JP</sup></td>
			<td>Hudson Soft</td><td>Hudson Soft</td>
			<td><span data-sort-value="000000001992-03-06-0000">March 6, 1992</span>${ref}</td>
			<td>February 1992</td><td class="table-na">Unreleased</td>`,
			`<td><i>3-Pun Yosō Umaban Club</i></td><td>Hect</td><td>Hect</td><td>October 16, 1992</td><td>Cancelled</td><td></td>`,
		);
		expect(parseWikipediaHtml("dmg", html)).toEqual([
			{
				list: "dmg",
				titles: [
					{ title: "Adventure Island", regions: [] },
					{ title: "Takahashi Meijin no Boken Jima II", regions: ["JP"] },
				],
				articleUrl: "https://en.wikipedia.org/wiki/Adventure_Island_II",
				releaseDates: [
					{ region: "JP", date: "1992-03-06" },
					{ region: "NA", date: "1992-02" },
				],
			},
			{
				list: "dmg",
				titles: [{ title: "3-Pun Yosō Umaban Club", regions: [] }],
				releaseDates: [{ region: "JP", date: "1992-10-16" }],
			},
		]);
	});

	test("reads the Game Boy Advance list's dates with regions", () => {
		const html = page(
			`<tr><th rowspan="2">Title(s)</th><th rowspan="2">Developer(s)</th><th rowspan="2">Publisher(s)</th><th rowspan="2">Release date(s)</th><th colspan="5">Region(s) released</th></tr>
			<tr><th>JP</th><th>NA</th><th>EU/PAL</th><th>AU</th><th>KOR</th></tr>`,
			`<th scope="row"><i><a href="https://en.wikipedia.org/wiki/007">007: Everything or Nothing</a></i> <sup>NA,&nbsp;PAL</sup><br>•&nbsp;<i>007: Alles oder Nichts</i> <sup>DE</sup></th>
			<td>Griptonite Games</td><td>Electronic Arts</td>
			<td><span><span style="display:none">200311</span><span style="display:none">20031121</span>November 21, 2003<small>&nbsp;(NA)</small></span><br><span>December 2003<small>&nbsp;(PAL, AU)</small></span><br><span>Cancelled<small>&nbsp;(JP)</small></span></td>
			<td></td><td></td><td></td><td>?</td><td>?</td>`,
			`<th scope="row"><i>Earthworm Jim 2</i></th><td></td><td></td><td>2002</td><td></td><td></td><td></td><td></td><td></td>`,
		);
		expect(parseWikipediaHtml("agb", html)).toEqual([
			{
				list: "agb",
				titles: [
					{ title: "007: Everything or Nothing", regions: ["NA", "PAL"] },
					{ title: "007: Alles oder Nichts", regions: ["DE"] },
				],
				articleUrl: "https://en.wikipedia.org/wiki/007",
				releaseDates: [
					{ region: "NA", date: "2003-11-21" },
					{ region: "PAL", date: "2003-12" },
					{ region: "AU", date: "2003-12" },
				],
			},
			{
				list: "agb",
				titles: [{ title: "Earthworm Jim 2", regions: [] }],
				releaseDates: [{ date: "2002" }],
			},
		]);
	});

	test("reads the Game Boy Color list's date column", () => {
		const html = page(
			`<tr><th>Title</th><th>Dual Mode</th><th>Cartridge feature</th><th>Developer</th><th>Publisher</th><th>First released</th><th>JP</th><th>NA</th><th>EU/PAL</th></tr>`,
			`<td><i>1942</i></td><td>No</td><td>N/a</td><td>Digital Eclipse</td><td>Capcom</td>
			<td><span>April 1, 2000<small>&nbsp;(NA/EU)</small></span></td><td></td><td></td><td></td>`,
		);
		expect(parseWikipediaHtml("cgb", html)).toEqual([
			{
				list: "cgb",
				titles: [{ title: "1942", regions: [] }],
				releaseDates: [
					{ region: "NA", date: "2000-04-01" },
					{ region: "EU", date: "2000-04-01" },
				],
			},
		]);
	});
});
