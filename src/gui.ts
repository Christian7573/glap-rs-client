import { global } from "./index";
import { ToServerMsg, PlanetKind, BeamoutKind } from "./codec";
import * as PIXI from 'pixi.js';
import { Planet } from "./planets";

export class Starguide {
    background: PIXI.Graphics;
	background_outline: PIXI.Graphics;
    public container: PIXI.Container = new PIXI.Container();
    is_open = false;
    animation_ms: number = 0;
    pre_render: Function;
    offscreen_y = -100;
    onscreen_y = 1;
    width = 1;
    height = 1;
    center: [number, number] = [0, 0];
    mouseover = false;
    is_dragging = false;

    map_coordinate_space = new PIXI.Container();
    map_items = new PIXI.Container();
    map_mask: PIXI.Graphics;
    map_zoom = 1000;
    map_zoom_divisor = 1;
    following_core = true;
    map_zoom_factor = this.map_zoom / this.map_zoom_divisor;
    core_sprite = new PIXI.Sprite();
    destination_hologram: PIXI.TilingSprite;
    destination_hologram_margin_core: number;
    destination_hologram_mask = new PIXI.Container();
    destination_hologram_rectangle = new PIXI.Graphics().beginFill(0xffffff).drawRect(-1,-0.5,1,1).endFill();
    current_destination: Planet = null;
    planets: Map<Planet, PIXI.Container> = new Map();
	orbit_rings: Map<Planet, PIXI.Graphics> = new Map();
    map_lines = new PIXI.Graphics();
	static_effect = new PIXI.Container();
	static_effect_onframe: Function = null;
	static_effect_width: number;
    static_effect_height: number;
    planet_names: PIXI.Text[] = [];

    constructor() {
        this.container.visible = false;
        this.pre_render = () => {};
        this.map_coordinate_space.addChild(this.map_items);
        this.core_sprite.texture = global.spritesheet.textures["starguide_core.png"];
        this.core_sprite.anchor.set(0.5,0.5);
        this.map_coordinate_space.addChild(this.core_sprite);
        this.map_items.addChild(this.map_lines);

        this.destination_hologram = new PIXI.TilingSprite(global.spritesheet.textures["starguide_destination_hologram.png"], 2);
        this.destination_hologram.anchor.set(1,0.5);
        this.destination_hologram.mask = this.destination_hologram_mask;
        this.map_coordinate_space.addChild(this.destination_hologram);
        this.map_coordinate_space.addChild(this.destination_hologram_mask);
        this.destination_hologram_mask.addChild(this.destination_hologram_rectangle);

		//Do static effect
		const static_texture = global.spritesheet.textures["static.png"];
		const static_tiles_across = 2;
		const static_tiles_down = 2;
		const static_tile_width = 1 / static_tiles_across;
		const static_tile_height = 1 / static_tiles_down;
		for (let x = -1; x <= static_tiles_across; x++) {
			for (let y = -1; y <= static_tiles_down; y++) {
				const sprite = new PIXI.Sprite(static_texture);
				sprite.x = static_tile_width * x;
				sprite.y = static_tile_height * y;
				sprite.width = static_tile_width;
				sprite.height = static_tile_height;
				this.static_effect.addChild(sprite);
			}
		}
		this.static_effect_width = this.static_effect.width;
		this.static_effect_height = this.static_effect.height;

        this.container.addListener("mouseover", () => {
            this.mouseover = true;
            global.pixi.view.style.cursor = "grab";
        });
        this.container.addListener("mouseout", () => {
            this.mouseover = false;
            this.is_dragging = false;
            global.pixi.view.style.cursor = "default";
        });
        let prev_location: [number, number];
        this.container.addListener("mousedown", e => {
            this.is_dragging = true;
            prev_location = [e.data.global.x, e.data.global.y];
            global.pixi.view.style.cursor = "grabbing";
            this.following_core = false;
        });
        this.container.addListener("mousemove", e => {
            if (this.is_dragging) {
                this.map_coordinate_space.position.x += (e.data.global.x - prev_location[0]);
                this.map_coordinate_space.position.y += (e.data.global.y - prev_location[1]);
                prev_location = [e.data.global.x, e.data.global.y];
            }
        });
        this.container.addListener("mouseup", e => {
            if (this.is_dragging) {
                global.pixi.view.style.cursor = this.mouseover ? "grab" : "default";
                this.is_dragging = false;
            }
        });
    }

