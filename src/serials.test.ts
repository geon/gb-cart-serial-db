import { describe, expect, test } from "vitest";
import { codeStem, parseLabelSerial, parseLabelSerials } from "./serials.ts";

describe("parseLabelSerial", () => {
	test("parses Nintendo serials", () => {
		expect(parseLabelSerial("DMG-TR-USA-1")).toEqual({
			kind: "nintendo",
			serial: "DMG-TR-USA-1",
			code: "DMG-TR",
			stem: "DMG-TR",
			region: "USA",
			reprint: 1,
			fixes: [],
		});
		expect(parseLabelSerial("DMG-TRA")).toMatchObject({
			code: "DMG-TRA",
			stem: "DMG-TR",
		});
		expect(parseLabelSerial("DMG-APAE-USA")).toMatchObject({
			code: "DMG-APAE",
			stem: "DMG-APA",
		});
		expect(parseLabelSerial("DMG-APAD-NOE")).toMatchObject({ stem: "DMG-APA" });
		expect(parseLabelSerial("DMG-ALAP-NEU5")).toMatchObject({
			stem: "DMG-ALA",
			region: "NEU5",
		});
		expect(parseLabelSerial("DMG-104 CHN")).toEqual({
			kind: "nintendo",
			serial: "DMG-104 CHN",
			code: "DMG-104 CHN",
			stem: "DMG-104 CHN",
			fixes: [],
		});
	});

	test("keeps the platform in the stem", () => {
		expect(parseLabelSerial("CGB-BKTJ-JPN")).toMatchObject({ stem: "CGB-BKT" });
		expect(parseLabelSerial("DMG-BKTJ-JPN")).toMatchObject({ stem: "DMG-BKT" });
	});

	test("fixes typos and formatting variants", () => {
		const fixed = (raw: string) => {
			const result = parseLabelSerial(raw);
			return result.kind === "nintendo"
				? [result.serial, result.fixes]
				: result;
		};
		expect(fixed("G-DMG-LO-NOE")).toEqual([
			"DMG-LO-NOE",
			['Removed "G-" prefix'],
		]);
		expect(fixed("G/DMG-YK-NOE-1")).toEqual([
			"DMG-YK-NOE-1",
			['Removed "G-" prefix'],
		]);
		expect(fixed("DIS-CGB-ADME-USA")).toEqual([
			"CGB-ADME-USA",
			['Removed "DIS-" prefix'],
		]);
		expect(fixed("DMG-P-ACGP-NOE")).toEqual([
			"DMG-ACGP-NOE",
			['Removed "P-" infix'],
		]);
		expect(fixed("AGP-BPPP-EUR")).toEqual([
			"AGB-BPPP-EUR",
			['Corrected "AGP" to "AGB"'],
		]);
		expect(fixed("DNG-NE-USA")).toEqual([
			"DMG-NE-USA",
			['Corrected "DNG" to "DMG"'],
		]);
		expect(fixed("DMG-AAUE USA")).toEqual([
			"DMG-AAUE-USA",
			["Replaced space with hyphen"],
		]);
		expect(fixed("DMG-YTJ(JPN)")).toEqual(["DMG-YTJ", ['Removed "(JPN)"']]);
		expect(fixed("DMG-101CHN")).toEqual([
			"DMG-101 CHN",
			["Added space before CHN"],
		]);
		expect(fixed("DMG-202 CHN")).toEqual(["DMG-202 CHN", []]);
		expect(fixed("DMG-l7-EUR")).toEqual(["DMG-L7-EUR", ["Uppercased"]]);
		expect(fixed("DMG-AW2P-EUr")).toEqual(["DMG-AW2P-EUR", ["Uppercased"]]);
		expect(fixed("MG-ZG-UKV")).toEqual([
			"DMG-ZG-UKV",
			['Corrected "MG" to "DMG"'],
		]);
		expect(fixed("AGB-FNMJ-JAP")).toEqual([
			"AGB-FNMJ-JPN",
			['Corrected "JAP" to "JPN"'],
		]);
	});

	test("recognizes other publishers' codes", () => {
		for (const serial of [
			"4B-002",
			"MGB-006",
			"LRG-AP-USA",
			"2419 ROM Pack No. 156",
		]) {
			expect(parseLabelSerial(serial)).toEqual({ kind: "other", serial });
		}
	});

	test("rejects everything else", () => {
		for (const raw of [
			"none",
			"22",
			"G743404",
			"DMGAMLE0",
			"AGB-002",
			"AGB-014",
		]) {
			expect(parseLabelSerial(raw)).toMatchObject({ kind: "rejected" });
		}
	});
});

describe("parseLabelSerials", () => {
	test("splits values with several serials", () => {
		expect(
			parseLabelSerials("CGB-BESP-EUR; CGB-BESE-USA").map((result) =>
				result.kind === "nintendo" ? result.serial : result.kind,
			),
		).toEqual(["CGB-BESP-EUR", "CGB-BESE-USA"]);
	});

	test("doesn't split other publishers' codes", () => {
		expect(
			parseLabelSerials("2085 ROM PACK, (7981-5001-78), No. 137"),
		).toHaveLength(1);
	});
});

test("codeStem", () => {
	expect(codeStem("TR")).toBe("TR");
	expect(codeStem("TRA")).toBe("TR");
	expect(codeStem("APAE")).toBe("APA");
});
