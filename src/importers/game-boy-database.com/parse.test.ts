import { describe, expect, test } from "vitest";
import { parseGameBoyDatabaseComFullsetHtml } from "./parse.ts";

function box(href: string, image: string, title: string, versions: string) {
	return `<div class="images-box-fullset">
		<a href="${href}"><img src="./Game Boy Database - Fullset (USA)_files/${image}"></a>
		<div class="game-info-box">
			<p class="game-title">${title}</p>
			<p class="game-versions">${versions}</p>
		</div>
	</div>`;
}

function page(...boxes: string[]) {
	return `<main><div class="flex-container-presentation">${boxes.join("")}</div></main>`;
}

describe("parseGameBoyDatabaseComFullsetHtml", () => {
	test("parses entries", () => {
		const html = page(
			box(
				"https://www.game-boy-database.com/game-F4-23-USA.html",
				"23.jpg",
				"4 in 1 - Fun Pak USA",
				"2 known versions",
			),
			box(
				"https://www.game-boy-database.com/game-ML-2594-AUS-1.html",
				"picneeded.jpg",
				"Mario &amp; Yoshi AUS-1",
				"(1 version)",
			),
			box(
				"https://www.game-boy-database.com/game-AY2J%20-4747-jPN.html",
				"4747.jpg",
				"Nada Asataro no Powerful Mahjong jPN",
				"(1 version)",
			),
			box(
				"https://www.game-boy-database.com/game-112-4263-CHN.html",
				"4263.jpg",
				"Adventure Island 2 CHN",
				"(1 version)",
			),
		);

		expect(parseGameBoyDatabaseComFullsetHtml(html, "USA")).toEqual([
			{
				id: 23,
				url: "https://www.game-boy-database.com/game-F4-23-USA.html",
				boxImageUrl: "https://www.game-boy-database.com/vizu/23.jpg",
				fullsets: ["USA"],
				serial: "DMG-F4-USA",
				title: "4 in 1 - Fun Pak",
				versionCount: 2,
			},
			{
				id: 2594,
				url: "https://www.game-boy-database.com/game-ML-2594-AUS-1.html",
				boxImageUrl: undefined,
				fullsets: ["USA"],
				serial: "DMG-ML-AUS-1",
				title: "Mario & Yoshi",
				versionCount: 1,
			},
			{
				id: 4747,
				url: "https://www.game-boy-database.com/game-AY2J%20-4747-jPN.html",
				boxImageUrl: "https://www.game-boy-database.com/vizu/4747.jpg",
				fullsets: ["USA"],
				serial: "DMG-AY2J-JPN",
				title: "Nada Asataro no Powerful Mahjong",
				versionCount: 1,
			},
			{
				id: 4263,
				url: "https://www.game-boy-database.com/game-112-4263-CHN.html",
				boxImageUrl: "https://www.game-boy-database.com/vizu/4263.jpg",
				fullsets: ["USA"],
				serial: "DMG-112 CHN",
				title: "Adventure Island 2",
				versionCount: 1,
			},
		]);
	});

	test("ignores boxes outside main", () => {
		const html =
			box(
				"https://www.game-boy-database.com/game-F4-23-USA.html",
				"23.jpg",
				"4 in 1 - Fun Pak USA",
				"(1 version)",
			) + page();
		expect(parseGameBoyDatabaseComFullsetHtml(html, "USA")).toEqual([]);
	});

	test("throws on unexpected markup", () => {
		const valid = {
			href: "https://www.game-boy-database.com/game-F4-23-USA.html",
			image: "23.jpg",
			title: "4 in 1 - Fun Pak USA",
			versions: "(1 version)",
		};
		const variants = [
			{ ...valid, href: "https://example.com/game-F4-23-USA.html" },
			{ ...valid, image: "24.jpg" },
			{ ...valid, title: "4 in 1 - Fun Pak EUR" },
			{ ...valid, title: "USA" },
			{ ...valid, versions: "many versions" },
			{
				...valid,
				href: "https://www.game-boy-database.com/game-112-23-USA.html",
			},
			{
				...valid,
				href: "https://www.game-boy-database.com/game-F4-23-CHN.html",
				title: "4 in 1 - Fun Pak CHN",
			},
		];
		for (const { href, image, title, versions } of variants) {
			expect(() =>
				parseGameBoyDatabaseComFullsetHtml(
					page(box(href, image, title, versions)),
					"USA",
				),
			).toThrow();
		}
	});
});
