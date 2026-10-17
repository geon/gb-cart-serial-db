import { parseRawXml, type RawGame } from "./raw-xml.ts";

// A cartridge release from the No-Intro (https://www.no-intro.org) DAT files with full details, as exported from DAT-o-MATIC.
// Only physical, official-era releases are kept: entries without a physical release (digital, compilations for other
// systems), aftermarket releases, development builds (betas, prototypes, demos) and boot ROMs are left out.
// The many dumps of each entry are merged into its cartridge serials and ROM files.
export type NoIntroEntry = {
	/** Record page on DAT-o-MATIC, e.g. https://datomatic.no-intro.org/index.php?page=show_record&s=46&n=1317 */
	url: string;
	dat: NoIntroDat;
	/** The full No-Intro name, e.g. "Super Mario Land 2 - 6 Golden Coins (USA, Europe) (Rev 1)". Widely used by other lists to identify a ROM. */
	noIntroName: string;
	/** e.g. "Super Mario Land 2 - 6 Golden Coins" */
	title: string;
	/** e.g. "Carpenter Genzo - Ghost Kingdom" for "Daiku no Gen-san - Ghost Building Company". */
	alternativeTitle?: string;
	/** Titles as printed on the cartridges, e.g. "4 in 1 ４合１". */
	printedTitles: string[];
	/** e.g. ["USA", "Europe"] */
	regions: string[];
	/** e.g. ["En", "Fr", "De"]. Empty for "nolang". */
	languages: string[];
	/** e.g. ["Rev 1"], ["v1.1"]. */
	versions: string[];
	/** e.g. "Rumble Version", "Limited Run Games", "Kiosk". */
	edition?: string;
	/** e.g. ["SGB Enhanced", "GB Compatible"], ["NP"]. */
	specialTags: string[];
	/** "(Unl)" and "(Pirate)" in the name. */
	licensing: "licensed" | "unlicensed" | "pirate";
	/** The parent in No-Intro's parent/clone grouping of versions of the same title. Undefined for parents. */
	parentUrl?: string;
	/** From cartridge labels, e.g. ["DMG-MQ-USA", "DMG-MQ-FAH", "DMG-202 CHN"]. */
	cartridgeSerials: string[];
	/**
	 * Nintendo code printed on the ROM chip, with the revision, e.g. ["DMG-MQE-0"]. This is the "ROM code" listed by
	 * sprintinglegs (as `DMG-MQE`), which links it to the cartridge serials. The chip date and other markings are left
	 * out, e.g. "DMG-MQE-0 (9247)" and "TOSHIBA 9249EAI TC531001CF DMG-FKE-0 C1 N511 JAPAN". Chips without a Nintendo code
	 * (unlicensed and flash cartridges) are left out.
	 */
	romChipSerials: string[];
	/** Game code stored in the ROM header, e.g. ["AXPE"]. Only Game Boy Color and Advance ROMs have one; on Advance cartridges it is also in the label serial, e.g. AGB-AXPE-USA. */
	romHeaderCodes: string[];
	/** Good dumps of the ROM. Usually exactly one. */
	files: NoIntroFile[];
};

export type NoIntroFile = {
	crc32: string;
	size: number;
};

// One DAT per system. The ids are DAT-o-MATIC's system ids, the `s` parameter in its URLs.
export const noIntroDats = { dmg: 46, cgb: 47, agb: 23 } as const;

export type NoIntroDat = keyof typeof noIntroDats;

// The archive number is used as is; zero padding is significant (n=0001 works, n=1 doesn't), and some are prefixed, e.g. n=x436.
export function datomaticRecordUrl(
	dat: NoIntroDat,
	archiveNumber: string,
): string {
	return `https://datomatic.no-intro.org/index.php?page=show_record&s=${noIntroDats[dat]}&n=${encodeURIComponent(archiveNumber)}`;
}

export function parseNoIntroXml(xml: string, dat: NoIntroDat): NoIntroEntry[] {
	return parseRawXml(xml)
		.filter(isPhysicalOfficialRelease)
		.map((game) => {
			try {
				return cleanGame(game, dat);
			} catch (error) {
				throw new Error(`Failed to clean: ${JSON.stringify(game)}`, {
					cause: error,
				});
			}
		});
}

