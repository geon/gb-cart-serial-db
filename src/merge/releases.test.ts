import { describe, expect, test } from "vitest";
import { assignReleases, releaseCode } from "./releases.ts";

test("releaseCode", () => {
	expect(releaseCode("DMG-TR-USA-1")).toBe("DMG-TR");
	expect(releaseCode("DMG-104 CHN")).toBe("DMG-104 CHN");
	expect(releaseCode("DMG-MMSA-JPN")).toBeUndefined();
});

describe("assignReleases", () => {
	test("puts Chinese releases with the western release of the same ROM", () => {
		const { recordReleases, serialRelease } = assignReleases(
			[
				{
					cartridgeSerials: ["DMG-TRA", "DMG-TR-USA", "DMG-104 CHN"],
					rom: { key: "dmg-1", regions: ["World"] },
				},
			],
			"fallback",
		);
		expect(recordReleases).toEqual([["DMG-TRA", "DMG-TR"]]);
		expect(serialRelease("DMG-104 CHN")).toBe("DMG-TR");
	});

	test("keys untrusted records by their ROM", () => {
		const { recordReleases } = assignReleases(
			[
				{
					cartridgeSerials: ["4B-001"],
					rom: { key: "dmg-2", regions: ["Taiwan"] },
					untrusted: true,
				},
			],
			"fallback",
		);
		expect(recordReleases).toEqual([["dmg-2"]]);
	});

	test("puts codeless ROMs in the single release of their region", () => {
		const { recordReleases } = assignReleases(
			[
				{ cartridgeSerials: ["DMG-MQJ-JPN"] },
				{ cartridgeSerials: ["DMG-MQ-USA"] },
				{ rom: { key: "dmg-3", regions: ["Japan"] } },
				{ rom: { key: "dmg-4", regions: ["Korea"] } },
			],
			"fallback",
		);
		expect(recordReleases.slice(2)).toEqual([["DMG-MQJ"], ["dmg-4"]]);
	});

	test("puts ROM chips with the ROM, code or region they match", () => {
		const { recordReleases } = assignReleases(
			[
				{
					cartridgeSerials: ["DMG-AFJ-JPN"],
					romChipSerials: ["DMG-AFJ-1"],
					rom: { key: "dmg-5", regions: ["Japan"] },
				},
				{ cartridgeSerials: ["DMG-AF-USA"] },
				{ romChipSerials: ["DMG-AFJ-1"] },
				{ romChipSerials: ["DMG-AFJ-0"] },
				{ romChipSerials: ["DMG-AFE-0"] },
				{ romChipSerials: ["DMG-ZZZ-0"] },
			],
			"fallback",
		);
		expect(recordReleases.slice(2)).toEqual([
			["DMG-AFJ"],
			["DMG-AFJ"],
			["DMG-AF"],
			["DMG-AF"],
		]);
	});

	test("puts codeless ROMs in the release of each of their regions", () => {
		const { recordReleases } = assignReleases(
			[
				{ cartridgeSerials: ["DMG-HTA-JPN"] },
				{ cartridgeSerials: ["DMG-HT-USA"] },
				{ rom: { key: "dmg-6", regions: ["Japan", "USA"] } },
				// Regions without a release are skipped.
				{ rom: { key: "dmg-7", regions: ["USA", "Korea"] } },
			],
			"fallback",
		);
		expect(recordReleases.slice(2)).toEqual([
			["DMG-HTA", "DMG-HT"],
			["DMG-HT"],
		]);
	});
});
