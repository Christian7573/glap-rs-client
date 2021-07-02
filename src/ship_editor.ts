import * as PIXI from "pixi.js";
import { PartKind } from "./codec";
import { parse as qs_parse } from "query-string";
import { RecursivePart, part_kind_info } from "./ship_editor_parts";
import { validate as lib_uuid_validate } from "uuid";

export const params = window.location.href.indexOf("?") > -1 ? qs_parse(window.location.href.substr(window.location.href.indexOf("?") + 1)) : {};
console.log("RE");
console.log(params);
export const never_promise = new Promise(() => {});

let session: string = null; 
if ("localStorage" in window) session = window.localStorage.getItem("session");
const has_session = session !== null && lib_uuid_validate(session);
console.log("Has session: " + has_session);

export interface GlobalData {
	scaling: PIXI.Container;
	world: PIXI.Container;
	grabbed_container: PIXI.Container;
	spritesheet: PIXI.Spritesheet;
	on_part_grab: ((part: RecursivePart, e: PIXI.InteractionEvent) => void);

	sidebar: PIXI.Container;
	pane_background: PIXI.Graphics;
	pane_background_again: PIXI.Graphics;
	pane_background_separator: PIXI.Graphics;
	pane_border: PIXI.TilingSprite;

	inventory_holder: PIXI.Container;
	inventory_holder_holder: PIXI.Container;
	scrollbar_holder: PIXI.Container;
	scrollbar: PIXI.Graphics;
	scrollbar_height: number;
	scrollbar_max: number;
	inventory_height: number;

	pane_size: number;
	zoom: number;
	raw_scale_up: number;
	scale_up: number;

	save_data_provider: SaveDataProvider;
	total_inventory: Map<PartKind, number>;
	local_inventory: Map<PartKind, Box<number>>;
	layout: RecursivePart;
	all_roots: RecursivePart[];
}

export const global: GlobalData = {
	scaling: new PIXI.Container(),
	world: new PIXI.Container(),
	grabbed_container: new PIXI.Container(),
	spritesheet: null,
	on_part_grab: null,

	sidebar: new PIXI.Container(),
	pane_background: new PIXI.Graphics().beginFill(0xaba9b7).drawRect(0,0,1,1).endFill(),
	pane_background_again: new PIXI.Graphics().beginFill(0x6e6a6a).drawRect(0,0,1,1).endFill(),
	pane_background_separator: new PIXI.Graphics().beginFill(0x4c484a).drawRect(0,0,1,1).endFill(),
	pane_border: null,

	inventory_holder: new PIXI.Container(),
	inventory_holder_holder: new PIXI.Container(),
	scrollbar_holder: new PIXI.Container(),
	scrollbar: new PIXI.Graphics().beginFill(0x6e6a6a).drawRect(0,0,1,1).endFill(),
	scrollbar_height: 1,
	scrollbar_max: 0,
	inventory_height: 0,

	pane_size: 0,
	zoom: 1,
	raw_scale_up: 0,
	scale_up: 0,

	save_data_provider: null,
	total_inventory: new Map(),
	local_inventory: new Map(),
	layout: null,
	all_roots: [],
};
(window as any)["global"] = global;

export interface SaveDataProvider {
	set_session(session: string): Promise<void>;
	get_slots(): Promise<SaveDataSlot[]>;
	get_current_layout(): Promise<SaveDataProviderRecursivePartDescription>;
	set_current_layout(layout: SaveDataProviderRecursivePartDescription): Promise<void>;
	get_slot_layout(slot: string): Promise<SaveDataProviderRecursivePartDescription>;
	set_slot_layout(slot: string, layout: SaveDataProviderRecursivePartDescription): Promise<void>;
	get_inventory(): Promise<{ [key: number]: number }>;
	get_beamout_kind(): Promise<"beamout" | "dock" | null>;
}
export interface SaveDataSlot {
	id: string;
	display_name: string;
}
export interface SaveDataProviderRecursivePartDescription {
	kind: PartKind;
	attachments: SaveDataProviderRecursivePartDescription[];
}

