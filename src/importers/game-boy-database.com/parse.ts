import { JSDOM } from "jsdom";

// One entry in the "fullset" pages at https://www.game-boy-database.com/fullset-<page>.html, e.g. fullset-USA.html.
export type GameBoyDatabaseComEntry = {
	/** Site-wide id, from the detail page link. */
	id: number;
	/** Detail page, e.g. https://www.game-boy-database.com/game-F4-23-USA.html */
	url: string;
	/** Picture of the front of the box, e.g. https://www.game-boy-database.com/vizu/23.jpg. Undefined where the site shows the placeholder picneeded.jpg. */
	boxImageUrl?: string;
	/** Fullset pages listing the entry. Pan-European releases are listed on several pages. */
	fullsets: GameBoyDatabaseComFullset[];
	/**
	 * Cartridge serial, built from the code and region in the detail page link, e.g. `DMG-F4-USA` from game-F4-23-USA.html.
	 * The site only lists original Game Boy cartridges, hence `DMG-`.
	 * Chinese releases have numeric codes and are written `DMG-112 CHN`, as in no-intro.
	 */
	serial: string;
	/** Title as shown, without the region code the site appends. */
	title: string;
	/** From "(1 version)" or "2 known versions". */
	versionCount: number;
};

// Named as in the page URLs, fullset-<name>.html.
export const gameBoyDatabaseComFullsets = [
	"ASI",
	"AUS",
	"BRAZIL",
	"CAN",
	"CHN",
	"ESP",
	"EUR",
	"FAH",
	"FRA",
	"FRG",
	"GPS",
	"HOL",
	"ITA",
	"JPN",
	"KOR",
	"NOE",
	"SCN",
	"USA",
] as const;

export type GameBoyDatabaseComFullset =
	(typeof gameBoyDatabaseComFullsets)[number];

const detailUrlPattern =
	/^https:\/\/www\.game-boy-database\.com\/game-(.+?)-(\d+)-([^-]+(?:-\d+)?)\.html$/;
const versionsPattern = /^(?:\((\d+) version\)|(\d+) known versions)$/;
const placeholderImage = "picneeded.jpg";

export function parseGameBoyDatabaseComFullsetHtml(
	html: string,
	fullset: GameBoyDatabaseComFullset,
): GameBoyDatabaseComEntry[] {
	const document = new JSDOM(html).window.document;
	return [...document.querySelectorAll("main div.images-box-fullset")].map(
		(box) => {
			try {
				return parseBox(box, fullset);
			} catch (error) {
				throw new Error(`Failed to parse entry: ${box.outerHTML}`, {
					cause: error,
				});
			}
		},
	);
}

function parseBox(
	box: Element,
	fullset: GameBoyDatabaseComFullset,
): GameBoyDatabaseComEntry {
	const url = box.querySelector("a")?.getAttribute("href");
	const [, rawCode, id, rawRegion] = url?.match(detailUrlPattern) ?? [];
	if (!(url && rawCode && id && rawRegion)) {
		throw new Error(`Unexpected detail link: ${url}`);
	}

	// One link has a trailing space in the code: game-AY2J%20-4747-JPN.html
	const code = decodeURIComponent(rawCode).trim();
	// One region is written `jPN`.
	const region = rawRegion.toUpperCase();
	// Chinese releases have 3-digit codes instead of letters. According to
	// https://www.game-boy-database.com/fullset-CHN.html, Nintendo outsourced
	// production and distribution of 60+ titles for China, Hong Kong and Macao
	// to the Hong Kong company Mani in the mid-1990s. Some were later reissued
	// marked "For China Only" (FCO). no-intro writes these serials with a space,
	// e.g. `DMG-202 CHN`, and all 44 in its Game Boy data match this format.
	const isChinese = region === "CHN";
	if (!(isChinese ? /^\d{3}$/ : /^[A-Z0-9]{2,4}$/).test(code)) {
		throw new Error(`Unexpected code for ${region}: ${code}`);
	}
	if (!isChinese && /^\d+$/.test(code)) {
		throw new Error(`Numeric code outside CHN: ${code}`);
	}

	const imageSrc = box.querySelector("a > img")?.getAttribute("src");
	const imageFile = imageSrc?.split("/").pop();
	if (!(imageFile === `${id}.jpg` || imageFile === placeholderImage)) {
		throw new Error(`Unexpected image: ${imageSrc}`);
	}

	const shownTitle = box.querySelector("p.game-title")?.textContent;
	const regionSuffix = ` ${rawRegion}`;
	if (!shownTitle?.endsWith(regionSuffix)) {
		throw new Error(`Title doesn't end with region: ${shownTitle}`);
	}
	const title = shownTitle.slice(0, -regionSuffix.length).trim();
	if (!title) {
		throw new Error("Missing title");
	}

	const versions = box.querySelector("p.game-versions")?.textContent.trim();
	const [, singular, plural] = versions?.match(versionsPattern) ?? [];
	const versionCount = Number(singular ?? plural);
	if (!versionCount) {
		throw new Error(`Unexpected versions: ${versions}`);
	}

	return {
		id: Number(id),
		url,
		boxImageUrl:
			imageFile === placeholderImage
				? undefined
				: `https://www.game-boy-database.com/vizu/${imageFile}`,
		fullsets: [fullset],
		serial: isChinese ? `DMG-${code} CHN` : `DMG-${code}-${region}`,
		title,
		versionCount,
	};
}
