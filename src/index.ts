import * as PIXI from 'pixi.js';
import * as Particles from 'pixi-particles';
import { ToClientMsg, ToServerMsg, Box, PartKind, PlanetKind } from "./codec";
import { Starguide, MainHud, BeamOutButton, StarguideButton, create_planet_icon_mask } from './gui';
import { PartMeta, CompactThrustMode } from "./parts";
import { parse as qs_parse } from "query-string";
import { validate as lib_uuid_validate } from "uuid";
import { Chat } from './chat';
import { BeamoutParticleConfig, ParticleManager, IncinerationParticleConfig } from "./particles";
import PID from "node-pid-controller";
import { RuntimeGui, load_fonts, load as gui_load, Clamp } from "./gui/base";
import { instantiate_planet, Planet } from "./planets";
import { advance_interpolation, set_next_interpolation } from "./interpolation";

export const TICKS_PER_SECOND = 20;

export const params = window.location.href.indexOf("?") > -1 ? qs_parse(window.location.href.substr(window.location.href.indexOf("?") + 1)) : {};
console.log("RE");
console.log(params);

let session: string = null; 
if ("localStorage" in window) session = window.localStorage.getItem("session");
const has_session = session != null && lib_uuid_validate(session);
console.log("Has session: " + has_session);

export interface GlobalData {
    pixi: PIXI.Application;
	emitters: Set<ParticleManager>;
    scaling: PIXI.Container;
    world: PIXI.Container;
    holograms: PIXI.Container;
    thrust_particles: PIXI.Container;
    planet_sprites: PIXI.Container;
    part_sprites: PIXI.Container;
    connector_sprites: PIXI.Container;
    main_hud: MainHud;
    starguide: Starguide;
    chat: Chat;
	beamout_button: BeamOutButton;
    starguide_button: StarguideButton;
    screen_to_player_space: (x: number, y: number) => [number, number];
    holographic_grab: PIXI.Texture;
	white_box: PIXI.Texture;
    rendering: boolean;
    spritesheet: PIXI.Spritesheet;
    raw_scale_up: number;
    zoom: number;
    scale_up: number;
    destination_hologram: PIXI.TilingSprite;
    heading_hologram: PIXI.Sprite;
    onframe: Set<Function>;

	gui: RuntimeGui;

	socket: WebSocket;
    my_core: PartMeta;
	my_player: PlayerMeta;
    my_id: number;
    parts: Map<number, PartMeta>;
    celestial_objects: Map<number, Planet>;
    players: Map<number, PlayerMeta>;
    server_tick_times: number[];
	server_tick_pid: PID;
	can_beamout: boolean;
}

export const global: GlobalData = {
    pixi: null,
	emitters: new Set(),
    scaling: new PIXI.Container(),
    world: new PIXI.Container(),
    holograms: new PIXI.Container(),
    thrust_particles: new PIXI.ParticleContainer(),
    planet_sprites: new PIXI.Container(),
    part_sprites: new PIXI.Container(),
    connector_sprites: new PIXI.Container(),
    holographic_grab: null,
	white_box: null,
    screen_to_player_space: null,
    main_hud: null,
    starguide: null,
    chat: null,
	beamout_button: null,
    starguide_button: null,
    rendering: true,
    spritesheet: null,
    raw_scale_up: null,
    zoom: 1,
    scale_up: null,
    destination_hologram: null,
    heading_hologram: new PIXI.Sprite(),
	onframe: new Set(),

	gui: null,

	socket: null,
    my_core: null,
	my_player: null,
    my_id: null,
    parts: new Map(),
    celestial_objects: new Map(),
    players: new Map(),
    server_tick_times: null,
	server_tick_pid: null,
	can_beamout: false,
};

const pixi = new PIXI.Application({ autoStart: false, width: window.innerWidth, height: window.innerHeight, antialias: true, transparent: false, backgroundColor: 0 });
global.pixi = pixi;
document.body.appendChild(pixi.view);
pixi.view.addEventListener("contextmenu", e => e.preventDefault());

