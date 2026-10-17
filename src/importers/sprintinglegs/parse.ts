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
	languageFreetext: string;
};

export type SprintinglegsList = "dmg" | "cgb" | "agb";

// The translated game title has a "<". It looks like it was accidentally parsed
// as html, and the following words became attributes.
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

const serialPattern = /^[A-Z]{3}-[A-Z0-9]{3,4}(-\d)?$/;
export function parseSerial(serialText: string | undefined) {
	const serial = serialText;
	if (!(serial && serialPattern.test(serial))) {
		throw new Error(`Invalid serial: ${serial}`);
	}
	return serial;
}

function isElementNamed(node: ChildNode, name: string): node is Element {
	return node.nodeType === node.ELEMENT_NODE && node.nodeName === name;
}

export function getNameElementTextNodes(name: Element): {
	readonly title: string;
	readonly languageFreetext: string;
	readonly translatedTitle: string | undefined;
} {
	const nameElementChildren = name.childNodes;

	// Expected children: title, optionally <br> and "(translated title)", then the language span.
	const [titleNode, br, translatedNode] = nameElementChildren;
	const languageNode = nameElementChildren[nameElementChildren.length - 1];
	if (!(
		titleNode?.nodeName === "#text" &&
		titleNode.textContent &&
		languageNode &&
		isElementNamed(languageNode, "SPAN") &&
		languageNode.classList.contains("lang") &&
		(br?.nodeName === "BR" || !translatedNode)
	)) {
		throw new Error("Unexpected name structure");
	}

	return {
		title: titleNode.textContent,
		languageFreetext: languageNode.textContent,
		translatedTitle: translatedNode?.textContent ?? undefined,
	};
}

const translatedTitlePattern = /^\((.*)\)$/s;
export function parseTranslatedTitle(textContent: string): string | undefined {
	const translatedTitle = textContent
		?.trim()
		.match(translatedTitlePattern)?.[1]
		?.trim();

	if (!translatedTitle) {
		throw new Error("Unexpected translated title");
	}

	return translatedTitle;
}

const detailUrlPattern =
	/^https:\/\/www\.sprintinglegs\.com\/gbdb\/gamedata\?id=(\d+)$/;

function parseRow(row: Element, list: SprintinglegsList): SprintinglegsEntry {
	const href = row.querySelector("div._gamemore a")?.getAttribute("href");
	const id = href?.match(detailUrlPattern)?.[1];
	if (!(href && id)) {
		throw new Error(`Unexpected detail link: ${href}`);
	}

	const serial = parseSerial(
		row.querySelector("div._gamedmg")?.textContent.trim(),
	);

	const name = row.querySelector("div._gamename");
	if (!name) {
		throw new Error("Missing name");
	}

	const textNodes = getNameElementTextNodes(name);

	const title = textNodes.title?.trim();

	const translatedTitle =
		textNodes.translatedTitle &&
		parseTranslatedTitle(textNodes.translatedTitle);

	const languageFreetext = textNodes.languageFreetext.trim() ?? "";

	return {
		id: Number(id),
		url: href,
		list,
		serial,
		title,
		translatedTitle,
		languageFreetext,
	};
}
