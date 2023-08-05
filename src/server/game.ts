import { randomBytes } from 'crypto';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import type Connection from './connection.js';

const random = promisify(randomBytes);

export default class Game extends EventEmitter {
    players : Connection[] = [];
    isStarted = false;
    creator: Connection;
    code: string | undefined = undefined;

    constructor(creator : Connection) {
        super();
        this.creator = creator;
        this.players.push(creator);

        this.generateCode();
    }

    /** adds a player to this game */
    join(player : Connection) {
        if (this.players.length >= 6) {
            return 'full';
        }
        if (this.isStarted) {
            return 'already started';
        }
        this.players.push(player);
        return undefined;
    }

    static find(code : string) {
        return this.instances.get(code);
    }

    async generateCode() {
        this.code = (await random(6)).toString('base64url');
        this.emit('code', this.code);
        Game.instances.set(this.code, this);
    }

    static instances : Map<string, Game> = new Map();
}