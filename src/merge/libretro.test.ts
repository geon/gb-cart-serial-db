import { expect, test } from "vitest";
import type { NoIntroEntry } from "../importers/no-intro.org/parse.ts";
import type { LibretroThumbnailsEntry } from "../importers/libretro-thumbnails/parse.ts";
import { matchLibretro, nameParts } from "./libretro.ts";

function noIntroEntry(noIntroName: string): NoIntroEntry {
	return {
		url: noIntroName,
		noIntroName,
		title: noIntroName,
		dat: "dmg",
		printedTitles: [],
		regions: [],
		languages: [],
		versions: [],
		specialTags: [],
		licensing: "licensed",
		cartridgeSerials: [],
		romChipSerials: [],
		romHeaderCodes: [],
		files: [],
	};
}

function images(name: string): LibretroThumbnailsEntry {
	return {
		repository: "Nintendo_-_Game_Boy",
		name,
		boxArtUrl: `https://example.com/${name}.png`,
	};
}

test("nameParts", () => {
	expect(nameParts("Megaman Zero 2 (USA)")).toEqual({
		title: "megamanzero2",
		tags: ["usa"],
	});
	expect(nameParts("Aerostar (Japan) (En)")).toEqual({
		title: "aerostar",
		tags: ["japan", "en"],
	});
	expect(nameParts("Breath of Fire (Europe) [Hack by Bregalad]").title).toBe(
		"",
	);
});

test("matches exact names, then titles whose tags are in the No-Intro name", () => {
	const { imagesOf, fuzzyMatches } = matchLibretro(
		[
			noIntroEntry("Tetris (World) (Rev 1)"),
			noIntroEntry("Super Bombliss (Japan) (En) (SGB Enhanced)"),
			noIntroEntry("Moon Patrol & Spy Hunter (USA)"),
			// An image of the old name and of the new one.
			noIntroEntry("Aerostar (Japan) (En)"),
			// Other regions and tags don't fit.
			noIntroEntry("Contra (World)"),
			noIntroEntry("Bubble Ghost (USA)"),
			// Two entries fit the same image.
			noIntroEntry("Shanghai (Japan) (En)"),
			noIntroEntry("Shanghai (Japan) (Rev 1)"),
		],
		[
			images("Tetris (World) (Rev 1)"),
			images("Super Bombliss (Japan) (SGB Enhanced)"),
			images("Moon Patrol _ Spy Hunter (USA)"),
			images("Aerostar (Japan)"),
			images("Aerostar (Japan) (En)"),
			images("Contra (World) (Contra Anniversary Collection)"),
			images("Bubble Ghost (Japan)"),
			images("Shanghai (Japan)"),
		],
	);
	const name = (noIntroName: string) => imagesOf(noIntroName)?.name;
	expect(name("Tetris (World) (Rev 1)")).toBe("Tetris (World) (Rev 1)");
	expect(name("Super Bombliss (Japan) (En) (SGB Enhanced)")).toBe(
		"Super Bombliss (Japan) (SGB Enhanced)",
	);
	expect(name("Moon Patrol & Spy Hunter (USA)")).toBe(
		"Moon Patrol _ Spy Hunter (USA)",
	);
	expect(name("Aerostar (Japan) (En)")).toBe("Aerostar (Japan) (En)");
	expect(name("Contra (World)")).toBeUndefined();
	expect(name("Bubble Ghost (USA)")).toBeUndefined();
	expect(name("Shanghai (Japan) (En)")).toBeUndefined();
	expect(fuzzyMatches.map(({ noIntroName }) => noIntroName)).toEqual([
		"Super Bombliss (Japan) (En) (SGB Enhanced)",
	]);
});
