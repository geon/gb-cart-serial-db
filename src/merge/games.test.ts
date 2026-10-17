import { describe, expect, test } from "vitest";
import { groupGames } from "./games.ts";
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