const app = new PIXI.Application({ autoStart: false, width: window.innerWidth, height: window.innerHeight, antialias: true, });
document.body.appendChild(app.view);
app.view.setAttribute("draggable", "false");

const blueprint_texture = PIXI.Texture.from("./blueprint.png");
blueprint_texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
const blueprint = new PIXI.TilingSprite(blueprint_texture, 300, 300);
blueprint.anchor.set(0.5,0.5);
blueprint.tileScale.set(1/80);
blueprint.tilePosition.set(-2.45, -2.45);

app.stage.addChild(global.scaling);
global.scaling.addChild(blueprint);
global.scaling.addChild(global.world);

app.stage.addChild(global.sidebar);
global.sidebar.addChild(global.pane_background);

global.sidebar.addChild(global.inventory_holder_holder);
global.inventory_holder_holder.addChild(global.inventory_holder);
global.sidebar.addChild(global.scrollbar_holder);
global.scrollbar_holder.addChild(global.scrollbar);

global.sidebar.addChild(global.pane_background_again);
global.sidebar.addChild(global.pane_background_separator);

app.stage.addChild(global.grabbed_container);

if (typeof params["save_data_provider"] !== "string") { alert("Invalid save data provider url"); throw new Error("Invalid save data provider url"); }
const save_data_provider_url = params["save_data_provider"] as string;
const save_data_provider_is_module = "save_data_provider_is_module" in params ? params["save_data_provider_is_module"] == "true" : false;
if (typeof params["spritesheet"] !== "string") { alert("Invalid spritesheet url"); throw new Error("Invalid spritesheet url"); }
const spritesheet_url_base = params["spritesheet"] as string;

class PartInventoryDisplay {
	kind: PartKind;
	part: RecursivePart;
	count_display: PIXI.Text = new PIXI.Text("");
	container = new PIXI.Container();
	constructor(kind: PartKind) {
		this.kind = kind;
		this.container.addChild(this.count_display);
		this.count_display.position.set(1.25, -0.8);
		this.count_display.height = 0.6;
	}

	init_part() {
		if (this.part != null) {
			this.container.removeChild(this.part.container);
		}
		this.part = new RecursivePart(this.kind, [null, null, null, null], true);
		this.container.addChild(this.part.container);
		this.part.container.position.set(0.5,0);
		this.part.sprite.interactive = true;
		this.part.sprite.once("pointerdown", (e: PIXI.InteractionEvent) => {
			const part = this.part;
			this.part = null;
			global.all_roots.push(part);
			global.on_part_grab(part, e);
			global.local_inventory.get(this.kind).v--;
			this.update_text();
			global.grabbed_container.localTransform.applyInverse(e.data.global, part.container.position);
			currently_grabbed_from = this;
		});
	}

	update_text() {
		const local_count = global.local_inventory.get(this.kind).v;
		const total_count = global.total_inventory.get(this.kind) ?? 0;
		if (local_count < 0) this.count_display.style.fill = "red";
		else this.count_display.style.fill = "white";
		this.count_display.text = `${local_count}/${total_count}`;
		this.count_display.updateText(true);
		this.count_display.width = this.count_display.texture.width / this.count_display.texture.height * this.count_display.height;
	}
}

let currently_grabbed_from: PartInventoryDisplay = null;
const inventoried_parts = [
	PartKind.Hub,
	PartKind.PowerHub,
	PartKind.HubThruster,
	PartKind.SolarPanel,
	PartKind.Thruster,
	PartKind.LandingThruster,
	PartKind.SuperThruster,
	PartKind.EcoThruster,
	PartKind.Cargo,
];

let inventory_y = 1.25;
const inventory_displayers = new Map<PartKind, PartInventoryDisplay>();
for (const part of inventoried_parts) {
	const display = new PartInventoryDisplay(part);
	global.inventory_holder.addChild(display.container);			
	display.container.y = inventory_y;
	inventory_y += 1.25;
	inventory_displayers.set(part, display);
}