    update_sprites(width: number, height: number, container_offset_x: number, container_offset_y: number) {
        this.container.removeChildren();
        this.container.position.set(container_offset_x, container_offset_y);
        this.offscreen_y = -container_offset_y - height;
        this.onscreen_y = container_offset_y;
        this.width = width; this.height = height;
        this.center = [width / 2 + container_offset_x, height / 2 + container_offset_y];

        const background_border_radius = height * 0.05;
		this.background = new PIXI.Graphics();
        this.background.beginFill(0x5f0079, 0.69);
        this.background.drawRoundedRect(10, 10, width - 20, height - 20, background_border_radius - 10);
        this.background.endFill();
        this.container.addChild(this.background);

		this.static_effect.visible = false;
		this.static_effect.width = this.static_effect_width * width;
		this.static_effect.height = this.static_effect_height * height;
		this.container.addChild(this.static_effect);
		const static_mask = new PIXI.Graphics();
        static_mask.beginFill(0xffffff);
        static_mask.drawRoundedRect(0, 0, width, height, background_border_radius);
        static_mask.endFill();
		this.container.addChild(static_mask);
		this.static_effect.mask = static_mask;

        this.background_outline = new PIXI.Graphics();
        this.background_outline.beginFill(0xdd55ff);
        this.background_outline.drawRoundedRect(0, 0, width, height, background_border_radius);
        this.background_outline.endFill();
        this.background_outline.beginHole();
        this.background_outline.drawRoundedRect(10, 10, width - 20, height - 20, background_border_radius - 10);
        this.background_outline.endHole();
		this.container.addChild(this.background_outline);

        this.map_mask = new PIXI.Graphics();
        this.map_mask.beginFill(0xffffff);
        this.map_mask.drawRoundedRect(10, 10, width - 20, height - 20, background_border_radius - 10);
        this.map_mask.endFill();
        this.map_coordinate_space.mask = this.map_mask;
        this.container.addChild(this.map_coordinate_space);
        this.container.addChild(this.map_mask);

        this.map_zoom_divisor = Math.min(width, height);
        this.map_zoom_factor = this.map_zoom / this.map_zoom_divisor;
        this.map_items.scale.set(this.map_zoom_factor);
        this.core_sprite.width = Math.max(25, this.map_zoom_factor);
        this.core_sprite.height = this.core_sprite.width;
        this.center_around_core();

        this.destination_hologram.height = this.core_sprite.width * 0.5;
        this.destination_hologram.tileScale.y = this.destination_hologram.height / this.destination_hologram.texture.height;
        this.destination_hologram.tileScale.x = this.destination_hologram.tileScale.y / 2.35;
        this.destination_hologram_margin_core = this.core_sprite.width * Math.SQRT2;
        this.destination_hologram_rectangle.height = this.destination_hologram.height;
        if (this.current_destination !== null) this.retarget_destination_hologram();
    }

