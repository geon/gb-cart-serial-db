import { JSDOM } from "jsdom";

// A row of the game tables in Wikipedia's lists of Game Boy, Game Boy Color and Game Boy Advance games.
export type WikipediaEntry = {
	/** The list the row is in. */
	list: "dmg" | "cgb" | "agb";
	/** The titles in the row, with the regions they are written for, e.g. [{ title: "007: Quitte ou Double", regions: ["FR"] }]. The regions are empty when the row doesn't say. */
	titles: { title: string; regions: string[] }[];
	/** The article of the game, when the title is linked. Links to a section of another article are kept, e.g. "https://en.wikipedia.org/wiki/Tama_and_Friends#Video_games". */
	articleUrl?: string;
	/** With the regions they are credited for, e.g. [{ name: "Interplay", regions: ["NA", "EU"] }, { name: "Imagineer", regions: ["JP"] }]. Empty if the cell is. */
	developers: Credit[];
	publishers: Credit[];
	/** As written in the row, e.g. { region: "JP", date: "1994-08-05" }. The date is as exact as the source: "1995-04" for "April 1995", "2002" for "2002". A few dates have no region. */
	releaseDates: { region?: string; date: string }[];
	/** The Game Boy Color list's "Dual Mode" column, whether the cartridge also runs on the original Game Boy, as written, e.g. "Yes", "No", "Yes (JP only)". */
	dualMode?: string;
	/** The Game Boy Color list's "Cartridge feature" column, e.g. "Rumble Pak", "Real-time clock". Omitted for "N/a". */
	cartridgeFeature?: string;
	/** The Game Boy Color and Advance lists' check marks for the regions it was released in, by column, e.g. { region: "EU/PAL", released: "yes" }. The Advance list has "unknown" for many Australian and Korean releases. */
	regionsReleased?: { region: string; released: "yes" | "no" | "unknown" }[];
};

export type Credit = { name: string; regions: string[] };

const months = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

// "December 6, 2000" as "2000-12-06", "April 1995" as "1995-04", "2002" as "2002".
export function parseDate(text: string): string {
	const [, month, day, year] =
		text.match(/^(?:([A-Z][a-z]+) (?:(\d{1,2}), )?)?(\d{4})$/) ?? [];
	const monthNumber =
		month === undefined ? undefined : months.indexOf(month) + 1;
	if (year === undefined || monthNumber === 0) {
		throw new Error(`Unexpected date: ${text}`);
	}
	return [
		year,
		...(monthNumber === undefined
			? []
			: [String(monthNumber).padStart(2, "0")]),
		...(day === undefined ? [] : [day.padStart(2, "0")]),
	].join("-");
}

// Text of a cell without footnote references and hidden sort keys, with line breaks and paragraphs as "\n".
function cellText(cell: Element): string {
	const clone = cell.cloneNode(true) as Element;
	clone
		.querySelectorAll(
			"sup.reference, .mw-ref, span[style*='display:none'], style",
		)
		.forEach((element) => element.remove());
	clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
	clone.querySelectorAll("p").forEach((paragraph) => paragraph.before("\n"));
	// Fractions, e.g. "1½" in "The Lion King 1½", as " 1⁄2".
	clone
		.querySelectorAll(".frac")
		.forEach((fraction) => fraction.replaceWith(` ${fraction.textContent}`));
	return (clone.textContent ?? "")
		.replace(/[ \t\u00a0]+/g, " ")
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line)
		.join("\n");
}

// A cell with a name per line, each optionally followed by its regions in superscript, e.g. the title
// "• 007: Alles oder Nichts DE", or the publisher "Viacom New Media NA/EU". Regions are separated by commas or slashes.
function namesWithRegions(cell: Element): Credit[] {
	const lines = cellText(cell)
		.split("\n")
		.filter((line) => line);
	const regionLines = [
		...cell.querySelectorAll("sup:not(.reference, .mw-ref)"),
	].map((sup) => cellText(sup));
	return lines.map((line) => {
		const text = line.replace(/^•\s*/, "");
		// Usually after a space, e.g. "Ubi Soft PAL", but not always, e.g. "CapcomJP, NA".
		const regions = regionLines.find((regions) => text.endsWith(regions));
		return {
			name:
				regions === undefined ? text : text.slice(0, -regions.length).trimEnd(),
			regions:
				regions === undefined
					? []
					: regions.split(/\s*[,/]\s*/).filter((region) => region),
		};
	});
}

function articleUrl(cell: Element): string | undefined {
	const link = cell.querySelector(":scope > i > a[href], :scope > a[href]");
	const href = link?.getAttribute("href");
	return href?.startsWith("https://en.wikipedia.org/wiki/") &&
		!link?.classList.contains("new")
		? href
		: undefined;
}

const noDate = /^(?:Unreleased|Cancelled|N\/a|—)$/i;

