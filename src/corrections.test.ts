import { expect, test } from "vitest";
import { correctSerials, type Correction } from "./corrections.ts";

const corrections: Correction[] = [
	{
		source: "no-intro.org",
		record: "https://example.com/1",
		title: "Boxxle (USA)",
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
		wrong: "DMG-XX-USA",
		correct: null,
		reason: "Placeholder.",
		evidence: ["https://example.com/2"],
		reported: null,
	},
];

test("corrects and removes serials of the matching record only", () => {
	expect(
		correctSerials(corrections, "no-intro.org", "https://example.com/1", [
			"DMG-SO-USA",
			"DMG-S0-USA",
		]),
	).toEqual(["DMG-SO-USA"]);
	expect(
		correctSerials(corrections, "no-intro.org", "https://example.com/2", [
			"DMG-XX-USA",
			"DMG-W2-USA",
		]),
	).toEqual(["DMG-W2-USA"]);
	expect(
		correctSerials(
			corrections,
			"game-boy-database.com",
			"https://example.com/1",
			["DMG-S0-USA"],
		),
	).toEqual(["DMG-S0-USA"]);
});