    open() {
        if (this.is_open) return;
        this.is_open = true;
        global.starguide_button.update_sprite_texture(true);
        this.container.visible = true;
        this.center_around_core();
        this.following_core = true;

        this.animation_ms = 0;
        this.container.position.y = this.offscreen_y;
        const distance = this.onscreen_y - this.offscreen_y;
		global.onframe.delete(this.pre_render);
        this.pre_render = (delta_ms: number) => {
            this.animation_ms += delta_ms;
            if (this.animation_ms >= 250) {
                this.container.interactive = true;
                this.container.position.y = this.onscreen_y;
				global.onframe.delete(this.pre_render);
            } else {
                this.container.position.y = this.onscreen_y - (this.animation_curve_function(this.animation_ms * 2) * distance);
            }
        }
		global.onframe.add(this.pre_render);
    }
    close() {
        if (!this.is_open) return;
        this.is_open = false;
        global.starguide_button.update_sprite_texture(false);
        this.container.interactive = false;
        if (this.mouseover) {
            this.mouseover = false;
            global.pixi.view.style.cursor = "default";
        }

        this.animation_ms = 0;
        this.container.position.y = this.onscreen_y;
        const distance = this.onscreen_y - this.offscreen_y;
		global.onframe.delete(this.pre_render);
        this.pre_render = (delta_ms: number) => {
            this.animation_ms += delta_ms;
            if (this.animation_ms >= 250) {
                this.container.visible = false;
                this.container.position.y = this.offscreen_y;
				global.onframe.delete(this.pre_render);
            } else {
                this.container.position.y = this.offscreen_y + (this.animation_curve_function(this.animation_ms * 2) * distance);
            }
        }
		global.onframe.add(this.pre_render);
    }
    animation_curve_function(ms: number): number {
        return 0.0000189147 * Math.pow(500 - ms, 1.75);
    }

    update_core_position(core_x: number, core_y: number, core_rotation: number) {
        this.core_sprite.position.set(core_x * this.map_zoom_factor, core_y * this.map_zoom_factor);
        this.core_sprite.rotation = core_rotation;
        if (this.is_open) {
            if (this.following_core) this.center_around_core();
            this.update_destination_hologram();
        }
    }
    center_around_core() {
        this.map_coordinate_space.position.set(this.width / 2 - this.core_sprite.position.x, this.height / 2 - this.core_sprite.position.y);
    }
    add_celestial_object(celestial_object: Planet) {
        console.log(celestial_object);

        const circle = new PIXI.Graphics();
        circle.beginFill(0xdd55ff);
        circle.drawCircle(0, 0, celestial_object.radius);
        circle.endFill();
        
        const mask = new PIXI.Sprite(celestial_object.icon_mask);
        mask.anchor.set(0.5,0.5);
        mask.width = celestial_object.radius * 2;
        mask.height = mask.width;
        circle.mask = mask;
		circle.position.set(0,0);
        //circle.x = celestial_object.position.x;
        //circle.y = celestial_object.position.y;
        mask.position.copyFrom(circle.position);
        //this.map_items.addChild(circle);
        //this.map_items.addChild(mask);

        let text = new PIXI.Text(celestial_object.display_name.toUpperCase(), {fontSize: 60, fill : 0xdd55ff, stroke: 'black', strokeThickness: 1});
        text.height = 25 / this.map_zoom_factor;
        text.width = (text.texture.width / text.texture.height) * text.height * 0.75;
        //text.position.copyFrom(celestial_object.position);
		text.position.copyFrom(circle.position);
        text.anchor.set(0.5, 1);
        text.position.y -= (celestial_object.radius + 15);
        this.planet_names.push(text);

        circle.interactive = true;
        circle.addListener("mousedown", event => {
            event.stopPropagation();
            this.current_destination = celestial_object;
            this.retarget_destination_hologram();
        });

        //this.map_items.addChild(text);

		const container = new PIXI.Container();
		container.addChild(circle);
		container.addChild(mask);
		container.addChild(text);
		this.map_items.addChild(container);
		this.planets.set(celestial_object, container);
    }