pixi.stage.addChild(global.scaling);
const background = PIXI.TilingSprite.from("./starfield.jpg", { width: 200, height: 150 }) as PIXI.TilingSprite;
background.tileScale.set(0.008);
background.position.set(-100);
background.zIndex = -100;

global.scaling.addChild(background);
global.world.addChild(global.holograms);
global.world.addChild(global.thrust_particles);
global.world.addChild(global.part_sprites);
global.world.addChild(global.planet_sprites);
global.world.addChild(global.connector_sprites);
global.connector_sprites.zIndex = 10;
global.scaling.addChild(global.world);
global.scaling.interactive = true;

{
    const el_canvas = document.createElement("canvas");
    el_canvas.width = 1500; el_canvas.height = 1;
    const el_context = el_canvas.getContext("2d");
    const el_grado = el_context.createLinearGradient(0,0,1500,0);
    el_grado.addColorStop(0, "rgba(230, 152, 230, 1)");
    el_grado.addColorStop(0.3, "rgba(214, 92, 214, 0.3)");
    el_grado.addColorStop(0.7, "rgba(214, 92, 214, 0.3)");
    el_grado.addColorStop(1, "rgba(230, 152, 230, 1)");
    el_context.fillStyle = el_grado;
    el_context.fillRect(0,0,1500,1);
    global.holographic_grab = PIXI.Texture.from(el_canvas);
    global.holographic_grab.defaultAnchor.set(0, 0.5);
}
{
	const el_canvas = document.createElement("canvas");
	el_canvas.width = 1; el_canvas.height = 1;
	const el_context = el_canvas.getContext("2d");
	el_context.fillStyle = "white";
	el_context.fillRect(0,0,1,1);
	global.white_box = PIXI.Texture.from(el_canvas);
	global.white_box.defaultAnchor.set(0.5,0.5);
}

function resize() {
    const window_size = Math.min(window.innerWidth, window.innerHeight);
    pixi.view.width = window.innerWidth;
    pixi.view.height = window.innerHeight;
    pixi.renderer.resize(window.innerWidth, window.innerHeight);
    global.scaling.position.set(pixi.view.width / 2, pixi.view.height / 2);
    global.raw_scale_up = Math.max(window_size * (0.045545023696682464), 30);
    global.scale_up = global.raw_scale_up * global.zoom;
    global.scaling.scale.set(global.scale_up, global.scale_up);

    const half_win_width = window.innerWidth / 2, half_win_height = window.innerHeight / 2;
    global.screen_to_player_space = (x, y) => [((x - half_win_width) / global.scale_up), ((y - half_win_height) / global.scale_up)];

    const main_hud_width = window.innerWidth * 0.44326579427083335;
    const main_hud_height = main_hud_width * 0.117749597249793;
    global.main_hud.container.position.set((window.innerWidth - main_hud_width) / 2, window.innerHeight - main_hud_height);
    global.main_hud.container.scale.x = main_hud_width; global.main_hud.container.scale.y = main_hud_height;
    global.starguide_button.container.position.set(window.innerWidth, window.innerHeight);
    global.starguide_button.container.scale.set(main_hud_height);
    global.starguide.update_sprites(main_hud_width, window.innerHeight - main_hud_height - 20, (window.innerWidth - main_hud_width) * 0.5, 10);
	global.beamout_button.container.position.set(window.innerWidth, 0);
	global.beamout_button.container.scale.set(global.starguide_button.container.scale.y);

    global.heading_hologram.height = window.innerHeight * 0.75 / global.scaling.scale.y;
    global.heading_hologram.width = global.heading_hologram.height / global.heading_hologram.texture.height * global.heading_hologram.texture.width
}

let my_core_id: number = null;
let max_fuel = 1;

const PI_over_2 = Math.PI / 2;

const spritesheet_url_base = "spritesheet" in params ? params["spritesheet"] : "./spritesheet_io";
console.log("spritesheet" in params);
console.log(params["spritesheet"]);

(window as any)["global"] = global;
(window as any)["PIXI"] = PIXI;

