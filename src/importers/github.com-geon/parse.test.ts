import { describe, expect, test } from "vitest";
import { parseGeonCsv } from "./parse.ts";

describe("parseGeonCsv", () => {
	test("parses entries", () => {
		expect(
			parseGeonCsv(
				"serial,title\nDMG-LBA,Lemmings レミングス\nCGB-AW8A-EUR-3,Wario Land 3",
			),
		).toEqual([
			{ serial: "DMG-LBA", title: "Lemmings レミングス" },
			{ serial: "CGB-AW8A-EUR-3", title: "Wario Land 3" },
		]);
	});

	test("throws on unexpected content", () => {
		for (const csv of [
			"code,title\nDMG-LBA,Lemmings",
			"serial,title\nLemmings,DMG-LBA",
			"serial,title\nDMG-LBA,",
		]) {
			expect(() => parseGeonCsv(csv)).toThrow();
		}
	});
});