    on_wheel(event: WheelEvent, deltaY: number) {
        if (this.is_dragging) return;
        const cursor_at: [number, number] = this.following_core ? [...this.center] : [event.x, event.y];
        const unscaled_space =  [cursor_at[0] - this.container.position.x - this.map_coordinate_space.x, cursor_at[1] - this.container.position.y - this.map_coordinate_space.position.y];
        const scaled_space = [unscaled_space[0] / this.map_zoom_factor, unscaled_space[1] / this.map_zoom_factor];
        //console.log(scaled_space);
        this.map_zoom -= deltaY * 15;
        if (this.map_zoom < 100) this.map_zoom = 100;
        else if (this.map_zoom > 3000) this.map_zoom = 3000;
        this.map_zoom_factor = this.map_zoom / this.map_zoom_divisor;
        this.map_items.scale.set(this.map_zoom_factor);
        this.retarget_destination_hologram();
        const new_unscaled = [scaled_space[0] * this.map_zoom_factor, scaled_space[1] * this.map_zoom_factor];
        this.map_coordinate_space.x -= new_unscaled[0] - unscaled_space[0];
        this.map_coordinate_space.y -= new_unscaled[1] - unscaled_space[1];
        for(var i = 0; i < this.planet_names.length; i++) {
            this.planet_names[i].height = 25 / this.map_zoom_factor;
            this.planet_names[i].width = ((this.planet_names[i].texture.width / this.planet_names[i].texture.height) * this.planet_names[i].height * 0.75);
        }
    }

    update_destination_hologram() {
        const distance = [this.core_sprite.x - this.destination_hologram.x, this.core_sprite.y - this.destination_hologram.y];
        const actual_distance = Math.sqrt(Math.pow(distance[0], 2) + Math.pow(distance[1], 2));
        const distance_without_margin = actual_distance - this.destination_hologram_margin_core;
        this.destination_hologram.width = actual_distance;
        this.destination_hologram.rotation = Math.atan2(-distance[1], -distance[0]);
        this.destination_hologram_mask.rotation = this.destination_hologram.rotation;
        this.destination_hologram.tilePosition.x = this.destination_hologram.width;
        if (distance_without_margin > 0) {
            this.destination_hologram.visible = true;
            this.destination_hologram_rectangle.width = distance_without_margin;
        } else this.destination_hologram.visible = false;
    }
    retarget_destination_hologram() {
        const meta = this.current_destination;
		if (meta == null) return;
        global.destination_hologram.position.copyFrom(meta.position);
        this.destination_hologram.position.set(meta.position.x * this.map_zoom_factor, meta.position.y * this.map_zoom_factor);
        this.destination_hologram_rectangle.position.x = -meta.radius * this.map_zoom_factor;
        this.destination_hologram_mask.position.copyFrom(this.destination_hologram);

        global.main_hud.target_text.text = `Relative to ${meta.display_name}:`;
        global.main_hud.target_text.width = (global.main_hud.target_text.texture.width / global.main_hud.target_text.texture.height) * global.main_hud.target_text.height * 0.1;
        global.main_hud.target_graphic_mask.texture = meta.icon_mask;
    }

	static_effect_on() {
		this.background.visible = false;
		this.static_effect.visible = true;

	}
	static_effect_off() {

	}
}

export class StarguideButton {
    sprite: PIXI.Sprite;
    container: PIXI.Container = new PIXI.Container();
    pre_render: Function;
    private open: boolean;
    constructor() {
        this.sprite = new PIXI.Sprite();
        this.update_sprite_texture(false);
        this.sprite.anchor.set(1,1);
        this.sprite.position.set(0,0);
        this.sprite.height = 1; this.sprite.width = this.sprite.height * 1.38987342;
        this.container.addChild(this.sprite);
        
        this.pre_render = () => {};
        this.sprite.interactive = true;
        this.sprite.addListener("mouseover", () => {
            global.pixi.view.style.cursor = "pointer";
			global.onframe.delete(this.pre_render);
            this.pre_render = (delta_ms: number) => {
                this.sprite.height += /*0.25 / 250 */ 0.001 *  delta_ms;
                if (this.sprite.height >= 1.15) {
                    this.sprite.height = 1.15;
					global.onframe.delete(this.pre_render);
                }
                this.sprite.width = this.sprite.height * 1.38987342;
            };
			global.onframe.add(this.pre_render);
        });
        this.sprite.addListener("mouseout", () => {
            global.pixi.view.style.cursor = "default";
			global.onframe.delete(this.pre_render);
            this.pre_render = (delta_ms: number) => {
                this.sprite.height -= /*0.25 / 250 */ 0.001 *  delta_ms;
                if (this.sprite.height <= 1) {
                    this.sprite.height = 1;
					global.onframe.delete(this.pre_render);
                }
                this.sprite.width = this.sprite.height * 1.38987342;
            };
			global.onframe.add(this.pre_render);
        });
        this.sprite.addListener("click", () => {
            if (this.open) global.starguide.close(); else global.starguide.open();
        });
    }
    update_sprite_texture(is_menu_open: boolean) {
        this.open = is_menu_open;
        this.sprite.texture = global.spritesheet.textures[this.open ? "starguide_close_icon.png" : "starguide_icon.png"];
    }
}

