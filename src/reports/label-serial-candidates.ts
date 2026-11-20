import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { Release, Rom } from "../release.ts";

// Lists label serials read on the photos of the gameboy-labels repository (https://github.com/geon/gameboy-cartridge-labels)
// that no release has, as JSON, to verify before adding them in raw-data-sources/corrections/added-serials.json. Each
// with the photos it was read on (their OCR text and shop page), the releases whose ROM header code is its product code,
// and GBxDumper's entries with the serial. A serial whose code is no release's header code is most likely a misread,
// e.g. AGB-AZOP-EUR for AGB-AZQP-EUR.
//
//   npm run -s report:label-serial-candidates -- <path to gameboy-labels> > candidates.json
//
// Needs gameboy-labels' generated/read-serials/ (make read-serials there), made from the current database/releases.json.

const labels = process.argv[2];
if (!labels) {
	throw new Error("Give the path to the gameboy-labels repository.");
}

type SerialRead = {
	reads: { text: string; serial: string; kind: string; from: string }[];
	serial: string | null;
	release: string | null;
	decided_by: string;
	title_guess: string | null;
};
type PhotoSource = { page_url?: string; title_on_page?: string };
type GbxDumperEntry = { internalName: string; serial: string; crc32: string };

const json = <T>(path: string) => JSON.parse(readFileSync(path, "utf-8")) as T;
const reads = json<Record<string, SerialRead>>(
	`${labels}/generated/read-serials/serials.json`,
);
const photoSources = json<Record<string, PhotoSource>>(
	`${labels}/photo-sources.json`,
);
const photoFiles = readdirSync(`${labels}/photos`);
const releases = json<Release[]>("database/releases.json");
const roms = new Map(
	json<Rom[]>("database/roms.json").map((rom) => [rom.id, rom]),
);
const gbxDumper = json<GbxDumperEntry[]>(
	"data-sources/github.com-mstroh76-GBxDumper.json",
);

const known = new Set(
	releases.flatMap(({ cartridgeSerials }) =>
		cartridgeSerials.map(({ serial }) => serial),
	),
);
const releasesOfHeaderCode = Map.groupBy(
	releases.flatMap((release) =>
		release.roms.flatMap((id) => {
			const dat = id.split("-")[0];
			return roms
				.get(id)!
				.headerCodes.map((code) => ({ key: `${dat} ${code}`, release }));
		}),
	),
	({ key }) => key,
);
const ocrText = (key: string) => {
	const path = `${labels}/generated/read-serials/ocr/${key.replace(/[@,]/g, "_")}.json`;
	return existsSync(path)
		? json<{ text: string }[]>(path).map(({ text }) => text)
		: [];
};

// Full serials only, e.g. AGB-BC2J-JPN: a bare code, e.g. AGB-BC2J, may be a cut-off read.
const photosOfSerial = Map.groupBy(
	Object.entries(reads).filter(
		([, { release, serial }]) =>
			!release &&
			serial &&
			/^(DMG|CGB|AGB)-[0-9A-Z]{4}-[A-Z]{3}$/.test(serial) &&
			!known.has(serial),
	),
	([, { serial }]) => serial!,
);

const candidates = [...photosOfSerial]
	.map(([serial, photos]) => {
		const [system, code] = serial.split("-") as [string, string];
		return {
			serial,
			photos: photos.map(([key, read]) => {
				const sha1 = key.split("@")[0]!;
				const source = photoSources[sha1] ?? {};
				return {
					key,
					file: photoFiles.find((file) => file.startsWith(`${sha1}.`)),
					decidedBy: read.decided_by,
					reads: read.reads.map(({ text }) => text),
					ocr: ocrText(key),
					titleGuess: read.title_guess,
					pageUrl: source.page_url,
					titleOnPage: source.title_on_page,
				};
			}),
			byHeaderCode: [
				...new Set(
					(
						releasesOfHeaderCode.get(`${system.toLowerCase()} ${code}`) ?? []
					).map(({ release }) => release),
				),
			].map(({ id, gameId, title, cartridgeSerials }) => ({
				id,
				gameId,
				title: title.title,
				labelSerials: cartridgeSerials.map(({ serial }) => serial),
			})),
			gbxDumper: gbxDumper
				.filter((entry) => entry.serial === serial)
				.map(({ internalName, crc32 }) => ({ internalName, crc32 })),
		};
	})
	.sort((a, b) => a.serial.localeCompare(b.serial));

console.log(JSON.stringify(candidates, null, "\t"));
console.error(
	`${candidates.length} serials read on photos that no release has: ${candidates.filter(({ byHeaderCode }) => byHeaderCode.length === 1).length} the header code of one release, ${candidates.filter(({ byHeaderCode }) => !byHeaderCode.length).length} of none (likely misreads).`,
);