// "Unreleased", "Cancelled", "N/a" and empty cells have no date.
function columnDate(
	region: string,
	cell: Element,
): WikipediaEntry["releaseDates"] {
	const text = cellText(cell);
	return !text || noDate.test(text) ? [] : [{ region, date: parseDate(text) }];
}

// Dates with their regions in parentheses, if any, one per line, e.g. "December 6, 2000 (NA)", "June 1999 (NA, EU)", "April 1, 2000 (NA/EU)".
function regionDates(cell: Element): WikipediaEntry["releaseDates"] {
	const text = cellText(cell);
	return text
		? text.split("\n").flatMap((line) => {
				const [, date = line, regions] =
					line.match(/^(.+?) \(([A-Z,/ ]+)\)$/) ?? [];
				return noDate.test(date)
					? []
					: regions === undefined
						? [{ date: parseDate(date) }]
						: regions
								.split(/, |\//)
								.map((region) => ({ region, date: parseDate(date) }));
			})
		: [];
}

// A check mark cell, e.g. a green check for "yes".
function released(cell: Element): "yes" | "no" | "unknown" {
	const classes = cell.className.split(" ");
	if (classes.some((name) => name.startsWith("table-yes"))) {
		return "yes";
	}
	if (classes.some((name) => name.startsWith("table-no"))) {
		return "no";
	}
	if (classes.includes("table-Unknown")) {
		return "unknown";
	}
	throw new Error(`Unexpected check mark: ${cell.outerHTML.slice(0, 200)}`);
}

// The largest table of the page is the list of games.
function gameTable(document: Document): HTMLTableElement {
	const [table] = [...document.querySelectorAll("table.wikitable")].sort(
		(a, b) => b.querySelectorAll("tr").length - a.querySelectorAll("tr").length,
	);
	if (!table) {
		throw new Error("Missing table");
	}
	return table as HTMLTableElement;
}

// The columns of each list, as headed in the table.
const columns: Record<WikipediaEntry["list"], readonly string[]> = {
	dmg: [
		"Title",
		"Developer(s)",
		"Publisher(s)",
		"Japan",
		"North America",
		"PAL region",
	],
	cgb: [
		"Title",
		"Dual Mode",
		"Cartridge feature",
		"Developer",
		"Publisher",
		"First released",
		"JP",
		"NA",
		"EU/PAL",
	],
	agb: [
		"Title(s)",
		"Developer(s)",
		"Publisher(s)",
		"Release date(s)",
		"JP",
		"NA",
		"EU/PAL",
		"AU",
		"KOR",
	],
};

// The columns with check marks for the regions released in.
const regionColumns: Record<WikipediaEntry["list"], readonly string[]> = {
	dmg: [],
	cgb: ["JP", "NA", "EU/PAL"],
	agb: ["JP", "NA", "EU/PAL", "AU", "KOR"],
};

const notApplicable = /^—?\s*N\/a$|^—$/i;

export function parseWikipediaHtml(
	list: WikipediaEntry["list"],
	html: string,
): WikipediaEntry[] {
	const document = new JSDOM(html).window.document;
	const table = gameTable(document);
	const isDataRow = (row: HTMLTableRowElement) =>
		[...row.cells].some((cell) => cell.tagName === "TD");
	// The header rows have no data cells. No data cell spans several rows.
	const headers = [...table.rows]
		.filter((row) => !isDataRow(row))
		.flatMap((row) => [...row.cells].map(cellText));
	const missing = columns[list].filter((column) => !headers.includes(column));
	if (missing.length) {
		throw new Error(`Missing columns: ${missing.join(", ")}`);
	}
	return [...table.rows].filter(isDataRow).map((row) => {
		const cells = [...row.cells];
		if (cells.length !== columns[list].length) {
			throw new Error(`Unexpected row: ${cells.map(cellText).join(" | ")}`);
		}
		const cell = (column: string) => cells[columns[list].indexOf(column)]!;
		const title = cells[0]!;
		const url = articleUrl(title);
		const feature = list === "cgb" ? cellText(cell("Cartridge feature")) : "";
		return {
			list,
			titles: namesWithRegions(title).map(({ name, regions }) => ({
				title: name,
				regions,
			})),
			...(url === undefined ? {} : { articleUrl: url }),
			developers: namesWithRegions(cells[list === "cgb" ? 3 : 1]!),
			publishers: namesWithRegions(cells[list === "cgb" ? 4 : 2]!),
			releaseDates:
				list === "dmg"
					? (["JP", "NA", "PAL"] as const).flatMap((region, index) =>
							columnDate(region, cells[3 + index]!),
						)
					: regionDates(cells[list === "cgb" ? 5 : 3]!),
			...(list === "cgb" && { dualMode: cellText(cell("Dual Mode")) }),
			...(feature &&
				!notApplicable.test(feature) && { cartridgeFeature: feature }),
			...(regionColumns[list].length && {
				regionsReleased: regionColumns[list].map((region) => ({
					region,
					released: released(cell(region)),
				})),
			}),
		};
	});
}
