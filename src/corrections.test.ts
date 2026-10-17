import { expect, test } from "vitest";
import { correctSerials, type Correction } from "./corrections.ts";

const corrections: Correction[] = [
	{
		source: "no-intro.org",
		record: "https://example.com/1",
		title: "Boxxle (USA)",
		field: "cartridgeSerials",
		wrong: "DMG-S0-USA",
		correct: "DMG-SO-USA",
		reason: "Zero instead of O.",
		evidence: ["https://example.com/1"],
		reported: null,
	},
	{
		source: "no-intro.org",
		record: "https://example.com/2",
		title: "Mega Man II (USA)",
		field: "cartridgeSerials",
		wrong: "DMG-XX-USA",
		correct: null,
		reason: "Placeholder.",
		evidence: ["https://example.com/2"],
		reported: null,
	},
];

test("corrects and removes serials of the matching record only", () => {
	expect(
		correctSerials(
			corrections,
			"no-intro.org",
			"https://example.com/1",
			"cartridgeSerials",
			["DMG-SO-USA", "DMG-S0-USA"],
		),
	).toEqual(["DMG-SO-USA"]);
	expect(
		correctSerials(
			corrections,
			"no-intro.org",
			"https://example.com/2",
			"cartridgeSerials",
			["DMG-XX-USA", "DMG-W2-USA"],
		),
	).toEqual(["DMG-W2-USA"]);
	expect(
		correctSerials(
			corrections,
			"game-boy-database.com",
			"https://example.com/1",
			"cartridgeSerials",
			["DMG-S0-USA"],
		),
	).toEqual(["DMG-S0-USA"]);
	expect(
		correctSerials(
			corrections,
			"no-intro.org",
			"https://example.com/1",
			"romChipSerials",
			["DMG-S0-USA"],
		),
	).toEqual(["DMG-S0-USA"]);
});
