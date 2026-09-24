import cartridges from "../public/cartridges.json";
// import type { Cartridge } from "./Cartridge";

export function App() {
	return (
		<>
			<input list="cartridges" placeholder="Cartridge Serial" />
			<datalist id="cartridges">
				{cartridges.map((cartridge) => (
					<option value={cartridge.code}>
						{cartridge.titles.map((title) => (
							<p>{title}</p>
						))}
					</option>
				))}
			</datalist>
		</>
	);
}