let do_inventory_scroll = false;
let scroll_y_offset = 0;
let is_scrollbar_scrolling = false;
function inventory_scroll_wheel(delta_y: number) {
	if (!do_inventory_scroll) return;
	global.scrollbar.y = Math.min(Math.max(0, global.scrollbar.y += delta_y * 1.3), global.scrollbar_max);
	global.inventory_holder.y = -(global.scrollbar.y / (global.scrollbar_max + global.scrollbar_height)) * global.inventory_height;
}
function inventory_scroll_drag(e: MouseEvent) {
	if (!do_inventory_scroll || !is_scrollbar_scrolling) return;
	global.scrollbar.y = Math.min(Math.max(0, e.y - scroll_y_offset), global.scrollbar_max);
	global.inventory_holder.y = -(global.scrollbar.y / (global.scrollbar_max + global.scrollbar_height)) * global.inventory_height;
}

global.scrollbar.interactive = true;
global.scrollbar.on("pointerdown", (e: PIXI.InteractionEvent) => {
	if (!do_inventory_scroll) return;
	is_scrollbar_scrolling = true;
	scroll_y_offset = e.data.global.y - global.scrollbar.y;
});
app.view.addEventListener("mousemove", inventory_scroll_drag);
window.addEventListener("mouseup", () => { is_scrollbar_scrolling = false; });

const sidebar_panel: HTMLDivElement = document.querySelector("#sidebar_panel");

export function resize() {
    const window_size = Math.min(window.innerWidth, window.innerHeight);
	app.view.width = window.innerWidth;
	app.view.height = window.innerHeight;
    app.renderer.resize(window.innerWidth, window.innerHeight);
	global.pane_size = Math.max(window.innerWidth * 0.14, 200);
	const pane_border_size = global.pane_size * 0.1 * 0.5;
    global.scaling.position.set(app.view.width / 2 + global.pane_size + pane_border_size, app.view.height / 2);
    global.raw_scale_up = Math.max(window_size * (0.045545023696682464), 30);
    global.scale_up = global.raw_scale_up * global.zoom;
    global.scaling.scale.set(global.scale_up, global.scale_up);
	global.grabbed_container.position.copyFrom(global.scaling.position);
	global.grabbed_container.scale.copyFrom(global.scaling.scale);

	global.pane_background.width = global.pane_size;
	global.pane_background.height = window.innerHeight;
	global.pane_background_again.width = global.pane_size;
	global.pane_background_again.height = global.pane_size;
	global.pane_background_separator.width = global.pane_size;
	global.pane_background_separator.height = 8;
	global.pane_background_separator.y = global.pane_size;
	global.pane_border.height = pane_border_size;
	global.pane_border.width = window.innerHeight;
	global.pane_border.x = global.pane_size;
	global.pane_border.tileScale.y = 2 / pane_border_size;
	global.pane_border.tileScale.x = global.pane_border.tileScale.y / global.pane_border.texture.height * global.pane_border.texture.width;

	global.inventory_holder.scale.set(global.pane_size * 0.9 / 5);
	global.inventory_holder_holder.x = global.pane_size * 0.05;
	global.scrollbar_holder.y = global.inventory_holder_holder.y = global.pane_background_separator.height + global.pane_background_separator.y;
	const inventory_height = window.innerHeight - global.pane_size;
	global.inventory_height = inventory_height;
	const inventory_needed_height = global.inventory_holder.height;
	if (inventory_height < inventory_needed_height) {
		global.scrollbar.height = global.scrollbar_height = inventory_height / inventory_needed_height * (inventory_height - 20);
		global.scrollbar_holder.y += 10;
		global.scrollbar_max = inventory_height - 20 - global.scrollbar_height;
		global.scrollbar_holder.x = global.pane_size * 0.9;
		global.scrollbar.width = global.pane_size * 0.03;
		global.scrollbar.visible = do_inventory_scroll = true;
		do_inventory_scroll = true;
	} else {
		global.scrollbar.visible = do_inventory_scroll = false;
		do_inventory_scroll = false;
	}
	global.inventory_holder.y = 0;
	global.scrollbar.y = 0;
	is_scrollbar_scrolling = false;

	sidebar_panel.style.width = sidebar_panel.style.height = `${global.pane_size}px`;
}

