import { JSDOM } from "jsdom";

// One entry in the master lists at https://www.sprintinglegs.com/gbdb/gameslist?consoleID=1 (Game Boy), 2 (Game Boy Color) and 3 (Game Boy Advance).
export type SprintinglegsEntry = {
	/** Site-wide id, from the detail page link. */
	id: number;
	/** Detail page, e.g. https://www.sprintinglegs.com/gbdb/gamedata?id=1 */
	url: string;
	/** Which master list the entry is in. */
	list: SprintinglegsList;
	/** As printed on the site: product code with a trailing region letter and optional revision, e.g. `DMG-AWA`, `DMG-MLA-1`, `AGB-AMMJ`. */
	serial: string;
	title: string;
	/** English translation/romanization, given in parentheses below non-English titles. */
	translatedTitle?: string;
	/** Free text as on the site, e.g. "English", "Choice", "French/Dutch", "-", "". */
	language: string;
};

export type SprintinglegsList = "dmg" | "cgb" | "agb";

const detailUrlPattern =
	/^https:\/\/www\.sprintinglegs\.com\/gbdb\/gamedata\?id=(\d+)$/;
const serialPattern = /^[A-Z]{3}-[A-Z0-9]{3,4}(-\d)?$/;
const translatedTitlePattern = /^\((.*)\)$/s;

/**
 * Known damage in the saved pages: an unescaped `<` in a title was turned
 * into a bogus `<sakura …>` element by the browser that saved the page,
 * swallowing the language span. The original casing is lost; this restores
 * the text (with the site's typo `Edition<` corrected to `Edition>`).
 */
const repairs: readonly { broken: string; fixed: string }[] = [
	{
		broken:
			'(Cardcaptor Sakura <sakura card="" edition<="" ~sakura,="" cards="" and="" friends~)<span="" class="pull-right lang">Japanese</sakura>',
		fixed:
			'(Cardcaptor Sakura &lt;Sakura Card Edition&gt; ~Sakura, Cards and Friends~)<span class="pull-right lang">Japanese</span>',
	},
];

export function repairHtml(html: string): string {
	return repairs.reduce(
		(html, { broken, fixed }) => html.replaceAll(broken, fixed),
		html,
	);
}

export function parseSprintinglegsHtml(
	html: string,
	list: SprintinglegsList,
): SprintinglegsEntry[] {
	const document = new JSDOM(repairHtml(html)).window.document;
	return [...document.querySelectorAll("div._item.row.game")].map((row) => {
		try {
			return parseRow(row, list);
		} catch (error) {
			throw new Error(`Failed to parse row: ${row.outerHTML}`, {
				cause: error,
			});
		}
	});
}

function parseRow(row: Element, list: SprintinglegsList): SprintinglegsEntry {
	const href = row.querySelector("div._gamemore a")?.getAttribute("href");
	const id = href?.match(detailUrlPattern)?.[1];
	if (!(href && id)) {
		throw new Error(`Unexpected detail link: ${href}`);
	}

	const serial = row.querySelector("div._gamedmg")?.textContent.trim();
	if (!(serial && serialPattern.test(serial))) {
		throw new Error(`Unexpected serial: ${serial}`);
	}

	const name = row.querySelector("div._gamename");
	if (!name) {
		throw new Error("Missing name");
	}

	// Expected children: title, optionally <br> and "(translated title)", then the language span.
	const [titleNode, ...rest] = name.childNodes;
	const languageNode = rest.pop();
	if (!(
		titleNode?.nodeName === "#text" &&
		languageNode?.nodeName === "SPAN" &&
		(languageNode as Element).classList.contains("lang")
	)) {
		throw new Error("Unexpected name structure");
	}

	const title = titleNode.textContent?.trim();
	if (!title) {
		throw new Error("Missing title");
	}

	let translatedTitle: string | undefined;
	if (rest.length) {
		const [br, translatedNode, ...more] = rest;
		const translated = translatedNode?.textContent
			?.trim()
			.match(translatedTitlePattern)?.[1]
			?.trim();
		if (!(br?.nodeName === "BR" && translated && more.length === 0)) {
			throw new Error("Unexpected translated title");
		}
		translatedTitle = translated;
	}

	return {
		id: Number(id),
		url: href,
		list,
		serial,
		title,
		...(translatedTitle !== undefined && { translatedTitle }),
		language: languageNode.textContent?.trim() ?? "",
	};
}
