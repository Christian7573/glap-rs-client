export class Box<T> {
    v: T;
    constructor(v: T) { this.v = v; }
}

function type_string_serialize(out: number[], string: string) {
    if (string.length > 255) { out.push(0); }
    else {
        out.push(string.length);
        for (let i = 0; i < string.length; i++) out.push(string.charCodeAt(i));
    }
}
function type_string_deserialize(buf: Uint8Array, index: Box<number>): string {
    let out = "";
    const size = buf[index.v];
    index.v++;
    let i = index.v;	
    index.v += size;
    while (i < index.v) out += String.fromCharCode(buf[i++]);
    return out; 
}

function type_float_serialize(out: number[], float: number) {
    const arr = new Float32Array([float]);
    const view = new Uint8Array(arr.buffer);
    out.push(view[3], view[2], view[1], view[0]);
}
function type_float_deserialize(buf: Uint8Array, index: Box<number>): number {
    const arr = new Uint8Array([buf[index.v+3], buf[index.v+2], buf[index.v+1], buf[index.v]]);
    const view = new Float32Array(arr.buffer);
    index.v += 4;
    return view[0];
}

function type_ushort_serialize(out: number[], ushort: number) {
    const arr = new Uint16Array([ushort]);
    const view = new Uint8Array(arr.buffer);
    out.push(view[1], view[0]);
}
function type_ushort_deserialize(buf: Uint8Array, index: Box<number>): number {
    const arr = new Uint8Array([buf[index.v+1], buf[index.v]]);
    const view = new Uint16Array(arr.buffer);
    index.v += 2;
    return view[0];
}

function type_uint_serialize(out: number[], uint: number) {
    const arr = new Uint32Array([uint]);
    const view = new Uint8Array(arr.buffer);
    out.push(view[3], view[2], view[1], view[0]);
}
function type_uint_deserialize(buf: Uint8Array, index: Box<number>): number {
    const arr = new Uint8Array([buf[index.v+3], buf[index.v+2], buf[index.v+1], buf[index.v]]);
    const view = new Uint32Array(arr.buffer);
	index.v += 4;
    return view[0];
}

function type_float_pair_serialize(out: number[], pair: [number, number]) {
    type_float_serialize(out, pair[0])
    type_float_serialize(out, pair[1]);
}
function type_float_pair_deserialize(buf: Uint8Array, index: Box<number>): [number, number] {
    return [type_float_deserialize(buf, index), type_float_deserialize(buf, index)];
}

function type_ubyte_serialize(out: number[], ubyte: number) { out.push(ubyte); }
function type_ubyte_deserialize(buf: Uint8Array, index: Box<number>): number { return buf[index.v++]; }

function type_boolean_serialize(out: number[], bool: boolean) { out.push(bool ? 1 : 0); }
function type_boolean_deserialize(buf: Uint8Array, index: Box<number>): boolean { return buf[index.v++] > 0; }


export enum PartKind {
	Core, Cargo, LandingThruster, Hub, SolarPanel, EcoThruster, Thruster, SuperThruster, PowerHub, HubThruster, LandingWheel
}
function enum_PartKind_serialize(buf: number[], val: PartKind) { buf.push(val as number); }function enum_PartKind_deserialize(buf: Uint8Array, index: Box<number>): PartKind {
	const me = buf[index.v++];
	if (me < 11) return me as PartKind;
	else throw new Error('Bad PartKind deserialize');
}
export enum PlanetKind {
	Earth, Venus, Mars, Moon, Sun, Mercury, Neptune, Uranus, Jupiter, Saturn, Pluto, Trade
}
function enum_PlanetKind_serialize(buf: number[], val: PlanetKind) { buf.push(val as number); }function enum_PlanetKind_deserialize(buf: Uint8Array, index: Box<number>): PlanetKind {
	const me = buf[index.v++];
	if (me < 12) return me as PlanetKind;
	else throw new Error('Bad PlanetKind deserialize');
}
export enum BeamoutKind {
	Beamout, Dock, None
}
function enum_BeamoutKind_serialize(buf: number[], val: BeamoutKind) { buf.push(val as number); }function enum_BeamoutKind_deserialize(buf: Uint8Array, index: Box<number>): BeamoutKind {
	const me = buf[index.v++];
	if (me < 3) return me as BeamoutKind;
	else throw new Error('Bad BeamoutKind deserialize');
}