const save_data_provider = new Promise((resolve, reject) => {
	(window as any).save_data_provider_hooks = [resolve, reject];
	const script_el = document.createElement("script");
	script_el.setAttribute("src", save_data_provider_url);
	if (save_data_provider_is_module) script_el.setAttribute("type", "module");
	script_el.setAttribute("async", "");
	script_el.addEventListener("error", e => reject(e));
	document.head.appendChild(script_el);
});

let spritesheet: PIXI.Spritesheet = null;
new Promise(async (resolve, _reject) => {
    const image_promise: Promise<HTMLImageElement> = new Promise((resolve, reject) => {
        const image = document.createElement("img");
        image.src = `${spritesheet_url_base}.png`;
        image.onload = () => { resolve(image); }
        image.onerror = err => reject(err);
    });
    const dat_promise: Promise<Object> = fetch(`${spritesheet_url_base}.json`).then(res => res.json());
    const image = await image_promise;
    const dat = await dat_promise;
    const texture = PIXI.Texture.from(image);
    spritesheet = new PIXI.Spritesheet(texture, dat);
	global.spritesheet = spritesheet;
    spritesheet.parse(resolve);
}).then(() => save_data_provider)
.then(async (save_data_provider: SaveDataProvider) => {
	global.save_data_provider = save_data_provider;

	await save_data_provider.set_session(session);
	const inventory = await save_data_provider.get_inventory();
	for (const key in inventory) {
		const part_kind = parseInt(key);
		global.total_inventory.set(part_kind, inventory[part_kind]);
	}

	global.layout = RecursivePart.inflate(await save_data_provider.get_current_layout());
	global.all_roots.push(global.layout);

}).catch(err => { alert("Failed to load save data"); console.error(err); return never_promise; })
.then(() => {
	global.pane_border = new PIXI.TilingSprite(global.spritesheet.textures["tiling_caution_border.png"], 1, 1);
	global.sidebar.addChild(global.pane_border);
	global.pane_border.rotation = Math.PI / 2;

	reset_local_inventory();
	inventory_take_parts(global.layout, true);
	global.world.addChild(global.layout.container);
	for (const display of inventory_displayers.values()) {
		display.init_part();
		display.update_text();
	}

	resize();
	window.addEventListener("resize", resize);
	sidebar_panel.style.display = "flex";

	blueprint.interactive = true;
	let blueprint_dragging = false;
	let prev_blueprint_coords: [number, number] = [0, 0];
	blueprint.on("pointerdown", (e: PIXI.InteractionEvent) => {
		prev_blueprint_coords = [e.data.global.x, e.data.global.y];
		blueprint_dragging = true;
	});
	blueprint.on("pointermove", (e: PIXI.InteractionEvent) => {
		if (!blueprint_dragging) return;
		const coords = [e.data.global.x, e.data.global.y];
		const dx = (coords[0] - prev_blueprint_coords[0]) / global.scale_up;
		const dy = (coords[1] - prev_blueprint_coords[1]) / global.scale_up;
		global.world.x += dx;
		global.world.y += dy;
		blueprint.tilePosition.x += dx;
		blueprint.tilePosition.y += dy;
		prev_blueprint_coords = coords as [number, number];
	});
	blueprint.on("mouseup", (_e: PIXI.InteractionEvent) => {
		blueprint_dragging = false;
	});

    app.view.addEventListener("wheel", event => {
		const deltaY = Math.abs(event.deltaY) > 50 ? event.deltaY / 50 : event.deltaY
		if (event.x < global.pane_size) {
			inventory_scroll_wheel(deltaY);
			return;
		}

	    const origional_position = new PIXI.Point(event.x, event.y);
		global.world.worldTransform.applyInverse(origional_position, origional_position);

		global.zoom -= deltaY * 0.01;
		if (global.zoom > 1.75) global.zoom = 1.75;
		else if (global.zoom < 0.4) global.zoom = 0.4;
		resize();
		global.scaling.transform.updateTransform(global.scaling.parent.transform);
		global.world.transform.updateTransform(global.world.parent.transform);

		const new_position = new PIXI.Point(event.x, event.y);
		global.world.worldTransform.applyInverse(new_position, new_position);
		const dx = new_position.x - origional_position.x;
		const dy = new_position.y - origional_position.y;
		global.world.x += dx;
		global.world.y += dy;
		blueprint.tilePosition.x += dx;
		blueprint.tilePosition.y += dy;
	});

	toggle_interface_enabled(true);

	let grabbed_part: RecursivePart = null;
	let prev_coordinates: [number, number] = [0, 0];
	function on_part_grab(part_grabbed: RecursivePart, e: PIXI.InteractionEvent) {
		if (grabbed_part != null) return;
		prev_coordinates = [e.data.global.x, e.data.global.y];
		for (let i = 0; i < global.all_roots.length; i++) {
			const root = global.all_roots[i];
			if (root === part_grabbed && root.kind != PartKind.Core) {
				grabbed_part = root;
				global.all_roots.splice(i,1);
				global.world.removeChild(grabbed_part.container);
				global.grabbed_container.addChild(grabbed_part.container);
				grabbed_part.container.x += global.world.x;
				grabbed_part.container.y += global.world.y;
				break;
			} else {
				const transforms: PIXI.Matrix[] = [root.container.localTransform.clone()];
				function recursive_search(part: RecursivePart): boolean {
					for (let i = 0; i < part.attachments.length; i++) {
						const attachment = part.attachments[i];
						if (attachment != null) {
							transforms.push(attachment.container.localTransform.clone());
							if (attachment === part_grabbed) {
								grabbed_part = attachment;
								part.attachments[i] = null;
								part.update_attachments();
								return true;
							}
							if (recursive_search(attachment)) return true;
							transforms.pop();
						}
					}
					return false;
				}
				transforms.push(global.world.localTransform.clone());
				if (recursive_search(root)) {
					const transform = PIXI.Matrix.IDENTITY;
					while (transforms.length > 0) { 
						const my_transform = transforms.pop();
						transform.prepend(my_transform);
					} 
					grabbed_part.container.transform.setFromMatrix(transform);
					global.grabbed_container.addChild(grabbed_part.container);
					break;
				}
			}
		}
		(window as any).grabbed_part = grabbed_part;
	};
	global.on_part_grab = on_part_grab;
	const pointer_move = (e: MouseEvent) => {
		if (grabbed_part == null) return;
		const coords: [number, number] = [e.x, e.y];
		grabbed_part.container.position.x += (coords[0] - prev_coordinates[0]) / global.scale_up;
		grabbed_part.container.position.y += (coords[1] - prev_coordinates[1]) / global.scale_up;
		prev_coordinates = coords;
	};
	window.addEventListener("mousemove", pointer_move);
	const pointer_up =  (e: MouseEvent) => {
		if (grabbed_part == null) return;
		if (e.x < global.pane_size) {
			inventory_return_parts(grabbed_part, true);
			global.grabbed_container.removeChild(grabbed_part.container);
			grabbed_part = null;
			for (const display of inventory_displayers.values()) display.update_text();
			if (currently_grabbed_from != null) {
				currently_grabbed_from.init_part();
				currently_grabbed_from = null;
			}
			return;
		}
		const attach_threshold = 0.4;// * global.scale_up;
		function recursive_attach(part: RecursivePart, transform: PIXI.Matrix): boolean {
			const attach_info = part_kind_info.get(part.kind).attachments;
			for (let i = 0; i < attach_info.length; i++) {
				if (attach_info[i] == null) continue;
				const transformed_attach_point = new PIXI.Point(attach_info[i].dx, attach_info[i].dy);								
				transform.apply(transformed_attach_point, transformed_attach_point);
				if (
					Math.abs(transformed_attach_point.x - grabbed_part.container.x) < attach_threshold
				 && Math.abs(transformed_attach_point.y - grabbed_part.container.y) < attach_threshold
				 && part.attachments[i] == null
				) {
					global.grabbed_container.removeChild(grabbed_part.container);
					part.attachments[i] = grabbed_part;
					part.update_attachments();
					grabbed_part = null
					return true;
				}

				if (part.attachments[i] != null) {
					const new_transform = transform.clone();
					new_transform.append(part.attachments[i].container.localTransform);
					if (recursive_attach(part.attachments[i], new_transform)) return true;
				}
			}
			return false;
		}
		let attached = false;
		for (const root of global.all_roots) {
			const world_transform = root.container.localTransform.clone();
			world_transform.append(global.world.localTransform);
			if (recursive_attach(root, world_transform)) { attached = true; break; }
		}
		if (!attached) {
			global.all_roots.push(grabbed_part);
			global.grabbed_container.removeChild(grabbed_part.container);
			grabbed_part.container.x -= global.world.x;
			grabbed_part.container.y -= global.world.y;
			global.world.addChild(grabbed_part.container);
			grabbed_part = null;
		}
		if (currently_grabbed_from != null) {
			currently_grabbed_from.init_part();
			currently_grabbed_from = null;
		}
	};
	window.addEventListener("mouseup", pointer_up);

	
	function render() {
		app.render();	
		requestAnimationFrame(render);
	}
	requestAnimationFrame(render);
});