export class MainHud {
    public container: PIXI.Container;
    fuel: PIXI.Graphics;
    fuel_text: PIXI.Text;
    target_text: PIXI.Text;
    position_text: PIXI.Text;
    velocity_text: PIXI.Text;
    target_graphic: PIXI.Graphics;
    target_graphic_mask: PIXI.Sprite;

    constructor() {
        this.container = new PIXI.Container();
        const text_style = new PIXI.TextStyle({
            fill: "white",
        });
        
        const background = new PIXI.Sprite(global.spritesheet.textures["fuel_gague.png"]);
        background.width = 1; background.height = 1;

        this.container.addChild(background);

        const fuel_background = new PIXI.Graphics();
        fuel_background.beginFill(0x00aad4);
        fuel_background.drawRect(0.047274295458486, 0.498618150494084, 0.526532575319202, 0.230238985346539);
        fuel_background.endFill();
        this.container.addChild(fuel_background);

        this.fuel = new PIXI.Graphics();
        this.fuel.beginFill(0x55ddff);
        this.fuel.drawRect(0,0.498618150494084,0.526532575319202,0.230238985346539);
        this.fuel.endFill();
        this.fuel.position.x = 0.047274295458486;
        this.container.addChild(this.fuel);

        this.fuel_text = new PIXI.Text("Energy: 0/0 Kw", text_style);
        this.fuel_text.position.set(0.048566785594363, 0.261918570054953);
        this.fuel_text.width = 0.078612775037128; this.fuel_text.height = 0.204358823718318;
        this.container.addChild(this.fuel_text);

        this.target_text = new PIXI.Text("No Target Set", text_style);
        this.target_text.position.set(0.58387360644962, 0.261918570054953);
        this.target_text.height = 0.204358823718318;
        this.target_text.width = (this.target_text.texture.width / this.target_text.texture.height) * this.target_text.height * 0.1;
        this.container.addChild(this.target_text);
        this.position_text = new PIXI.Text("Pos: 0, 0", text_style);
        this.position_text.position.set(0.584287790788617, 0.4368604813710061);
        this.position_text.height = 0.20575673025882;
        this.position_text.width = (this.position_text.texture.width / this.position_text.texture.height) * this.position_text.height * 0.1;
        this.container.addChild(this.position_text);
        this.velocity_text = new PIXI.Text("Vel: 0, 0", text_style);
        this.velocity_text.position.set(0.58387360644962, 0.6135970024350019);
        this.velocity_text.height = 0.20575673025882;
        this.velocity_text.width = (this.velocity_text.texture.width / this.velocity_text.texture.height) * this.velocity_text.height * 0.1;
        this.container.addChild(this.velocity_text);

        this.target_graphic = new PIXI.Graphics()
            .beginFill(0xffffff)
            .drawEllipse(0, 0, 0.023043042888377, 0.296375077215446)
            .endFill();
        this.target_graphic.position.set(0.955934516927259, 0.245710410436695);
        this.target_graphic_mask = new PIXI.Sprite();
        this.target_graphic_mask.position.copyFrom(this.target_graphic.position);
        this.target_graphic_mask.anchor.set(0.5, 0.5);
        this.target_graphic_mask.width = 0.023043042888377 * 2;
        this.target_graphic_mask.height = 0.296375077215446 * 2;
        this.target_graphic.mask = this.target_graphic_mask;
        //this.container.addChild(this.target_graphic);
        //this.container.addChild(this.target_graphic_mask);
    }

