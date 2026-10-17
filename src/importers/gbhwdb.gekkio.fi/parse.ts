import { parse } from "csv-parse/sync";

// One physical cartridge documented in the Game Boy hardware database by Gekkio and contributors,
// https://gbhwdb.gekkio.fi/cartridges/. Licensed CC BY-SA 4.0.
export type GbhwdbCartridge = {
	/** The cartridge's page, e.g. https://gbhwdb.gekkio.fi/cartridges/AGB-A2CP-0/3615retro-1.html */
	url: string;
	/** Code printed on the ROM chip, which gbhwdb groups cartridges by, e.g. "DMG-AWA-0", "AGB-A2CP-0". */
	romChipSerial: string;
	/** From the cartridge label, e.g. "AGB-A2CP-EUR". Missing for a few cartridges. */
	cartridgeSerial?: string;
	/** The No-Intro name of the ROM, e.g. "Castlevania - Aria of Sorrow (Europe) (En,Fr,De)". */
	noIntroName: string;
	/** Manufacturing date printed on the circuit board. */
	boardDate?: GbhwdbDate;
	/** Manufacturing date printed on the ROM chip. */
	romChipDate?: GbhwdbDate;
	/** Of the contributor's dump of the ROM, when submitted. */
	crc32?: string;
};

export type GbhwdbDate = {
	year: number;
	month?: number;
	week?: number;
};

// The columns of https://gbhwdb.gekkio.fi/static/export/cartridges.csv. "code" appears twice: the ROM chip code and the label code.
const columns = [
	"code",
	"title",
	"slug",
	"url",
	"contributor",
	"game_name",
	"code",
	"stamp",
	...chipColumns("mainboard", ["type", "circled_letters", "panel_position"]),
	...[1, 2, 3, 4, 5, 6, 7, "x1"].flatMap((chip) =>
		chipColumns(typeof chip === "number" ? `u${chip}` : chip, [
			"role",
			"kind",
			"label",
			"manufacturer",
		]),
	),
	...chipColumns("battery", ["kind", "label", "manufacturer"]),
	"dump_crc32",
	"dump_md5",
	"dump_sha1",
	"dump_sha256",
];

function chipColumns(prefix: string, fields: readonly string[]): string[] {
	return [...fields, "calendar", "year", "month", "week"].map(
		(field) => `${prefix}_${field}`,
	);
}

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

const urlPattern =
	/^https:\/\/gbhwdb\.gekkio\.fi\/cartridges\/[A-Z0-9-]+\/[a-z0-9-]+\.html$/;
const romChipSerialPattern = /^(?:DMG|CGB|AGB)-[A-Z0-9]{2,5}-\d+$/;

export function parseGbhwdbCsv(csv: string): GbhwdbCartridge[] {
	const [header, ...rows] = parse(csv) as string[][];
	if (header?.join() !== columns.join()) {
		throw new Error(`Unexpected columns: ${header?.join()}`);
	}
	return rows.map((values) => {
		try {
			return parseRow(values);
		} catch (error) {
			throw new Error(`Failed to parse row: ${values.join()}`, {
				cause: error,
			});
		}
	});
}

function parseRow(values: string[]): GbhwdbCartridge {
	if (values.length !== columns.length) {
		throw new Error(`Expected ${columns.length} values, got ${values.length}`);
	}
	// By position, since "code" appears twice.
	const [romChipSerial, , , url, , noIntroName, cartridgeSerial] = values as [
		string,
		string,
		string,
		string,
		string,
		string,
		string,
	];
	const value = (column: string) => values[columns.indexOf(column)]!;

	if (!romChipSerialPattern.test(romChipSerial)) {
		throw new Error(`Unexpected ROM chip serial: ${romChipSerial}`);
	}
	if (!urlPattern.test(url)) {
		throw new Error(`Unexpected url: ${url}`);
	}
	if (!noIntroName) {
		throw new Error("Missing game name");
	}

	// Usually u1. One cartridge has two ROM chips; the first is used.
	const romChip = [1, 2, 3, 4, 5, 6, 7]
		.map((chip) => `u${chip}`)
		.find((chip) => value(`${chip}_role`) === "ROM");
	if (!romChip) {
		throw new Error("No ROM chip");
	}

	const crc32 = value("dump_crc32");
	return {
		url,
		romChipSerial,
		...(cartridgeSerial ? { cartridgeSerial } : {}),
		noIntroName,
		...optionalDate("boardDate", value, "mainboard"),
		...optionalDate("romChipDate", value, romChip),
		...(crc32 ? { crc32 } : {}),
	};
}

function optionalDate<Key extends string>(
	key: Key,
	value: (column: string) => string,
	prefix: string,
): { [K in Key]?: GbhwdbDate } {
	const year = value(`${prefix}_year`);
	const month = value(`${prefix}_month`);
	const week = value(`${prefix}_week`);
	if (!year) {
		if (month || week) {
			throw new Error(`${prefix}: month or week without year`);
		}
		return {};
	}
	if (!/^\d{4}$/.test(year) || (week && !/^\d{1,2}$/.test(week))) {
		throw new Error(`${prefix}: unexpected date ${year} ${month} ${week}`);
	}
	const monthNumber = months.indexOf(month) + 1;
	if (month && !monthNumber) {
		throw new Error(`${prefix}: unexpected month ${month}`);
	}
	return {
		[key]: {
			year: Number(year),
			...(month ? { month: monthNumber } : {}),
			...(week ? { week: Number(week) } : {}),
		},
	} as { [K in Key]?: GbhwdbDate };
}