class ToServerMsg_Handshake {
	static readonly id = 0;
	client: string; session: string|null; name: string;
	constructor(client: string, session: string|null, name: string,) {
		this.client = client; this.session = session; this.name = name;
	}
	serialize(): Uint8Array
		{let out = [0];
		type_string_serialize(out, this.client);
		if (this.session === null) out.push(0); else {out.push(1); type_string_serialize(out, this.session);};
		type_string_serialize(out, this.name);
		return new Uint8Array(out);
	}
}
class ToServerMsg_SetThrusters {
	static readonly id = 1;
	forward: boolean; backward: boolean; clockwise: boolean; counter_clockwise: boolean;
	constructor(forward: boolean, backward: boolean, clockwise: boolean, counter_clockwise: boolean,) {
		this.forward = forward; this.backward = backward; this.clockwise = clockwise; this.counter_clockwise = counter_clockwise;
	}
	serialize(): Uint8Array
		{let out = [1];
		type_boolean_serialize(out, this.forward);
		type_boolean_serialize(out, this.backward);
		type_boolean_serialize(out, this.clockwise);
		type_boolean_serialize(out, this.counter_clockwise);
		return new Uint8Array(out);
	}
}
class ToServerMsg_CommitGrab {
	static readonly id = 2;
	grabbed_id: number; x: number; y: number;
	constructor(grabbed_id: number, x: number, y: number,) {
		this.grabbed_id = grabbed_id; this.x = x; this.y = y;
	}
	serialize(): Uint8Array
		{let out = [2];
		type_ushort_serialize(out, this.grabbed_id);
		type_float_serialize(out, this.x);
		type_float_serialize(out, this.y);
		return new Uint8Array(out);
	}
}
class ToServerMsg_MoveGrab {
	static readonly id = 3;
	x: number; y: number;
	constructor(x: number, y: number,) {
		this.x = x; this.y = y;
	}
	serialize(): Uint8Array
		{let out = [3];
		type_float_serialize(out, this.x);
		type_float_serialize(out, this.y);
		return new Uint8Array(out);
	}
}
class ToServerMsg_ReleaseGrab {
	static readonly id = 4;
	
	constructor() {
		
	}
	serialize(): Uint8Array
		{let out = [4];
		return new Uint8Array(out);
	}
}
class ToServerMsg_BeamOut {
	static readonly id = 5;
	
	constructor() {
		
	}
	serialize(): Uint8Array
		{let out = [5];
		return new Uint8Array(out);
	}
}
class ToServerMsg_SendChatMessage {
	static readonly id = 6;
	msg: string;
	constructor(msg: string,) {
		this.msg = msg;
	}
	serialize(): Uint8Array
		{let out = [6];
		type_string_serialize(out, this.msg);
		return new Uint8Array(out);
	}
}
class ToServerMsg_RequestUpdate {
	static readonly id = 7;
	
	constructor() {
		
	}
	serialize(): Uint8Array
		{let out = [7];
		return new Uint8Array(out);
	}
}
function deserialize_ToServerMsg(buf: Uint8Array, index: Box<number>) {
	switch (buf[index.v++]) {
		case 0: {
			let client: string; let session: string|null; let name: string;
			client = type_string_deserialize(buf, index);
			if (buf[index.v++] > 0) {session = type_string_deserialize(buf, index);} else {session = null;}
			name = type_string_deserialize(buf, index);
			return new ToServerMsg_Handshake(client, session, name);
		}; break;		case 1: {
			let forward: boolean; let backward: boolean; let clockwise: boolean; let counter_clockwise: boolean;
			forward = type_boolean_deserialize(buf, index);
			backward = type_boolean_deserialize(buf, index);
			clockwise = type_boolean_deserialize(buf, index);
			counter_clockwise = type_boolean_deserialize(buf, index);
			return new ToServerMsg_SetThrusters(forward, backward, clockwise, counter_clockwise);
		}; break;		case 2: {
			let grabbed_id: number; let x: number; let y: number;
			grabbed_id = type_ushort_deserialize(buf, index);
			x = type_float_deserialize(buf, index);
			y = type_float_deserialize(buf, index);
			return new ToServerMsg_CommitGrab(grabbed_id, x, y);
		}; break;		case 3: {
			let x: number; let y: number;
			x = type_float_deserialize(buf, index);
			y = type_float_deserialize(buf, index);
			return new ToServerMsg_MoveGrab(x, y);
		}; break;		case 4: {
			
			return new ToServerMsg_ReleaseGrab();
		}; break;		case 5: {
			
			return new ToServerMsg_BeamOut();
		}; break;		case 6: {
			let msg: string;
			msg = type_string_deserialize(buf, index);
			return new ToServerMsg_SendChatMessage(msg);
		}; break;		case 7: {
			
			return new ToServerMsg_RequestUpdate();
		}; break;		default: throw new Error();
	}
}
export const ToServerMsg = {
	deserialize: deserialize_ToServerMsg,
	Handshake: ToServerMsg_Handshake, SetThrusters: ToServerMsg_SetThrusters, CommitGrab: ToServerMsg_CommitGrab, MoveGrab: ToServerMsg_MoveGrab, ReleaseGrab: ToServerMsg_ReleaseGrab, BeamOut: ToServerMsg_BeamOut, SendChatMessage: ToServerMsg_SendChatMessage, RequestUpdate: ToServerMsg_RequestUpdate
};