function reset_local_inventory() {
	global.local_inventory.clear();
	for (const [kind, count] of global.total_inventory) {
		global.local_inventory.set(kind, new Box(count));
	}
	for (const kind of inventoried_parts) {
		if (!global.local_inventory.has(kind)) global.local_inventory.set(kind, new Box(0));
	}
}
function inventory_take_parts(parts: RecursivePart, recurse: boolean) {
	function do_recurse(part: RecursivePart) {
		if (!global.local_inventory.has(part.kind)) global.local_inventory.set(part.kind, new Box(0));
		global.local_inventory.get(part.kind).v -= 1;
		if (recurse) {
			for (const attachment of part.attachments) {
				if (attachment != null) do_recurse(attachment);
			}
		}
	}
	do_recurse(parts);
	//TODO update inventory text
}
function inventory_return_parts(parts: RecursivePart, recurse: boolean) {
	function do_recurse(part: RecursivePart) {
		const inv = global.local_inventory.get(part.kind);
		if (inv != null) inv.v += 1;
		if (recurse) {
			for (const attachment of part.attachments) {
				if (attachment != null) do_recurse(attachment);
			}
		}
	}
	do_recurse(parts);
	//TODO update inventory text
}

export function pixi_matrix_mult(transform: PIXI.Matrix, my_transform: PIXI.Matrix, out: PIXI.Matrix) {
	const na = (transform.a * my_transform.a) + (transform.b * my_transform.c);
	const nb = (transform.a * my_transform.b) + (transform.b * my_transform.d);
	const nc = (transform.c * my_transform.a) + (transform.d * my_transform.c);
	const nd = (transform.c * my_transform.b) + (transform.d * my_transform.d);
	const nx = (transform.a * my_transform.tx) + (transform.b * my_transform.ty) + (transform.tx * 1);
	const ny = (transform.c * my_transform.tx) + (transform.d * my_transform.ty) + (transform.ty * 1);
	out.set(na, nb, nc, nd, nx, ny);
}

