import { JSDOM } from "jsdom";

// No-Intro's XML format, as exported from DAT-o-MATIC. Element and attribute names are kept as in the XML, and all values as strings.
//
// <header>…</header>
// <datafile>
//   <game name>
//     <archive …/>                                        exactly one
//     <source> <details/> <serials/> <file/>* </source>   dumps, zero or more
//     <release> <details/> <serials/> <file/>* </release> scene releases, zero or more
//   </game>
// </datafile>

export type RawGame = {
	name: string;
	archive: RawArchive;
	sources: RawSource[];
	releases: RawRelease[];
};

export type RawSource = {
	details: RawSourceDetails;
	serials: RawSerials;
	files: RawFile[];
};

export type RawRelease = {
	details: RawReleaseDetails;
	serials: RawSerials;
	files: RawFile[];
};

const archiveAttributes = {
	required: ["number", "name", "region", "languages"],
	optional: [
		"clone",
		"regparent",
		"devstatus",
		"physical",
		"complete",
		"categories",
		"langchecked",
		"licensed",
		"aftermarket",
		"additional",
		"name_alt",
		"version1",
		"version2",
		"special1",
		"special2",
		"sticky_note",
		"showlang",
		"alt",
		"adult",
		"datter_note",
		"bios",
		"dat",
		"gameid1",
		"description",
		"mergeof",
	],
} as const;

const sourceDetailsAttributes = {
	required: [
		"id",
		"section",
		"d_date",
		"region",
		"dumper",
		"project",
		"originalformat",
	],
	optional: [
		"d_date_info",
		"r_date",
		"r_date_info",
		"origin",
		"comment1",
		"comment2",
		"tool",
		"link1",
		"link2",
		"link3",
		"media_title",
		"rominfo",
		"nodump",
	],
} as const;

const releaseDetailsAttributes = {
	required: [
		"id",
		"dirname",
		"nfoname",
		"nfo_size",
		"nfo_crc32",
		"originalformat",
		"date",
		"group",
		"region",
		"origin",
	],
	optional: ["archivename", "category", "comment", "rominfo", "tool"],
} as const;

const serialsAttributes = {
	required: [],
	optional: [
		"media_serial1",
		"media_serial2",
		"media_serial3",
		"mediastamp",
		"pcb_serial",
		"romchip_serial1",
		"romchip_serial2",
		"chip_serial",
		"savechip_serial",
		"lockout_serial",
		"box_serial",
		"box_barcode",
	],
} as const;

const fileAttributes = {
	required: ["id", "size", "crc32", "md5", "sha1", "format"],
	optional: [
		"extension",
		"sha256",
		"serial",
		"bad",
		"mia",
		"version",
		"forcename",
		"update_type",
		"item",
		"header",
		"origin_size",
		"origin_sha256",
	],
} as const;

type AttributeSpec = {
	required: readonly string[];
	optional: readonly string[];
};

type Attributes<Spec extends AttributeSpec> = {
	[Key in Spec["required"][number]]: string;
} & {
	[Key in Spec["optional"][number]]?: string;
};

type RawArchive = Attributes<typeof archiveAttributes>;
export type RawSourceDetails = Attributes<typeof sourceDetailsAttributes>;
type RawReleaseDetails = Attributes<typeof releaseDetailsAttributes>;
export type RawSerials = Attributes<typeof serialsAttributes>;
export type RawFile = Attributes<typeof fileAttributes>;

const headerFields = ["version", "author", "url", "trademarks", "piracy"];

export function parseRawXml(xml: string): RawGame[] {
	// The files have two top level elements, <header> and <datafile>, so they are wrapped to make a valid XML document.
	const body = xml.replace(/^<\?xml[^>]*\?>/, "");
	const document = new JSDOM(`<root>${body}</root>`, {
		contentType: "application/xml",
	}).window.document;
	const [header, datafile] = elementChildren(document.documentElement, [
		"header",
		"datafile",
	]);
	// The header only has the DAT version and legal text; it is checked but not used.
	elementChildren(header!, headerFields).forEach(assertNoAttributes);

	const games = elementChildren(datafile!).map((game) => {
		try {
			return parseGame(game);
		} catch (error) {
			throw new Error(`Failed to parse: ${game.outerHTML.slice(0, 2000)}`, {
				cause: error,
			});
		}
	});

	// Sanity check that nothing was silently skipped.
	const gameCount = xml.match(/<game /g)?.length ?? 0;
	if (games.length !== gameCount) {
		throw new Error(`Parsed ${games.length} of ${gameCount} <game> elements`);
	}
	return games;
}