class ToClientMsg_MessagePack {
	static readonly id = 0;
	count: number;
	constructor(count: number,) {
		this.count = count;
	}
	serialize(): Uint8Array
		{let out = [0];
		type_ushort_serialize(out, this.count);
		return new Uint8Array(out);
	}
}
class ToClientMsg_HandshakeAccepted {
	static readonly id = 1;
	id: number; core_id: number; can_beamout: boolean;
	constructor(id: number, core_id: number, can_beamout: boolean,) {
		this.id = id; this.core_id = core_id; this.can_beamout = can_beamout;
	}
	serialize(): Uint8Array
		{let out = [1];
		type_ushort_serialize(out, this.id);
		type_ushort_serialize(out, this.core_id);
		type_boolean_serialize(out, this.can_beamout);
		return new Uint8Array(out);
	}
}
class ToClientMsg_AddCelestialObject {
	static readonly id = 2;
	id: number; kind: PlanetKind; radius: number; position: [number, number];
	constructor(id: number, kind: PlanetKind, radius: number, position: [number, number],) {
		this.id = id; this.kind = kind; this.radius = radius; this.position = position;
	}
	serialize(): Uint8Array
		{let out = [2];
		type_ubyte_serialize(out, this.id);
		enum_PlanetKind_serialize(out, this.kind);
		type_float_serialize(out, this.radius);
		type_float_pair_serialize(out, this.position);
		return new Uint8Array(out);
	}
}
class ToClientMsg_InitCelestialOrbit {
	static readonly id = 3;
	id: number; orbit_around_body: number; orbit_radius: [number, number]; orbit_rotation: number; orbit_total_ticks: number;
	constructor(id: number, orbit_around_body: number, orbit_radius: [number, number], orbit_rotation: number, orbit_total_ticks: number,) {
		this.id = id; this.orbit_around_body = orbit_around_body; this.orbit_radius = orbit_radius; this.orbit_rotation = orbit_rotation; this.orbit_total_ticks = orbit_total_ticks;
	}
	serialize(): Uint8Array
		{let out = [3];
		type_ubyte_serialize(out, this.id);
		type_ubyte_serialize(out, this.orbit_around_body);
		type_float_pair_serialize(out, this.orbit_radius);
		type_float_serialize(out, this.orbit_rotation);
		type_uint_serialize(out, this.orbit_total_ticks);
		return new Uint8Array(out);
	}
}
class ToClientMsg_UpdateCelestialOrbit {
	static readonly id = 4;
	id: number; orbit_ticks_ellapsed: number;
	constructor(id: number, orbit_ticks_ellapsed: number,) {
		this.id = id; this.orbit_ticks_ellapsed = orbit_ticks_ellapsed;
	}
	serialize(): Uint8Array
		{let out = [4];
		type_ubyte_serialize(out, this.id);
		type_uint_serialize(out, this.orbit_ticks_ellapsed);
		return new Uint8Array(out);
	}
}
class ToClientMsg_AddPart {
	static readonly id = 5;
	id: number; kind: PartKind;
	constructor(id: number, kind: PartKind,) {
		this.id = id; this.kind = kind;
	}
	serialize(): Uint8Array
		{let out = [5];
		type_ushort_serialize(out, this.id);
		enum_PartKind_serialize(out, this.kind);
		return new Uint8Array(out);
	}
}
class ToClientMsg_MovePart {
	static readonly id = 6;
	id: number; x: number; y: number; rotation_n: number; rotation_i: number;
	constructor(id: number, x: number, y: number, rotation_n: number, rotation_i: number,) {
		this.id = id; this.x = x; this.y = y; this.rotation_n = rotation_n; this.rotation_i = rotation_i;
	}
	serialize(): Uint8Array
		{let out = [6];
		type_ushort_serialize(out, this.id);
		type_float_serialize(out, this.x);
		type_float_serialize(out, this.y);
		type_float_serialize(out, this.rotation_n);
		type_float_serialize(out, this.rotation_i);
		return new Uint8Array(out);
	}
}
class ToClientMsg_UpdatePartMeta {
	static readonly id = 7;
	id: number; owning_player: number|null; thrust_mode: number;
	constructor(id: number, owning_player: number|null, thrust_mode: number,) {
		this.id = id; this.owning_player = owning_player; this.thrust_mode = thrust_mode;
	}
	serialize(): Uint8Array
		{let out = [7];
		type_ushort_serialize(out, this.id);
		if (this.owning_player === null) out.push(0); else {out.push(1); type_ushort_serialize(out, this.owning_player);};
		type_ubyte_serialize(out, this.thrust_mode);
		return new Uint8Array(out);
	}
}
class ToClientMsg_RemovePart {
	static readonly id = 8;
	id: number;
	constructor(id: number,) {
		this.id = id;
	}
	serialize(): Uint8Array
		{let out = [8];
		type_ushort_serialize(out, this.id);
		return new Uint8Array(out);
	}
}
class ToClientMsg_AddPlayer {
	static readonly id = 9;
	id: number; core_id: number; name: string;
	constructor(id: number, core_id: number, name: string,) {
		this.id = id; this.core_id = core_id; this.name = name;
	}
	serialize(): Uint8Array
		{let out = [9];
		type_ushort_serialize(out, this.id);
		type_ushort_serialize(out, this.core_id);
		type_string_serialize(out, this.name);
		return new Uint8Array(out);
	}
}
class ToClientMsg_UpdatePlayerMeta {
	static readonly id = 10;
	id: number; thrust_forward: boolean; thrust_backward: boolean; thrust_clockwise: boolean; thrust_counter_clockwise: boolean; grabed_part: number|null;
	constructor(id: number, thrust_forward: boolean, thrust_backward: boolean, thrust_clockwise: boolean, thrust_counter_clockwise: boolean, grabed_part: number|null,) {
		this.id = id; this.thrust_forward = thrust_forward; this.thrust_backward = thrust_backward; this.thrust_clockwise = thrust_clockwise; this.thrust_counter_clockwise = thrust_counter_clockwise; this.grabed_part = grabed_part;
	}
	serialize(): Uint8Array
		{let out = [10];
		type_ushort_serialize(out, this.id);
		type_boolean_serialize(out, this.thrust_forward);
		type_boolean_serialize(out, this.thrust_backward);
		type_boolean_serialize(out, this.thrust_clockwise);
		type_boolean_serialize(out, this.thrust_counter_clockwise);
		if (this.grabed_part === null) out.push(0); else {out.push(1); type_ushort_serialize(out, this.grabed_part);};
		return new Uint8Array(out);
	}
}
class ToClientMsg_UpdatePlayerVelocity {
	static readonly id = 11;
	id: number; vel_x: number; vel_y: number;
	constructor(id: number, vel_x: number, vel_y: number,) {
		this.id = id; this.vel_x = vel_x; this.vel_y = vel_y;
	}
	serialize(): Uint8Array
		{let out = [11];
		type_ushort_serialize(out, this.id);
		type_float_serialize(out, this.vel_x);
		type_float_serialize(out, this.vel_y);
		return new Uint8Array(out);
	}
}
class ToClientMsg_RemovePlayer {
	static readonly id = 12;
	id: number;
	constructor(id: number,) {
		this.id = id;
	}
	serialize(): Uint8Array
		{let out = [12];
		type_ushort_serialize(out, this.id);
		return new Uint8Array(out);
	}
}
class ToClientMsg_OrbitAdvanceTick {
	static readonly id = 13;
	
