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

	test("keys codeless ROMs by their header code, or joins the release with that code", () => {
		const { recordReleases } = assignReleases(
			[
				{ cartridgeSerials: ["AGB-AQPF-FRA"] },
				{ cartridgeSerials: ["AGB-AQPP-EUR"] },
				{
					rom: { key: "agb-1", regions: ["France"], releaseKey: "AGB-AQPF" },
				},
				{ rom: { key: "agb-2", regions: ["Japan"], releaseKey: "AGB-AG7J" } },
				{ rom: { key: "agb-3", regions: ["Japan"], releaseKey: "AGB-AG7J" } },
			],
			"fallback",
		);
		expect(recordReleases.slice(2)).toEqual([
			["AGB-AQPF"],
			["AGB-AG7J"],
			["AGB-AG7J"],
		]);
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

test("puts a bare code in the release of the ROM whose header has it", () => {
	const { recordReleases } = assignReleases(
		[
			{
				cartridgeSerials: ["AGB-AU2E-USA"],
				rom: { key: "agb-1440", regions: ["USA"], headerCodes: ["AU2E"] },
			},
			{
				cartridgeSerials: ["AGB-AU2P-EUR"],
				rom: { key: "agb-1441", regions: ["Europe"], headerCodes: ["AU2P"] },
			},
			{ rom: { key: "agb-1096", regions: ["Japan"], headerCodes: ["AU2J"] } },
			// sprintinglegs' bare code, read as a ROM chip code.
			{ romChipSerials: ["AGB-AU2J"] },
		],
		"agb-x",
	);
	expect(recordReleases[3]).toEqual(recordReleases[2]);
});

test("doesn't put a ROM by region in the release of another ROM's header code", () => {
	const { recordReleases } = assignReleases(
		[
			{
				cartridgeSerials: ["AGB-BIMX-EUR"],
				rom: { key: "agb-2722", regions: ["Europe"], headerCodes: ["BIMX"] },
			},
			{ rom: { key: "agb-2715", regions: ["Europe"], headerCodes: ["BIMP"] } },
		],
		"agb-x",
	);
	expect(recordReleases).toEqual([["AGB-BIMX"], ["agb-2715"]]);
});
