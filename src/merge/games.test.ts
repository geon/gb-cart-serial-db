import { describe, expect, test } from "vitest";
import { groupGames, mergeByTitle } from "./games.ts";
import type { Link } from "./links.ts";

function link(from: string, to: string): Link {
	return { from, to, source: "test", record: from };
}

// Record -> family, as No-Intro's parent/clone groups.
const families: Record<string, string> = {
	"record:red-en": "red",
	"record:red-de": "red",
	"record:pinball": "pinball",
	"record:surfing-us": "surfing",
	"record:surfing-eu": "surfing",
};

function group(links: Link[], confirmed: string[] = []) {
	const { gameOf, contradictions } = groupGames(
		links,
		(key) => families[key],
		new Set(confirmed),
	);
	const sameGame = (a: string, b: string) => gameOf.get(a) === gameOf.get(b);
	return { sameGame, contradictions };
}

describe("groupGames", () => {
	test("merges by strong links", () => {
		const { sameGame } = group([
			link("record:red-en", "crc32:9f7fdd53"),
			link("record:other", "crc32:9f7fdd53"),
		]);
		expect(sameGame("record:red-en", "record:other")).toBe(true);
	});

	test("merges by stem within one family, or without No-Intro entries", () => {
		const { sameGame, contradictions } = group([
			link("record:red-en", "code:DMG-APAE"),
			link("record:red-de", "code:DMG-APAD"),
			link("record:sprintinglegs", "code:DMG-APAF"),
			link("code:DMG-APAE", "stem:DMG-APA"),
			link("code:DMG-APAD", "stem:DMG-APA"),
			link("code:DMG-APAF", "stem:DMG-APA"),
		]);
		expect(sameGame("record:red-en", "record:red-de")).toBe(true);
		expect(sameGame("record:red-en", "record:sprintinglegs")).toBe(true);
		expect(contradictions).toEqual([]);
	});

	test("keeps families apart under a contradicted stem, and reports it", () => {
		const links = [
			link("record:pinball", "code:CGB-BSUJ"),
			link("record:surfing-us", "code:CGB-BSUE"),
			link("record:surfing-eu", "code:CGB-BSUP"),
			link("code:CGB-BSUJ", "stem:CGB-BSU"),
			link("code:CGB-BSUE", "stem:CGB-BSU"),
			link("code:CGB-BSUP", "stem:CGB-BSU"),
		];
		const { sameGame, contradictions } = group(links);
		expect(sameGame("record:surfing-us", "record:surfing-eu")).toBe(true);
		expect(sameGame("record:pinball", "record:surfing-us")).toBe(false);
		expect(contradictions).toEqual([
			{
				stem: "CGB-BSU",
				groups: [
					["record:pinball"],
					["record:surfing-us"],
					["record:surfing-eu"],
				],
			},
		]);

		const confirmed = group(links, ["CGB-BSU"]);
		expect(confirmed.sameGame("record:pinball", "record:surfing-us")).toBe(
			true,
		);
		expect(confirmed.contradictions).toEqual([]);
	});
});

describe("mergeByTitle", () => {
	// Record -> [system, licensed] for No-Intro records.
	const roms: Record<string, [string, boolean]> = {
		"record:aa-rom": ["dmg", true],
		"record:hatris-rom": ["dmg", true],
		"record:asteroids-rom": ["dmg", true],
		"record:pirate-rom": ["dmg", false],
		"record:gba-rom": ["agb", true],
	};
	const titles: Record<string, string[]> = {
		"record:aa-rom": ["Aa Harimanada"],
		"record:aa-label": ["Aa Harimanada", "ああ播磨灘"],
		"record:hatris-rom": ["Hatris"],
		"record:hatris-label": ["HATRIS"],
		"record:asteroids-rom": ["Asteroids"],
		"record:asteroids-label-1": ["Asteroids"],
		"record:asteroids-label-2": ["Asteroids"],
		"record:pirate-rom": ["Pirate"],
		"record:pirate-label": ["Pirate"],
		"record:gba-rom": ["Hatris"],
	};
	const merge = (links: Link[]) => {
		const { gameOf } = groupGames(links, () => undefined, new Set());
		const merged = mergeByTitle(
			gameOf,
			(key) => {
				const rom = roms[key];
				return rom && { system: rom[0], licensed: rom[1] };
			},
			(key) => titles[key] ?? [],
		);
		const sameGame = (a: string, b: string) =>
			merged.gameOf.get(a) === merged.gameOf.get(b);
		return { sameGame, merges: merged.merges };
	};

	test("merges a ROM-only game with a label-only game of the same title and system", () => {
		const { sameGame, merges } = merge([
			link("record:aa-rom", "crc32:00000001"),
			link("record:aa-label", "label:DMG-A7J-JPN"),
			link("record:gba-rom", "crc32:00000002"),
			link("record:hatris-rom", "crc32:00000003"),
			link("record:hatris-label", "label:DMG-HT-USA"),
		]);
		expect(sameGame("record:aa-rom", "record:aa-label")).toBe(true);
		// Case doesn't matter, the system does.
		expect(sameGame("record:hatris-rom", "record:hatris-label")).toBe(true);
		expect(sameGame("record:gba-rom", "record:hatris-label")).toBe(false);
		expect(merges[0]).toEqual({
			titleKeys: ["aaharimanada"],
			groups: [["record:aa-rom"], ["record:aa-label"]],
		});
	});

	test("doesn't merge when several games share the title, or the ROM isn't licensed", () => {
		const { sameGame, merges } = merge([
			link("record:asteroids-rom", "crc32:00000001"),
			link("record:asteroids-label-1", "label:DMG-AN-USA"),
			link("record:asteroids-label-2", "label:DMG-AARE-USA"),
			link("record:pirate-rom", "crc32:00000002"),
			link("record:pirate-label", "label:DMG-PI-USA"),
		]);
		expect(sameGame("record:asteroids-rom", "record:asteroids-label-1")).toBe(
			false,
		);
		expect(sameGame("record:pirate-rom", "record:pirate-label")).toBe(false);
		expect(merges).toEqual([]);
	});

	test("doesn't merge games that have both ROMs and labels", () => {
		const { sameGame } = merge([
			link("record:hatris-rom", "label:DMG-HTA-JPN"),
			link("record:hatris-label", "label:DMG-HT-USA"),
		]);
		expect(sameGame("record:hatris-rom", "record:hatris-label")).toBe(false);
	});
});
