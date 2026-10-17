import { JSDOM } from "jsdom";

// A row of the game tables in Wikipedia's lists of Game Boy, Game Boy Color and Game Boy Advance games.
export type WikipediaEntry = {
	/** The list the row is in. */
	list: "dmg" | "cgb" | "agb";
	/** The titles in the row, with the regions they are written for, e.g. [{ title: "007: Quitte ou Double", regions: ["FR"] }]. The regions are empty when the row doesn't say. */
	titles: { title: string; regions: string[] }[];
	/** The article of the game, when the title is linked. Links to a section of another article are kept, e.g. "https://en.wikipedia.org/wiki/Tama_and_Friends#Video_games". */
	articleUrl?: string;
	/** As written in the row, e.g. { region: "JP", date: "1994-08-05" }. The date is as exact as the source: "1995-04" for "April 1995", "2002" for "2002". A few dates have no region. */
	releaseDates: { region?: string; date: string }[];
};

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

// Text of a cell without footnote references and hidden sort keys, with line breaks as "\n".
function cellText(cell: Element): string {
	const clone = cell.cloneNode(true) as Element;
	clone
		.querySelectorAll("sup.reference, .mw-ref, span[style*='display:none']")
		.forEach((element) => element.remove());
	clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
	return (clone.textContent ?? "")
		.replace(/[ \t\u00a0]+/g, " ")
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line)
		.join("\n");
}

// The title cell: a title per line, each optionally followed by its regions in superscript, e.g.
// "• 007: Alles oder Nichts DE". Regions are separated by commas or slashes.
function parseTitles(cell: Element): WikipediaEntry["titles"] {
	const lines = cellText(cell).split("\n");
	const regionLines = [
		...cell.querySelectorAll(":scope > sup:not(.reference)"),
	].map((sup) => cellText(sup));
	return lines.map((line) => {
		const text = line.replace(/^•\s*/, "");
		const regions = regionLines.find((regions) => text.endsWith(` ${regions}`));
		return {
			title: regions === undefined ? text : text.slice(0, -regions.length - 1),
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

export function parseWikipediaHtml(
	list: WikipediaEntry["list"],
	html: string,
): WikipediaEntry[] {
	const document = new JSDOM(html).window.document;
	// The header rows have no data cells. No data cell spans several rows.
	const rows = [...gameTable(document).rows]
		.map((row) => [...row.cells])
		.filter((cells) => cells.some((cell) => cell.tagName === "TD"));
	return rows.map((cells) => {
		const [title] = cells;
		if (!title) {
			throw new Error("Missing title");
		}
		const url = articleUrl(title);
		const releaseDates =
			list === "dmg"
				? (["JP", "NA", "PAL"] as const).flatMap((region, index) => {
						const cell = cells[3 + index];
						if (!cell) {
							throw new Error(`Missing ${region} date: ${cellText(title)}`);
						}
						return columnDate(region, cell);
					})
				: regionDates(cells[list === "cgb" ? 5 : 3]!);
		return {
			list,
			titles: parseTitles(title),
			...(url === undefined ? {} : { articleUrl: url }),
			releaseDates,
		};
	});
}
