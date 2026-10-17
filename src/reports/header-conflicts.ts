import { readFileSync } from "node:fs";
import { correctSerials, loadSerialCorrections } from "../corrections.ts";
import { codeStem, parseLabelSerial } from "../serials.ts";
import type { NoIntroEntry } from "../importers/no-intro.org/parse.ts";

// Lists cartridge and ROM chip serials in No-Intro whose product code contradicts the game code in the ROM header
// of the same entry, e.g. a serial copied from another game. Only licensed entries are checked.

const entries = JSON.parse(
	readFileSync("data-sources/no-intro.org.json", "utf-8"),
) as NoIntroEntry[];
const corrections = loadSerialCorrections();

// The product code of a serial, e.g. "AXPE" for "AGB-AXPE-USA" and "AGB-AXPE-0".
function productCode(serial: string): string | undefined {
	return serial.split("-")[1];
}

const conflicts = entries
	.filter(
		({ licensing, romHeaderCodes }) =>
			licensing === "licensed" && romHeaderCodes.length,
	)
	.flatMap(
		({
			url,
			noIntroName,
			romHeaderCodes,
			cartridgeSerials,
			romChipSerials,
		}) => {
			// A few header codes are written with the platform, e.g. "DMG-BTSJ".
			const headerStems = romHeaderCodes.map((code) =>
				codeStem(code.split("-").at(-1) ?? code),
			);
			const serials = [
				...correctSerials(
					corrections,
					"no-intro.org",
					url,
					"cartridgeSerials",
					cartridgeSerials,
				).map((serial) => {
					const parsed = parseLabelSerial(serial);
					return {
						field: "cartridge",
						// Other publishers' codes and rejected values aren't checked.
						serial: parsed.kind === "nintendo" ? parsed.serial : "",
					};
				}),
				...correctSerials(
					corrections,
					"no-intro.org",
					url,
					"romChipSerials",
					romChipSerials,
				).map((serial) => ({ field: "ROM chip", serial })),
			];
			return serials
				.filter(({ serial }) => {
					const code = productCode(serial);
					return code?.length === 4 && !headerStems.includes(codeStem(code));
				})
				.map(
					({ field, serial }) =>
						`${noIntroName}: ${field} ${serial}, header ${romHeaderCodes.join("/")}  ${url}`,
				);
		},
	);

console.log(`${conflicts.length} serials contradicting the ROM header\n`);
console.log(conflicts.join("\n"));