new Promise(async (resolve, reject) => {
    const image_promise: Promise<HTMLImageElement> = new Promise((resolve, reject) => {
        const image = document.createElement("img");
        image.src = spritesheet_url_base + ".png";
        image.onload = () => { resolve(image); }
        image.onerror = err => reject(err);
    });
    const dat_promise: Promise<Object> = fetch(spritesheet_url_base + ".json").then(res => res.json());
    const image = await image_promise;
    const dat = await dat_promise;
    const texture = PIXI.Texture.from(image);
    global.spritesheet = new PIXI.Spritesheet(texture, dat);
    global.spritesheet.parse(resolve);
}).then(() => load_fonts()).then(async () => {
	if (!("localStorage" in window)) throw new Error("No localstorage");
	/*global.gui = gui_load([
		{ 
			kind: "fuel_gague",
			clamp: Clamp.Right,
			is_vertical: true,
			offset: 200,
		}
	], 1);*/
}).then(() => {
    global.main_hud = new MainHud();
    pixi.stage.addChild(global.main_hud.container);
    global.starguide_button = new StarguideButton();
    pixi.stage.addChild(global.starguide_button.container);
	global.beamout_button = new BeamOutButton();
	pixi.stage.addChild(global.beamout_button.container);
    global.starguide = new Starguide();
    global.chat = new Chat();
    pixi.stage.addChild(global.starguide.container);
    global.destination_hologram = new PIXI.TilingSprite(global.spritesheet.textures["destination_hologram.png"], 2, 2);
    global.destination_hologram.anchor.set(1,0.5);
    global.destination_hologram.height = 0.35;
    global.destination_hologram.tileScale.y = global.destination_hologram.height / global.destination_hologram.texture.height;
    global.destination_hologram.tileScale.x = global.destination_hologram.tileScale.y / 2.35;    
    global.destination_hologram.alpha = 0.5;
    global.destination_hologram.visible = false;
    global.holograms.addChild(global.destination_hologram);

    global.heading_hologram.texture = global.spritesheet.textures["heading_hologram.png"];
    global.heading_hologram.anchor.set(0.5);
    global.heading_hologram.alpha = 0.5;
    global.holograms.addChild(global.heading_hologram);

	//pixi.stage.addChild(global.gui.container);

    resize();
    window.addEventListener("resize", resize);

	const inflated_planets: Set<Planet> = new Set();

    //ws%3A%2F%2Flocalhost%3A8081 for localhost 8081
    if (typeof params["server"] !== "string") throw new Error("No server address provided");
    const socket = new WebSocket(params["server"] as string);
	global.socket = socket;
    socket.binaryType = "arraybuffer";
    socket.onopen = () => {
        socket.send(new Uint8Array(new ToServerMsg.Handshake("glap.rs-0.1.0", session, "name" in params ? params["name"] as string : "Unnamed").serialize()));
    };
    function handshake_ing(e: MessageEvent) {
        const message = ToClientMsg.deserialize(new Uint8Array(e.data), new Box(0));
        if (message instanceof ToClientMsg.HandshakeAccepted) { //Authentication completed
            console.log("Handshake Accepted");
            console.log(message);
            global.my_id = message.id;
			global.can_beamout = message.can_beamout;
            my_core_id = message.core_id;
            socket.removeEventListener("message", handshake_ing);
            socket.addEventListener("message", e => {
				const buf = new Uint8Array(e.data);
				const i = new Box(0);
				const msg = ToClientMsg.deserialize(buf, i);
				on_message(msg, buf, i);
			});
            window.addEventListener("keydown", key_down);
            window.addEventListener("keyup", key_up);			
            global.scaling.on("mousedown", world_mouse_down);
			global.scaling.on("rightdown", world_mouse_down);
            global.scaling.on("mousemove", world_mouse_move);
            global.scaling.on("mouseup", world_mouse_up);
			global.scaling.on("rightup", world_mouse_up);
			socket.send(new ToServerMsg.RequestUpdate().serialize());
        } 
		else if (message instanceof ToClientMsg.ChatMessage) {
            global.chat.ReceiveMessage(message.msg, message.username, message.color);
		}
		else {
			console.error("Unexpected message before handshake");
			console.error(message);
		}
    }
    socket.addEventListener("message", handshake_ing);
	socket.addEventListener("close", () => { alert("Disconnected"); });
    socket.onerror = err => { throw err; };
	(window as any).request_update = () => { socket.send((new ToServerMsg.RequestUpdate()).serialize()); };
	(window as any).redo_pid = (p: number, i: number, d: number) => { global.server_tick_pid = new PID(p, i, d); };

    //let prev_core_position = [0,0];
    const server_tick_times: number[] = [];
    global.server_tick_times = server_tick_times;
    let next_server_tick_i = 0;
    let previous_server_tick = performance.now();
	/*let expected_server_tick = performance.now();
	global.server_tick_pid = new PID(1.0, 0.00001, 0.0);
	global.server_tick_pid.setTarget(0);*/
    //const do_interpolation = "do_interpolation" in params ? params["do_interpolation"] === "true" : true;
	const updated_players: Set<PlayerMeta> = new Set();

    function on_message(msg: object, buf: Uint8Array, buf_i: Box<number>) {
		if (msg instanceof ToClientMsg.MessagePack) {
			for (let i = 0; i < msg.count; i++) {
				const msg = ToClientMsg.deserialize(buf, buf_i);
				on_message(msg, buf, buf_i);
			}
		} else if (msg instanceof ToClientMsg.AddCelestialObject) {
			const planet = instantiate_planet(msg);
            global.celestial_objects.set(msg.id, planet);
            global.starguide.add_celestial_object(planet);

			if (msg.kind === PlanetKind.Moon) {
                global.destination_hologram.visible = true;
                global.starguide.current_destination = planet;
                global.starguide.retarget_destination_hologram();
            }
        } else if (msg instanceof ToClientMsg.InitCelestialOrbit) {
			global.celestial_objects.get(msg.id).init_celestial_orbit(msg);
		} else if (msg instanceof ToClientMsg.UpdateCelestialOrbit) {
			global.celestial_objects.get(msg.id).update_celestial_orbit(msg);
		}

        else if (msg instanceof ToClientMsg.AddPart) {
            const meta = new PartMeta(msg.id, msg.kind);
            meta.sprite.on("mousedown", part_mouse_down.bind(null, meta, false));
			meta.sprite.on("rightdown", part_mouse_down.bind(null, meta, true));
            meta.sprite.interactive = true;
            global.parts.set(msg.id, meta);
            if (msg.id === my_core_id) global.my_core = meta;
        } else if (msg instanceof ToClientMsg.MovePart) {
            const part = global.parts.get(msg.id)
            part.x = msg.x; part.y = msg.y;
            const rotation = Math.atan2(-msg.rotation_i, -msg.rotation_n);
            part.rot = rotation;
        } else if (msg instanceof ToClientMsg.RemovePart) {
            const part = global.parts.get(msg.id);
            if (part != null) {
                global.parts.delete(msg.id);
                global.part_sprites.removeChild(part.sprite);
                global.connector_sprites.removeChild(part.connector_sprite);
            }
        } else if (msg instanceof ToClientMsg.UpdatePartMeta) {
            const meta = global.parts.get(msg.id);
            if (meta.owning_player != null) meta.owning_player.parts.delete(meta);
            if (msg.owning_player != null) {
                meta.owning_player = global.players.get(msg.owning_player);
                meta.owning_player.parts.add(meta);
                meta.update_thruster_sprites(meta.owning_player.thrust_forward, meta.owning_player.thrust_backward, meta.owning_player.thrust_clockwise, meta.owning_player.thrust_counter_clockwise);

		if (meta.kind === PartKind.Core) {
			meta.owning_player.core = meta;
		}
            } else {
                meta.owning_player = null;
                meta.update_thruster_sprites(false, false, false, false);
            }
            meta.thrust_mode.dat = msg.thrust_mode;
            meta.update_sprites();
        }

        else if (msg instanceof ToClientMsg.AddPlayer) {
			const player = new PlayerMeta(msg.id, msg.name, msg.core_id);
            global.players.set(msg.id, player);
			if (msg.id == global.my_id) global.my_player = player;
        }
        else if (msg instanceof ToClientMsg.UpdatePlayerMeta) {
            const meta = global.players.get(msg.id);
            meta.thrust_forward = msg.thrust_forward;
            meta.thrust_backward = msg.thrust_backward;
            meta.thrust_clockwise = msg.thrust_clockwise;
            meta.thrust_counter_clockwise = msg.thrust_counter_clockwise;
            meta.update_thruster_sprites();
            meta.grabbed_part = msg.grabed_part;
            if (meta.grabbed_part === null && meta.holographic_grab_sprite != null) {
                global.holograms.removeChild(meta.holographic_grab_sprite);
                meta.holographic_grab_sprite = null;
            }
        }
        else if (msg instanceof ToClientMsg.UpdateMyMeta) {
            max_fuel = msg.max_power;
			global.beamout_button.set_can_beamout(msg.can_beamout && global.can_beamout);
        }
		else if (msg instanceof ToClientMsg.UpdatePlayerVelocity) {
			const meta = global.players.get(msg.id);
			meta.velocity[0] = msg.vel_x;
			meta.velocity[1] = msg.vel_y;
			updated_players.add(meta);
		}
        else if (msg instanceof ToClientMsg.RemovePlayer) {
			const player = global.players.get(msg.id);
			if (player != null) {
				global.connector_sprites.removeChild(player.name_sprite);
				global.players.delete(msg.id);
			}
	    
        }
		else if (msg instanceof ToClientMsg.BeamOutAnimation || msg instanceof ToClientMsg.IncinerationAnimation) {
			const player = global.players.get(msg.player_id);
			if (player != null) {
				const opacity_aniamtion_constant = 0.001;
				const config_source = msg instanceof ToClientMsg.BeamOutAnimation ? BeamoutParticleConfig : IncinerationParticleConfig;
				for (const part of player.parts) {
					const my_config = Object.create(config_source);
					my_config.pos.x = part.sprite.x;
					my_config.pos.y = part.sprite.y;
					const particles = new Particles.Emitter(global.connector_sprites, global.white_box, my_config);
					global.parts.delete(part.id);
					global.connector_sprites.removeChild(part.connector_sprite);
					let onframe = (delta_ms: number) => {
						particles.update(delta_ms * 0.001);
						part.sprite.alpha -= opacity_aniamtion_constant * delta_ms;
						if (part.sprite.alpha <= 0) {
							global.part_sprites.removeChild(part.sprite);
						}
						if (particles.emit === false && particles.particleCount <= 0) {
							global.onframe.delete(onframe);
							if (part === player.core && player.id === global.my_id) {
								(window as any).location = "/";
							}
						}
					};
					global.onframe.add(onframe);
				}
				const name_onframe = (delta_ms: number) => {
					player.name_sprite.alpha -= opacity_aniamtion_constant * delta_ms;
					if (player.name_sprite.alpha <= 0) {
						global.connector_sprites.removeChild(player.name_sprite);
						global.onframe.delete(name_onframe);
					}
				};
				global.onframe.add(name_onframe);
			}
		} else if(msg instanceof ToClientMsg.ChatMessage) {
            global.chat.ReceiveMessage(msg.msg, msg.username, msg.color);
        }


		else if (msg instanceof ToClientMsg.OrbitAdvanceTick) {
			for (const planet of global.celestial_objects.values()) {
				if (planet.orbit != null) {
					let [_pos, next_pos] = planet.orbit.advance();
					planet.position.copyFrom(next_pos);
					//planet.position.copyFrom(planet.orbit.advance());
					global.starguide.planets.get(planet).position.copyFrom(planet.position);
				}
			}
		}
        else if (msg instanceof ToClientMsg.PostSimulationTick) {
            global.main_hud.set_fuel(msg.your_power, max_fuel);
			//if (global.gui.fuel_gague != null) global.gui.fuel_gague.update(msg.your_power, max_fuel);

            const now = performance.now();
            const delta_server_tick = now - previous_server_tick;
            previous_server_tick = now;
            server_tick_times[next_server_tick_i] = delta_server_tick;
            next_server_tick_i += 1;
            if (next_server_tick_i >= 40) next_server_tick_i = 0;
            let average_server_tick_time = 0;
            server_tick_times.forEach(val => average_server_tick_time += val);
            average_server_tick_time /= server_tick_times.length;

			/*const server_tick_error = expected_server_tick - now;
			const correction = global.server_tick_pid.update(server_tick_error);
			//if (num7573 < 0) console.log(num7573);
			console.log([now, expected_server_tick, server_tick_error, correction]);
            average_server_tick_time += correction;
			expected_server_tick = now + average_server_tick_time;*/
		    average_server_tick_time += 200;

			for (const player of global.players.values()) {
				const was_updated = updated_players.has(player);
				if (was_updated && !player.visible) {
					player.visible = true;
					player.name_sprite.visible = true;
					for (const part of player.parts.values()) {
						part.sprite.visible = true;
						part.connector_sprite.visible = true;
					}
				} else if (!was_updated && player.visible) {
					player.visible = false;
					player.name_sprite.visible = false;
					for (const part of player.parts.values()) {
						part.sprite.visible = false;
						part.connector_sprite.visible = false;
					}
				}
			}
		
            for (const part of global.parts.values()) {
				if (!part.sprite.visible) continue;
				set_next_interpolation(part, average_server_tick_time);			
				if (part.owning_player != null) {
					part.particle_speed_x = part.owning_player.velocity[0];
					part.particle_speed_y = part.owning_player.velocity[1];
				}
            }
			updated_players.clear();

			//console.log([global.my_core.particle_speed_x, global.my_core.particle_speed_y]);
			{
				const planetary_distance = [global.my_core.sprite.x - global.destination_hologram.x, global.my_core.sprite.y - global.destination_hologram.y];
				global.main_hud.position_text.text = `Pos: ${Math.round(planetary_distance[0])}, ${Math.round(planetary_distance[1])}`;
				global.main_hud.position_text.width = (global.main_hud.position_text.texture.width / global.main_hud.position_text.texture.height) * global.main_hud.position_text.height * 0.1;

				if (Math.abs(global.my_player.velocity[0]) > 0.01 || Math.abs(global.my_player.velocity[1]) > 0.01) global.heading_hologram.rotation = Math.atan2(-global.my_player.velocity[1], -global.my_player.velocity[0]) - PI_over_2;
				global.main_hud.velocity_text.text = `Vel: ${Math.round(Math.sqrt(Math.pow(global.my_player.velocity[0], 2) + Math.pow(global.my_player.velocity[1], 2)))}`;
				global.main_hud.velocity_text.width = (global.main_hud.velocity_text.texture.width / global.main_hud.velocity_text.texture.height) * global.main_hud.velocity_text.height * 0.1;
				//prev_core_position = [global.my_core.inter_x_dest, global.my_core.inter_y_dest];
			}

			for (const planet of global.celestial_objects.values()) {
				if (Math.abs(planet.position.x - global.my_core.x) <= planet.render_distance && Math.abs(planet.position.y - global.my_core.y) <= planet.render_distance && !inflated_planets.has(planet)) {
					planet.inter_x.now = planet.position.x;
					planet.inter_y.now = planet.position.y;
					planet.inflate_graphics();
					inflated_planets.add(planet);
				}
			}
			for (const planet of inflated_planets) {
				if (Math.abs(planet.position.x - global.my_core.x) > planet.render_distance || Math.abs(planet.position.y - global.my_core.y) > planet.render_distance) {
					inflated_planets.delete(planet);
					planet.deflate_graphics();
				} else {
					set_next_interpolation(planet, average_server_tick_time);
				}
			}

			socket.send((new ToServerMsg.RequestUpdate()).serialize());
        }
    }

    let last_time = performance.now();
    function render(now_time: DOMHighResTimeStamp) {
        const delta_ms = now_time - last_time;
        last_time = now_time;

		for (const planet of inflated_planets) advance_interpolation(planet, delta_ms);
		for (const part of global.parts.values()) advance_interpolation(part, delta_ms);

		if (global.my_core != null) {
			global.world.position.set(-global.my_core.sprite.position.x, -global.my_core.sprite.position.y);
			background.tilePosition.set(-global.my_core.sprite.position.x / 50, -global.my_core.sprite.position.y / 50);
			global.starguide.update_core_position(global.my_core.sprite.position.x, global.my_core.sprite.position.y, global.my_core.sprite.rotation);

			global.starguide.retarget_destination_hologram();
			const distance = [global.my_core.sprite.x - global.destination_hologram.x, global.my_core.sprite.y - global.destination_hologram.y];
			global.destination_hologram.width = Math.sqrt(Math.pow(distance[0], 2) + Math.pow(distance[1], 2));
			global.destination_hologram.rotation = Math.atan2(-distance[1], -distance[0]);
			global.destination_hologram.tilePosition.x = global.destination_hologram.width * 0.2;
			global.heading_hologram.position.copyFrom(global.my_core.sprite.position);
		}

		const delta_seconds = delta_ms * 0.001;
		for (const particle of global.emitters) {
			if (particle.update_particles(delta_seconds)) global.emitters.delete(particle);
		}

		for (const player of global.players.values()) player.update_grabbing_sprite();
		for (const f of global.onframe) f(delta_ms);
		pixi.render();
		requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

    const keys_down: Set<number> = new Set();
    const my_thrusters = new ToServerMsg.SetThrusters(false, false, false, false);
    function key_down(e: KeyboardEvent) {
        if (keys_down.has(e.keyCode)) return;
        keys_down.add(e.keyCode);
        let message_box = (document.querySelector("#message_box") as HTMLInputElement);
        if(message_box != document.activeElement) {
            switch (e.keyCode) {
                case 87: //w
                    my_thrusters.forward = true;
                    socket.send(my_thrusters.serialize());
                    break;
                case 83: //s
                    my_thrusters.backward = true;
                    socket.send(my_thrusters.serialize());
                    break;
                case 65: //a
                    my_thrusters.counter_clockwise = true;
                    socket.send(my_thrusters.serialize());
                    break;
                case 68: //d
                    my_thrusters.clockwise = true;
                    socket.send(my_thrusters.serialize());
                    break;
                case 77: //m
                    if (global.starguide.is_open) global.starguide.close(); else global.starguide.open();
                    break;
                case 84: //t
                    if(!global.chat.is_open) global.chat.Open(); else if(message_box != document.activeElement && global.chat.is_open) global.chat.Close();
            };
        }
        if(e.keyCode == 27) {
            if(global.starguide.is_open) global.starguide.close();
            if(global.chat.is_open) global.chat.Close(); message_box.blur();
        }
    }
    function key_up(e: KeyboardEvent) {
        if (keys_down.delete(e.keyCode)) {
            switch (e.keyCode) {
                case 87: //w
                    my_thrusters.forward = false;
                    socket.send(my_thrusters.serialize());
                    break;
                case 83: //s
                    my_thrusters.backward = false;
                    socket.send(my_thrusters.serialize());
                    break;
                case 65: //a
                    my_thrusters.counter_clockwise = false;
                    socket.send(my_thrusters.serialize());
                    break;
                case 68: //d
                    my_thrusters.clockwise = false;
                    socket.send(my_thrusters.serialize());
                    break;
            }
        }
    }

    pixi.view.addEventListener("wheel", event => {
		const deltaY = Math.abs(event.deltaY) > 50 ? event.deltaY / 50 : event.deltaY
        if (global.starguide.mouseover) global.starguide.on_wheel(event, deltaY);
        else {
            global.zoom -= deltaY * 0.01;
            if (global.zoom > 1) global.zoom = 1;
            else if (global.zoom < 0.5) global.zoom = 0.5;
            resize();
        }
    });

	(window as any)["resize"] = resize;

    let am_grabbing = false;
    function world_mouse_down(event: PIXI.InteractionEvent) {
        // const scaled = screen_to_player_space(event.data.global.x, event.data.global.y);
        // console.log(scaled);
        // socket.send(new ToServerMsg.CommitGrab(scaled[0], scaled[1]).serialize());
        // am_grabbing = true;
    }
    function part_mouse_down(part: PartMeta, is_right_click: boolean, event: PIXI.InteractionEvent) {
        if (!am_grabbing && (part.owning_player === null || is_right_click)) {
            am_grabbing = true;
            const scaled = global.screen_to_player_space(event.data.global.x, event.data.global.y);
            //console.log(scaled);
            socket.send(new ToServerMsg.CommitGrab(part.id, scaled[0], scaled[1]).serialize());
            am_grabbing = true;
        }
    }
    function world_mouse_move(event: PIXI.InteractionEvent) {
        if (am_grabbing) {
            const scaled = global.screen_to_player_space(event.data.global.x, event.data.global.y);
            socket.send(new ToServerMsg.MoveGrab(scaled[0], scaled[1]).serialize());
        }
    }
    function world_mouse_up(event: PIXI.InteractionEvent) {
        if (am_grabbing) {
            am_grabbing = false;
            socket.send(new ToServerMsg.ReleaseGrab().serialize());
        }
    }
});

const name_text_style = new PIXI.TextStyle({ fill: 0xffffff, align: "center", stroke: 0x000000, strokeThickness: 0.01});
export class PlayerMeta {
    id: number;
    core_id: number;
    name: string;
    name_sprite: PIXI.Text;
    constructor(id: number, name: string, core_id: number) {
        this.id = id;
        this.name = name;
        this.core_id = core_id;

		this.name_sprite = new PIXI.Text(this.name, name_text_style);
		this.name_sprite.updateText(true);
		console.log(this.name_sprite.texture.height);
		this.name_sprite.width = 0.8 / this.name_sprite.texture.height * this.name_sprite.texture.width;
		this.name_sprite.height = 0.8;
		this.name_sprite.anchor.set(0.5,1);
		global.connector_sprites.addChild(this.name_sprite);
    }
    core: PartMeta = null;
    thrust_forward = false;
    thrust_backward = false;
    thrust_clockwise = false;
	velocity: [number, number] = [0,0];
    thrust_counter_clockwise = false;
    parts = new Set<PartMeta>();
    grabbed_part: number = null;
    holographic_grab_sprite: PIXI.Sprite = null;
	visible = true;

    update_thruster_sprites() {
        for (const part of this.parts) {
            part.update_thruster_sprites(this.thrust_forward, this.thrust_backward, this.thrust_clockwise, this.thrust_counter_clockwise);
        }
    }
    update_grabbing_sprite() {
        if (this.grabbed_part != null) {
            if (this.holographic_grab_sprite === null) {
                this.holographic_grab_sprite = new PIXI.Sprite(global.holographic_grab);
                this.holographic_grab_sprite.height = 0.25;
                global.holograms.addChild(this.holographic_grab_sprite);
            }
            const player = global.parts.get(this.core_id);
            const grabbed_part = global.parts.get(this.grabbed_part);
            const delta_x = grabbed_part.sprite.position.x - player.sprite.position.x;
            const delta_y = grabbed_part.sprite.position.y - player.sprite.position.y;
            this.holographic_grab_sprite.position.set(player.sprite.position.x, player.sprite.position.y);
            this.holographic_grab_sprite.width = Math.sqrt(Math.pow(delta_x, 2) + Math.pow(delta_y, 2));
            this.holographic_grab_sprite.rotation = Math.atan2(delta_y, delta_x);
        }
    }
}

export class CelestialObjectMeta {
    id: number;
    display_name: string;
    sprite: PIXI.DisplayObject;
    radius: number;
    name: string;
    icon_mask: PIXI.Texture;
    constructor(id: number, name: string, display_name: string, sprite: PIXI.DisplayObject, radius: number) {
        this.id = id; this.display_name = display_name; this.sprite = sprite; this.name = name;
        this.radius = radius;
        this.icon_mask = create_planet_icon_mask(global.spritesheet.textures["symbol_" + this.name + ".png"])
    }
}