    public set_fuel(fuel: number, max_fuel: number) {
        this.fuel.width = (fuel/max_fuel) * 0.526532575319202;
        this.fuel_text.text = `Energy: ${fuel}/${max_fuel} Kw`;
        this.fuel_text.width = (this.fuel_text.texture.width / this.fuel_text.texture.height) * this.fuel_text.height * 0.1;
    }
}

export function create_planet_icon_mask(icon: PIXI.Texture): PIXI.RenderTexture {
    const mask_size = Math.max(icon.width, icon.height) * Math.SQRT2;
    const mask_texture = PIXI.RenderTexture.create({ width: mask_size, height: mask_size  });
    const mask = new PIXI.Container();
    mask.addChild(new PIXI.Graphics().beginFill(0xffffff).drawRect(0,0,mask_size,mask_size).endFill());
    const mask_sprite = new PIXI.Sprite(icon);
    mask_sprite.position.set((mask_size - icon.width) / 2, (mask_size - icon.height) / 2);
    mask.addChild(mask_sprite);
    global.pixi.renderer.render(mask, mask_texture);
    return mask_texture;
}

export function rotate_vector_with_angle(x: number, y: number, theta: number): [number, number] { return rotate_vector(x, y, Math.sin(theta), Math.cos(theta)); }
export function rotate_vector(x: number, y: number, theta_sin: number, theta_cos: number): [number, number] {
    return [(x * theta_cos) - (y * theta_sin), (x * theta_sin) + (y * theta_cos)];
}


export class BeamOutButton {
	container = new PIXI.Container();
	sprite: PIXI.Sprite;
	constructor(beamout_kind: BeamoutKind) {
		let sprite_name;
		if (beamout_kind === BeamoutKind.Beamout) sprite_name = "beamout_button.png";
		else if (beamout_kind === BeamoutKind.Dock) sprite_name = "dock_button.png";
		else throw new Error("Invalid beamout kind");

		this.sprite = new PIXI.Sprite(global.spritesheet.textures[sprite_name]);
		this.sprite.width = 2; this.sprite.height = 1;
		this.sprite.anchor.set(1,0);
		this.sprite.position.y = -1;
		this.container.addChild(this.sprite);
		this.container.visible = false;

		this.sprite.interactive = true;
		this.sprite.addListener("click", this.commit_beamout.bind(this));
		this.sprite.addListener("mouseover", () => { global.pixi.view.style.cursor = "pointer"; });
		this.sprite.addListener("mouseout", () => { global.pixi.view.style.cursor = "default"; });
	}

	pre_render: Function = function() {};

	can_beamout = false;
	set_can_beamout(can_beamout: boolean) {
		if (can_beamout === this.can_beamout) return;
		this.can_beamout = can_beamout;
		if (can_beamout) {
			this.container.visible = true;
			global.onframe.delete(this.pre_render);
			this.pre_render = this.appear_animation.bind(this);
			global.onframe.add(this.pre_render);
		} else {
			global.onframe.delete(this.pre_render);
			this.pre_render = this.disappear_animation.bind(this);
			global.onframe.add(this.pre_render);
		}
	}

	appear_animation(dt: DOMHighResTimeStamp) {
		this.sprite.y += dt * 0.002;
		if (this.sprite.y > 0) {
			this.sprite.y = 0;
			global.onframe.delete(this.pre_render);
		}
	}
	disappear_animation(dt: DOMHighResTimeStamp) {
		this.sprite.y -= dt * 0.002;
		if (this.sprite.y < -1) {
			this.sprite.y = -1;
			global.onframe.delete(this.pre_render);
			this.container.visible = false;
		}
	}

	has_beamed_out = false;
	commit_beamout() {
		if (!this.can_beamout/*|| this.has_beamed_out*/) return;
		this.has_beamed_out = true;
		global.socket.send((new ToServerMsg.BeamOut()).serialize());
	}
}