function parseGame(game: Element): RawGame {
	if (game.tagName !== "game") {
		throw new Error(`Unexpected element: ${game.tagName}`);
	}
	const { name } = readAttributes(game, {
		required: ["name"],
		optional: [],
	} as const);

	const [archiveElement, ...rest] = elementChildren(game);
	if (archiveElement?.tagName !== "archive") {
		throw new Error("Expected <archive> first");
	}
	assertNoChildren(archiveElement);
	const archive = readAttributes(archiveElement, archiveAttributes);

	const sourceElements = rest.filter((element) => element.tagName === "source");
	const releaseElements = rest.slice(sourceElements.length);
	if (!releaseElements.every((element) => element.tagName === "release")) {
		throw new Error("Expected <source>* followed by <release>*");
	}

	return {
		name,
		archive,
		sources: sourceElements.map((element) =>
			parseDetailsSerialsFiles(element, sourceDetailsAttributes),
		),
		releases: releaseElements.map((element) =>
			parseDetailsSerialsFiles(element, releaseDetailsAttributes),
		),
	};
}

function parseDetailsSerialsFiles<DetailsSpec extends AttributeSpec>(
	parent: Element,
	detailsSpec: DetailsSpec,
): {
	details: Attributes<DetailsSpec>;
	serials: RawSerials;
	files: RawFile[];
} {
	assertNoAttributes(parent);
	const [details, serials, ...files] = elementChildren(parent);
	if (!(
		details?.tagName === "details" &&
		serials?.tagName === "serials" &&
		files.every((file) => file.tagName === "file")
	)) {
		throw new Error(
			`Expected <details/> <serials/> <file/>* in <${parent.tagName}>`,
		);
	}
	for (const element of [details, serials, ...files]) {
		assertNoChildren(element);
	}
	return {
		details: readAttributes(details, detailsSpec),
		serials: readAttributes(serials, serialsAttributes),
		files: files.map((file) => readAttributes(file, fileAttributes)),
	};
}

function readAttributes<Spec extends AttributeSpec>(
	element: Element,
	spec: Spec,
): Attributes<Spec> {
	const known = new Set<string>([...spec.required, ...spec.optional]);
	const attributes: Record<string, string> = {};
	for (const { name, value } of element.attributes) {
		if (!known.has(name)) {
			throw new Error(`Unknown attribute on <${element.tagName}>: ${name}`);
		}
		attributes[name] = value;
	}
	for (const name of spec.required) {
		if (!(name in attributes)) {
			throw new Error(`Missing attribute on <${element.tagName}>: ${name}`);
		}
	}
	return attributes as Attributes<Spec>;
}

// Child elements, checking that there is no text content besides whitespace.
function elementChildren(
	element: Element,
	expectedTagNames?: readonly string[],
): Element[] {
	for (const node of element.childNodes) {
		if (node.nodeType === node.TEXT_NODE && node.textContent?.trim()) {
			throw new Error(`Unexpected text in <${element.tagName}>`);
		}
		if (
			node.nodeType !== node.TEXT_NODE &&
			node.nodeType !== node.ELEMENT_NODE
		) {
			throw new Error(
				`Unexpected node in <${element.tagName}>: ${node.nodeName}`,
			);
		}
	}
	const children = [...element.children];
	if (
		expectedTagNames &&
		children.map((child) => child.tagName).join() !== expectedTagNames.join()
	) {
		throw new Error(
			`Expected ${expectedTagNames.join(", ")} in <${element.tagName}>`,
		);
	}
	return children;
}

function assertNoChildren(element: Element): void {
	if (element.childNodes.length) {
		throw new Error(`Unexpected content in <${element.tagName}>`);
	}
}

function assertNoAttributes(element: Element): void {
	if (element.attributes.length) {
		throw new Error(`Unexpected attributes on <${element.tagName}>`);
	}
}