export class Box<T> { v: T; constructor(v: T) { this.v = v; } }

let is_save_loading = false;
const save_selection = document.querySelector("#save_to") as HTMLSelectElement;
save_selection.selectedIndex = 0;
const load_selection = document.querySelector("#load_from") as HTMLSelectElement;
load_selection.selectedIndex = 0;
const clear_button = document.querySelector("#clear") as HTMLButtonElement;
const save_button = document.querySelector("#save") as HTMLButtonElement;
const launch_button = document.querySelector("#launch") as HTMLImageElement;
const msg_spot = document.querySelector("#msg_spot") as HTMLDivElement;

function toggle_interface_enabled(enabled: boolean) {
	const disabled = !enabled;
	save_selection.disabled = disabled;
	load_selection.disabled = disabled;
	clear_button.disabled = disabled;
	save_button.disabled = disabled;
}
toggle_interface_enabled(false);

save_data_provider.then(async (save_data_provider: SaveDataProvider) => {
	const slots = await save_data_provider.get_slots();
	for (const slot of slots) {
		const option_el = document.createElement("option");
		option_el.innerText = slot.display_name;
		option_el.value = slot.id;
		save_selection.appendChild(option_el.cloneNode(true));
		load_selection.appendChild(option_el.cloneNode(true));
	}
});