	constructor() {
		
	}
	serialize(): Uint8Array
		{let out = [13];
		return new Uint8Array(out);
	}
}
class ToClientMsg_PostSimulationTick {
	static readonly id = 14;
	your_power: number;
	constructor(your_power: number,) {
		this.your_power = your_power;
	}
	serialize(): Uint8Array
		{let out = [14];
		type_uint_serialize(out, this.your_power);
		return new Uint8Array(out);
	}
}
class ToClientMsg_UpdateMyMeta {
	static readonly id = 15;
	max_power: number; beamout: BeamoutKind;
	constructor(max_power: number, beamout: BeamoutKind,) {
		this.max_power = max_power; this.beamout = beamout;
	}
	serialize(): Uint8Array
		{let out = [15];
		type_uint_serialize(out, this.max_power);
		enum_BeamoutKind_serialize(out, this.beamout);
		return new Uint8Array(out);
	}
}
class ToClientMsg_BeamOutAnimation {
	static readonly id = 16;
	player_id: number;
	constructor(player_id: number,) {
		this.player_id = player_id;
	}
	serialize(): Uint8Array
		{let out = [16];
		type_ushort_serialize(out, this.player_id);
		return new Uint8Array(out);
	}
}
class ToClientMsg_IncinerationAnimation {
	static readonly id = 17;
	player_id: number;
	constructor(player_id: number,) {
		this.player_id = player_id;
	}
	serialize(): Uint8Array
		{let out = [17];
		type_ushort_serialize(out, this.player_id);
		return new Uint8Array(out);
	}
}
class ToClientMsg_ChatMessage {
	static readonly id = 18;
	username: string; msg: string; color: string;
	constructor(username: string, msg: string, color: string,) {
		this.username = username; this.msg = msg; this.color = color;
	}
	serialize(): Uint8Array
		{let out = [18];
		type_string_serialize(out, this.username);
		type_string_serialize(out, this.msg);
		type_string_serialize(out, this.color);
		return new Uint8Array(out);
	}
}
function deserialize_ToClientMsg(buf: Uint8Array, index: Box<number>) {
	switch (buf[index.v++]) {
		case 0: {
			let count: number;
			count = type_ushort_deserialize(buf, index);
			return new ToClientMsg_MessagePack(count);
		}; break;		case 1: {
			let id: number; let core_id: number; let can_beamout: boolean;
			id = type_ushort_deserialize(buf, index);
			core_id = type_ushort_deserialize(buf, index);
			can_beamout = type_boolean_deserialize(buf, index);
			return new ToClientMsg_HandshakeAccepted(id, core_id, can_beamout);
		}; break;		case 2: {
			let id: number; let kind: PlanetKind; let radius: number; let position: [number, number];
			id = type_ubyte_deserialize(buf, index);
			kind = enum_PlanetKind_deserialize(buf, index);
			radius = type_float_deserialize(buf, index);
			position = type_float_pair_deserialize(buf, index);
			return new ToClientMsg_AddCelestialObject(id, kind, radius, position);
		}; break;		case 3: {
			let id: number; let orbit_around_body: number; let orbit_radius: [number, number]; let orbit_rotation: number; let orbit_total_ticks: number;
			id = type_ubyte_deserialize(buf, index);
			orbit_around_body = type_ubyte_deserialize(buf, index);
			orbit_radius = type_float_pair_deserialize(buf, index);
			orbit_rotation = type_float_deserialize(buf, index);
			orbit_total_ticks = type_uint_deserialize(buf, index);
			return new ToClientMsg_InitCelestialOrbit(id, orbit_around_body, orbit_radius, orbit_rotation, orbit_total_ticks);
		}; break;		case 4: {
			let id: number; let orbit_ticks_ellapsed: number;
			id = type_ubyte_deserialize(buf, index);
			orbit_ticks_ellapsed = type_uint_deserialize(buf, index);
			return new ToClientMsg_UpdateCelestialOrbit(id, orbit_ticks_ellapsed);
		}; break;		case 5: {
			let id: number; let kind: PartKind;
			id = type_ushort_deserialize(buf, index);
			kind = enum_PartKind_deserialize(buf, index);
			return new ToClientMsg_AddPart(id, kind);
		}; break;		case 6: {
			let id: number; let x: number; let y: number; let rotation_n: number; let rotation_i: number;
			id = type_ushort_deserialize(buf, index);
			x = type_float_deserialize(buf, index);
			y = type_float_deserialize(buf, index);
			rotation_n = type_float_deserialize(buf, index);
			rotation_i = type_float_deserialize(buf, index);
			return new ToClientMsg_MovePart(id, x, y, rotation_n, rotation_i);
		}; break;		case 7: {
			let id: number; let owning_player: number|null; let thrust_mode: number;
			id = type_ushort_deserialize(buf, index);
			if (buf[index.v++] > 0) {owning_player = type_ushort_deserialize(buf, index);} else {owning_player = null;}
			thrust_mode = type_ubyte_deserialize(buf, index);
			return new ToClientMsg_UpdatePartMeta(id, owning_player, thrust_mode);
		}; break;		case 8: {
			let id: number;
			id = type_ushort_deserialize(buf, index);
			return new ToClientMsg_RemovePart(id);
		}; break;		case 9: {
			let id: number; let core_id: number; let name: string;
			id = type_ushort_deserialize(buf, index);
			core_id = type_ushort_deserialize(buf, index);
			name = type_string_deserialize(buf, index);
			return new ToClientMsg_AddPlayer(id, core_id, name);
		}; break;		case 10: {
			let id: number; let thrust_forward: boolean; let thrust_backward: boolean; let thrust_clockwise: boolean; let thrust_counter_clockwise: boolean; let grabed_part: number|null;
			id = type_ushort_deserialize(buf, index);
			thrust_forward = type_boolean_deserialize(buf, index);
			thrust_backward = type_boolean_deserialize(buf, index);
			thrust_clockwise = type_boolean_deserialize(buf, index);
			thrust_counter_clockwise = type_boolean_deserialize(buf, index);
			if (buf[index.v++] > 0) {grabed_part = type_ushort_deserialize(buf, index);} else {grabed_part = null;}
			return new ToClientMsg_UpdatePlayerMeta(id, thrust_forward, thrust_backward, thrust_clockwise, thrust_counter_clockwise, grabed_part);
		}; break;		case 11: {
			let id: number; let vel_x: number; let vel_y: number;
			id = type_ushort_deserialize(buf, index);
			vel_x = type_float_deserialize(buf, index);
			vel_y = type_float_deserialize(buf, index);
			return new ToClientMsg_UpdatePlayerVelocity(id, vel_x, vel_y);
		}; break;		case 12: {
			let id: number;
			id = type_ushort_deserialize(buf, index);
			return new ToClientMsg_RemovePlayer(id);
		}; break;		case 13: {
			
			return new ToClientMsg_OrbitAdvanceTick();
		}; break;		case 14: {
			let your_power: number;
			your_power = type_uint_deserialize(buf, index);
			return new ToClientMsg_PostSimulationTick(your_power);
		}; break;		case 15: {
			let max_power: number; let beamout: BeamoutKind;
			max_power = type_uint_deserialize(buf, index);
			beamout = enum_BeamoutKind_deserialize(buf, index);
			return new ToClientMsg_UpdateMyMeta(max_power, beamout);
		}; break;		case 16: {
			let player_id: number;
			player_id = type_ushort_deserialize(buf, index);
			return new ToClientMsg_BeamOutAnimation(player_id);
		}; break;		case 17: {
			let player_id: number;
			player_id = type_ushort_deserialize(buf, index);
			return new ToClientMsg_IncinerationAnimation(player_id);
		}; break;		case 18: {
			let username: string; let msg: string; let color: string;
			username = type_string_deserialize(buf, index);
			msg = type_string_deserialize(buf, index);
			color = type_string_deserialize(buf, index);
			return new ToClientMsg_ChatMessage(username, msg, color);
		}; break;		default: throw new Error();
	}
}
export const ToClientMsg = {
	deserialize: deserialize_ToClientMsg,
	MessagePack: ToClientMsg_MessagePack, HandshakeAccepted: ToClientMsg_HandshakeAccepted, AddCelestialObject: ToClientMsg_AddCelestialObject, InitCelestialOrbit: ToClientMsg_InitCelestialOrbit, UpdateCelestialOrbit: ToClientMsg_UpdateCelestialOrbit, AddPart: ToClientMsg_AddPart, MovePart: ToClientMsg_MovePart, UpdatePartMeta: ToClientMsg_UpdatePartMeta, RemovePart: ToClientMsg_RemovePart, AddPlayer: ToClientMsg_AddPlayer, UpdatePlayerMeta: ToClientMsg_UpdatePlayerMeta, UpdatePlayerVelocity: ToClientMsg_UpdatePlayerVelocity, RemovePlayer: ToClientMsg_RemovePlayer, OrbitAdvanceTick: ToClientMsg_OrbitAdvanceTick, PostSimulationTick: ToClientMsg_PostSimulationTick, UpdateMyMeta: ToClientMsg_UpdateMyMeta, BeamOutAnimation: ToClientMsg_BeamOutAnimation, IncinerationAnimation: ToClientMsg_IncinerationAnimation, ChatMessage: ToClientMsg_ChatMessage
};