function isPhysicalOfficialRelease({ archive }: RawGame): boolean {
	return (
		!flag(archive.physical, "0") &&
		!flag(archive.aftermarket, "1") &&
		archive.devstatus === undefined &&
		!flag(archive.bios, "1")
	);
}

function cleanGame(game: RawGame, dat: NoIntroDat): NoIntroEntry {
	const { archive } = game;
	// Scene releases are included, since some entries are only known from them.
	const dumps = [...game.sources, ...game.releases];
	const files = dumps
		.flatMap(({ files }) => files)
		.filter((file) => !flag(file.bad, "1") && !flag(file.mia, "1"))
		.map(({ crc32, size }) => ({ crc32, size: Number(size) }));

	return {
		url: datomaticRecordUrl(dat, archive.number),
		dat,
		noIntroName: game.name,
		title: archive.name,
		...optional("alternativeTitle", archive.name_alt),
		printedTitles: unique(
			game.sources.map(({ details }) => details.media_title).filter(isDefined),
		),
		regions: splitList(archive.region, ", "),
		languages:
			archive.languages === "nolang" ? [] : splitList(archive.languages, ","),
		versions: [archive.version1, archive.version2].filter(isDefined),
		...optional("edition", archive.additional),
		specialTags: [archive.special1, archive.special2].flatMap((tags) =>
			splitList(tags, ", "),
		),
		licensing: oneOf(archive.licensed, {
			"": "licensed",
			"0": "unlicensed",
			"2": "pirate",
		} as const),
		...optional(
			"parentUrl",
			archive.clone === undefined || archive.clone === "P"
				? undefined
				: datomaticRecordUrl(dat, archive.clone),
		),
		cartridgeSerials: unique(
			dumps.flatMap(({ serials }) =>
				[
					serials.media_serial1,
					serials.media_serial2,
					serials.media_serial3,
				].filter(isDefined),
			),
		),
		romChipSerials: unique(
			dumps.flatMap(({ serials }) =>
				[serials.romchip_serial1, serials.romchip_serial2]
					.map((serial) => serial?.match(romChipCodePattern)?.[0])
					.filter(isDefined),
			),
		),
		romHeaderCodes: unique(
			dumps.flatMap(({ files }) =>
				files
					.map(({ serial }) => serial)
					.filter(
						(serial): serial is string =>
							serial !== undefined && serial !== "!none",
					),
			),
		),
		files: files.filter(
			(file, i) => files.findIndex(({ crc32 }) => crc32 === file.crc32) === i,
		),
	};
}

// The revision is a single digit; circuit board types like "DMG-A08-01" and "AGB-E01-10" are sometimes recorded as ROM chips.
const romChipCodePattern = /\b(?:DMG|CGB|AGB|GBD)-[A-Z0-9]{2,5}-\d(?!\d)/;

function unique<T>(values: readonly T[]): T[] {
	return [...new Set(values)];
}

function splitList(list: string | undefined, separator: string): string[] {
	return list ? list.split(separator) : [];
}

// An attribute that is either missing or has the one value meaning true.
function flag(value: string | undefined, trueValue: string): boolean {
	if (!(value === undefined || value === trueValue)) {
		throw new Error(`Unexpected flag value: ${value}`);
	}
	return value === trueValue;
}

// A missing attribute is looked up as "".
function oneOf<Value extends string>(
	value: string | undefined,
	values: Readonly<Record<string, Value>>,
): Value {
	const result = values[value ?? ""];
	if (result === undefined) {
		throw new Error(`Unexpected value: ${value}`);
	}
	return result;
}

// Leaves out undefined values instead of writing `key: undefined`.
function optional<Key extends string, Value>(
	key: Key,
	value: Value | undefined,
): { [K in Key]?: Value } {
	return (value === undefined ? {} : { [key]: value }) as {
		[K in Key]?: Value;
	};
}

function isDefined<T>(value: T | undefined): value is T {
	return value !== undefined;
}