async function on_save_updated(save_to_current: boolean): Promise<boolean> {
	if (is_save_loading || (save_selection.selectedIndex === 0 && !save_to_current)) return;

	if (save_to_current && await global.save_data_provider.get_beamout_kind() === "dock") {
		for (const part_count of global.local_inventory.values()) {
			if (part_count.v > 0) {
				if (confirm("You have not loaded all parts onto your ship. When you beamin, extra parts will be destroyed. Do you want to proceed?")) break;
				else return false;
			}
		}
		if (global.all_roots.length > 1 && !confirm("You have not attached all segments to your ship. When you beamin, dangling parts will be destroyed. Do you want to proceed?")) return;
	}

	is_save_loading = true;
	toggle_interface_enabled(false);
	msg_spot.innerText = "Saving...";
	msg_spot.classList.remove("error");
	let success;
	try {
		if (save_to_current) await global.save_data_provider.set_current_layout(global.layout.deflate());
		else await global.save_data_provider.set_slot_layout(save_selection.value, global.layout.deflate());
		msg_spot.innerText = "Saved!";
		success = true;
	} catch (e) {
		console.error(e);
		msg_spot.innerText = "Failed to save layout";
		msg_spot.classList.add("error");
		success = false;
	}
	save_selection.selectedIndex = 0;
	toggle_interface_enabled(true);
	is_save_loading = false;
	return success;
}
save_selection.addEventListener("change", on_save_updated.bind(null, false));
save_button.addEventListener("click", on_save_updated.bind(null, true));

async function on_load_updated() {
	if (is_save_loading || load_selection.selectedIndex === 0) return;
	is_save_loading = true;
	toggle_interface_enabled(false);
	msg_spot.innerText = "Loading...";
	msg_spot.classList.remove("error");
	try {
		const new_layout = load_selection.selectedIndex > 1 ? await global.save_data_provider.get_slot_layout(load_selection.value) : await global.save_data_provider.get_current_layout();
		inventory_return_parts(global.layout, true);
		const old = global.layout;
		const parent = old.container.parent;
		parent.removeChild(old.container);
		const layout = RecursivePart.inflate(new_layout);
		parent.addChild(layout.container);
		global.layout = layout;
		global.all_roots[global.all_roots.indexOf(old)] = layout;
		inventory_take_parts(layout, true);
		for (const display of inventory_displayers.values()) display.update_text();
		msg_spot.innerText = "Loaded";
	} catch (e) {
		console.error(e);
		msg_spot.innerText = "Failed to load layout";
		msg_spot.classList.add("error");
	}
	load_selection.selectedIndex = 0;
	toggle_interface_enabled(true);
	is_save_loading = false;
}
load_selection.addEventListener("change", on_load_updated);


function clear_completly() {
	if (is_save_loading) return;
	const parent = global.layout.container.parent;
	for (const root of global.all_roots) {
		root.container.parent.removeChild(root.container);
	}
	global.all_roots.splice(0, global.all_roots.length);
	global.layout = new RecursivePart(PartKind.Core, [null, null, null, null], true);
	global.all_roots[0] = global.layout;
	parent.addChild(global.layout.container);
	reset_local_inventory();
	for (const display of inventory_displayers.values()) display.update_text();
}
clear_button.addEventListener("click", clear_completly);

async function commit_launch() {
	if (!(await on_save_updated(true))) return;
	if (!msg_spot.classList.contains("error")) window.location = "/?commit_launch" as any;
}
launch_button.addEventListener("click", commit_launch);
