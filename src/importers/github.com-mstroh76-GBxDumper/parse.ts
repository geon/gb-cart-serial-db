import { parse } from "csv-parse/sync";

// One Game Boy Advance cartridge in gbalist.csv from the GBxDumper project, https://github.com/mstroh76/GBxDumper.
// The dumper uses the list to look up the ROM size, which isn't stored in the ROM.
export type GbxDumperEntry = {
	/** Title from the ROM header, e.g. "MARIO&LUIGIJ". */
	internalName: string;
	/**
	 * Looks like a label serial, e.g. "AGB-A88J-JPN", but is built from the game code in the ROM header and a region:
	 * the code matches the header in 2739 of the 2741 entries that are also in No-Intro.
	 */
	serial: string;
	/** In bytes. */
	romSize: number;
	crc32: string;
	/** Save type and the version of Nintendo's save library, e.g. "EEPROM_V124", "SRAM_V113", "FLASH1M_V103". Undefined for cartridges without saves. */
	saveType?: string;
	/** In bytes. */
	saveSize?: number;
};

const columns = [
	"Internal name",
	"Serial",
	"ROM size (MBit)",
	" Complement",
	"CRC32",
	"Memory type",
	"RAM size (KBit) ",
];

const serialPattern = /^AG[BP]-[A-Z0-9]{4}-[A-Z]{3}$/;

export function parseGbxDumperCsv(csv: string): GbxDumperEntry[] {
	const [header, ...rows] = parse(csv, { delimiter: "\t" }) as string[][];
	if (header?.join() !== columns.join()) {
		throw new Error(`Unexpected columns: ${header?.join()}`);
	}
	return rows.map((values) => {
		try {
			return parseRow(values);
		} catch (error) {
			throw new Error(`Failed to parse row: ${values.join("\t")}`, {
				cause: error,
			});
		}
	});
}

function parseRow(values: string[]): GbxDumperEntry {
	const [internalName, serial, romSizeMbit, , crc32, saveType, saveSizeKbit] =
		values as [string, string, string, string, string, string, string];

	if (!serialPattern.test(serial)) {
		throw new Error(`Unexpected serial: ${serial}`);
	}
	if (!/^[0-9A-Fa-f]{8}$/.test(crc32)) {
		throw new Error(`Unexpected CRC32: ${crc32}`);
	}
	if (!saveType !== !saveSizeKbit) {
		throw new Error("Save type without save size, or the reverse");
	}

	return {
		internalName,
		// 19 serials use "JAP" where all other lists use "JPN".
		serial: serial.replace(/-JAP$/, "-JPN"),
		romSize: bitsToBytes(romSizeMbit, 1024 * 1024),
		crc32: crc32.toLowerCase(),
		...(saveType
			? {
					saveType,
					// One RAM size is written "4s" (NITRO KART, AGB-BCNP-EUR).
					saveSize: bitsToBytes(saveSizeKbit.replace(/^4s$/, "4"), 1024),
				}
			: {}),
	};
}

function bitsToBytes(value: string, unit: number): number {
	if (!/^\d+$/.test(value)) {
		throw new Error(`Unexpected size: ${value}`);
	}
	return (Number(value) * unit) / 8;
}
