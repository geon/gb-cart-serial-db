import { describe, expect, test } from "vitest";
import { parseSprintinglegsHtml } from "./parse.ts";

function row(id: number, serial: string, name: string): string {
	return `<div class="_item row game"> <div class="_gameid px-2 col-1">1</div> <div class="_gamedmg col-3">${serial}</div><div class="_gamename col-5">${name}</div><div class="_gamemore col-3"><a href="https://www.sprintinglegs.com/gbdb/gamedata?id=${id}">Read More</a> </div></div>`;
}

const header = `<div class="_item row">
	<div class="_gameid title mastertitle col-1"> <strong>ID</strong></div>
	<div class="_gamedmg title col-3 d-none d-md-block"><strong>ROM CODE<br>(REVISION)</strong></div>
</div>`;

describe("parseSprintinglegsHtml", () => {
	test("parses plain and translated titles, skipping the header", () => {
		const html = [
			header,
			row(
				1,
				"DMG-AWA",
				'ALLEY WAY<span class="pull-right lang">English</span>',
			),
			row(
				2,
				"GBD-PCAJ-1",
				'ポケットカメラ　<br>(Pocket camera)<span class="pull-right lang">Japanese</span>',
			),
			row(
				2207,
				"CGB-AJJE",
				'TOM &amp; JERRY<span class="pull-right lang"></span>',
			),
		].join("");

		expect(parseSprintinglegsHtml(html, "dmg")).toEqual([
			{
				id: 1,
				url: "https://www.sprintinglegs.com/gbdb/gamedata?id=1",
				list: "dmg",
				serial: "DMG-AWA",
				title: "ALLEY WAY",
				language: "English",
			},
			{
				id: 2,
				url: "https://www.sprintinglegs.com/gbdb/gamedata?id=2",
				list: "dmg",
				serial: "GBD-PCAJ-1",
				title: "ポケットカメラ",
				translatedTitle: "Pocket camera",
				language: "Japanese",
			},
			{
				id: 2207,
				url: "https://www.sprintinglegs.com/gbdb/gamedata?id=2207",
				list: "dmg",
				serial: "CGB-AJJE",
				title: "TOM & JERRY",
				language: "",
			},
		]);
	});

	test("repairs the mangled Cardcaptor Sakura rows", () => {
		const html = row(
			5044,
			"AGB-BKSJ",
			'カードキャプターさくら　＜さくらカード編＞　～さくらとカードとおともだち～　<br>(Cardcaptor Sakura <sakura card="" edition<="" ~sakura,="" cards="" and="" friends~)<span="" class="pull-right lang">Japanese</sakura>',
		);

		expect(parseSprintinglegsHtml(html, "dmg")).toEqual([
			{
				id: 5044,
				url: "https://www.sprintinglegs.com/gbdb/gamedata?id=5044",
				list: "dmg",
				serial: "AGB-BKSJ",
				title:
					"カードキャプターさくら　＜さくらカード編＞　～さくらとカードとおともだち～",
				translatedTitle:
					"Cardcaptor Sakura <Sakura Card Edition> ~Sakura, Cards and Friends~",
				language: "Japanese",
			},
		]);
	});

	test("throws on unexpected markup", () => {
		expect(() =>
			parseSprintinglegsHtml(row(1, "DMG-AWA", "ALLEY WAY"), "dmg"),
		).toThrow();
		expect(() =>
			parseSprintinglegsHtml(
				row(1, "not a serial", 'X<span class="pull-right lang">English</span>'),
				"dmg",
			),
		).toThrow();
		expect(() =>
			parseSprintinglegsHtml(
				row(
					1,
					"DMG-AWA",
					'X<br>no parens<span class="pull-right lang">English</span>',
				),
				"dmg",
			),
		).toThrow();
	});
});
