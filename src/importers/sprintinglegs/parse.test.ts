import { describe, expect, test } from "vitest";
import {
	getNameElementTextNodes,
	parseSerial,
	parseSprintinglegsHtml,
	parseTranslatedTitle,
	type SprintinglegsEntry,
} from "./parse.ts";
import { JSDOM } from "jsdom";

describe("parseSprintinglegsHtml", () => {
	test("parses plain and translated titles, skipping the header", () => {
		const html = `
			<div class="_item row"><div class="_gameid title mastertitle col-1"> <strong>ID</strong></div><div class="_gamedmg title col-3 d-none d-md-block"><strong>ROM CODE<br>(REVISION)</strong></div></div>
			<div class="_item row game"> <div class="_gameid px-2 col-1">1</div> <div class="_gamedmg col-3">DMG-AWA</div><div class="_gamename col-5">ALLEY WAY<span class="pull-right lang">English</span></div><div class="_gamemore col-3"><a href="https://www.sprintinglegs.com/gbdb/gamedata?id=1">Read More</a> </div></div>
			<div class="_item row game"> <div class="_gameid px-2 col-1">1</div> <div class="_gamedmg col-3">GBD-PCAJ-1</div><div class="_gamename col-5">ポケットカメラ　<br>(Pocket camera)<span class="pull-right lang">Japanese</span></div><div class="_gamemore col-3"><a href="https://www.sprintinglegs.com/gbdb/gamedata?id=2">Read More</a> </div></div>
			<div class="_item row game"> <div class="_gameid px-2 col-1">1</div> <div class="_gamedmg col-3">CGB-AJJE</div><div class="_gamename col-5">TOM &amp; JERRY<span class="pull-right lang"></span></div><div class="_gamemore col-3"><a href="https://www.sprintinglegs.com/gbdb/gamedata?id=2207">Read More</a> </div></div>
		`;

		expect(parseSprintinglegsHtml(html, "dmg")).toEqual([
			{
				id: 1,
				url: "https://www.sprintinglegs.com/gbdb/gamedata?id=1",
				list: "dmg",
				serial: "DMG-AWA",
				title: "ALLEY WAY",
				languageFreetext: "English",
			},
			{
				id: 2,
				url: "https://www.sprintinglegs.com/gbdb/gamedata?id=2",
				list: "dmg",
				serial: "GBD-PCAJ-1",
				title: "ポケットカメラ",
				translatedTitle: "Pocket camera",
				languageFreetext: "Japanese",
			},
			{
				id: 2207,
				url: "https://www.sprintinglegs.com/gbdb/gamedata?id=2207",
				list: "dmg",
				serial: "CGB-AJJE",
				title: "TOM & JERRY",
				languageFreetext: "",
			},
		] satisfies SprintinglegsEntry[]);
	});

	test("repairs the mangled Cardcaptor Sakura rows", () => {
		const html = `<div class="_item row game"> <div class="_gameid px-2 col-1">1</div> <div class="_gamedmg col-3">AGB-BKSJ</div><div class="_gamename col-5">カードキャプターさくら　＜さくらカード編＞　～さくらとカードとおともだち～　<br>(Cardcaptor Sakura <sakura card="" edition<="" ~sakura,="" cards="" and="" friends~)<span="" class="pull-right lang">Japanese</sakura></div><div class="_gamemore col-3"><a href="https://www.sprintinglegs.com/gbdb/gamedata?id=5044">Read More</a> </div></div>`;

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
				languageFreetext: "Japanese",
			},
		] satisfies SprintinglegsEntry[]);
	});

	test("throws on unexpected markup", () => {
		expect(() =>
			getNameElementTextNodes(
				JSDOM.fragment('<div class="_gamename">no language span</div>')
					.firstElementChild!,
			),
		).toThrow();

		expect(() => parseSerial("not a serial")).toThrow();

		expect(() => parseTranslatedTitle("no parens")).toThrow();
	});
});
