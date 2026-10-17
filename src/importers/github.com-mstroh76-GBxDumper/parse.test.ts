import { describe, expect, test } from "vitest";
import { parseGbxDumperCsv } from "./parse.ts";

const header =
	"Internal name\tSerial\tROM size (MBit)\t Complement\tCRC32\tMemory type\tRAM size (KBit) ";

function csv(...rows: string[]) {
	return [header, ...rows].join("\n") + "\n";
}

describe("parseGbxDumperCsv", () => {
	test("parses entries", () => {
		expect(
			parseGbxDumperCsv(
				csv(
					"MARIO&LUIGIJ\tAGB-A88J-JAP\t128\t93\t4EF93D41\tEEPROM_V124\t64",
					"NITRO KART\tAGB-BCNP-EUR\t64\tD5\tD5BB1C0F\tEEPROM_V122\t4s",
					"TETRIS WORLD\tAGB-ATWE-USA\t32\tB0\t0f0bd7e9\t\t",
				),
			),
		).toEqual([
			{
				internalName: "MARIO&LUIGIJ",
				serial: "AGB-A88J-JPN",
				romSize: 16 * 1024 * 1024,
				crc32: "4ef93d41",
				saveType: "EEPROM_V124",
				saveSize: 8 * 1024,
			},
			{
				internalName: "NITRO KART",
				serial: "AGB-BCNP-EUR",
				romSize: 8 * 1024 * 1024,
				crc32: "d5bb1c0f",
				saveType: "EEPROM_V122",
				saveSize: 512,
			},
			{
				internalName: "TETRIS WORLD",
				serial: "AGB-ATWE-USA",
				romSize: 4 * 1024 * 1024,
				crc32: "0f0bd7e9",
			},
		]);
	});

	test("throws on unexpected content", () => {
		const variants = [
			"X\tDMG-AAAA-USA\t32\tB0\t0f0bd7e9\t\t",
			"X\tAGB-ATWE-USA\t32 MBit\tB0\t0f0bd7e9\t\t",
			"X\tAGB-ATWE-USA\t32\tB0\t0f0bd7\t\t",
			"X\tAGB-ATWE-USA\t32\tB0\t0f0bd7e9\tEEPROM_V124\t",
		];
		for (const variant of variants) {
			expect(() => parseGbxDumperCsv(csv(variant))).toThrow();
		}
		expect(() => parseGbxDumperCsv(header.replace("CRC32", "CRC"))).toThrow();
	});
});
