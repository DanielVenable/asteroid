import { randomBytes } from 'crypto';
import { promisify } from 'util';

import { Board, Color } from './board.js';

import type Connection from './connection.js';

export default class Game {
    players : Connection[] = [];
    isStarted = false;
    creator: Connection;
    code?: string;

    board? : Board;
    robots? : Robot[];
    programs? : Program[];
    changes : Map<Connection, Change> = new Map;

    constructor(creator : Connection) {
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

    /** starts the game */
    start() {
        this.isStarted = true;
        this.board = new Board();
        this.robots = Robot.make6();
        this.programs = Program.make3();

        this.emit('board', this.board.toSVG());
        this.emit('robots', this.robots);
        this.emit('programs', this.programs);

        
    }

    /** accept an action from a player */
    action(player : Connection, data : any) {
        if (this.isStarted) {
            if (data instanceof Array &&
                    [Color.RED, Color.GREEN, Color.BLUE].includes(data[0]) &&
                    [Color.RED, Color.GREEN, Color.BLUE, true, false].includes(data[1])) {
                this.changes.set(player, data as Change);
            } else {
                this.changes.delete(player);
            }

            if (this.changes.size === this.players.length) {
                // all changes are in
                this.doRound();
            }
        }
    }

    /** update the program and do the moves of the robots */
    doRound() {
        if (!this.isStarted) {
            throw new Error('Cannot do round before game is started');
        }

        // update the program
        for (const program of this.programs!) {
            program.modify(this.changes.values());
        }

        // do the moves of the robots
        for (const robot of this.robots!) {
            robot.move(this.board!, this.programs!, this.robots!);
        }

        // send information to the players
        const changes = this.players.map(player => this.changes.get(player));
        this.emit('round', { robots: this.robots, changes });

        this.changes.clear();
    }

    async generateCode() {
        this.code = (await promisify(randomBytes)(6)).toString('base64url');
        this.emit('code', this.code);
        Game.instances.set(this.code, this);
    }

    /** sends information to all players */
    emit(type : string, data : any) {
        for (const player of this.players) {
            player.sendData(type, data);
        }
    }

    static find(code : string) {
        return this.instances.get(code);
    }

    static instances : Map<string, Game> = new Map();
}

/** directions a robot could face. robots 1-6 start facing in these directions (in order) */
enum Direction {
    DOWN_RIGHT, UP_RIGHT, UP,
    UP_LEFT, DOWN_LEFT, DOWN
}

/** a robot that goes on the board */
class Robot {
    constructor(public x : number, public y : number, public facing : Direction) {}

    /** moves the robot */
    move(board : Board, programs : Program[], robots : Robot[]) {
        const program = programs[board.get(this.x, this.y)];

        const positionAfterStep = (isRight : boolean) : [number, number] => {
            const [x, y] = (isRight ? [
                [0, 1], [1, 0], [1, 0], [0, -1], [-1, 0], [-1, 0]
            ] : [
                [1, 0], [0, -1], [-1, 0], [-1, 0], [0, 1], [1, 0]
            ])[this.facing];

            return [x + this.x, y + this.y];
        }

        const pos = positionAfterStep(program.isRight);
        const doOpposite = (board.get(...pos) ?? board.get(this.x, this.y)) === program.exception;
        const direction = doOpposite !== program.isRight;
        const newPos = positionAfterStep(direction);

        if (board.get(...newPos) === undefined ||
                robots.some(robot => robot.x === newPos[0] && robot.y === newPos[1])) {
            // if the robot would go off the board or there is already a robot there,
            // it stays where it is and rotates 120 degrees
            this.facing = (this.facing + (direction ? -2 : 2)) % 6;
        } else {
            // otherwise, it moves and rotates 60 degrees
            [this.x, this.y] = newPos;
            this.facing = (this.facing + (direction ? -1 : 1)) % 6;
        }
    }

    static make6() {
        return Board.triangles.map(([x, y], index : Direction) => new Robot(x, y, index));
    }
}

type Change = [Color, Color | boolean];

/** one of the 3 tiles that determines how a robot moves */
class Program {
    isRight = true;
    exception : Color;

    constructor(public readonly color : Color) {
        this.exception = color;
    }

    /** Makes the appropriate changes. If there are confilicting changes, nothing happens. */
    modify(changes : Iterable<Change>) {
        const dirChange = new Set<boolean>();
        const colorChange = new Set<Color>();

        for (const [color, change] of changes) {
            if (color === this.color) {
                if (typeof change === 'boolean') {
                    dirChange.add(change);
                } else {
                    colorChange.add(change);
                }
            }
        }

        // the value only changes if there is one unique change
        if (dirChange.size === 1) {
            this.isRight = [...dirChange][0];
        }
        if (colorChange.size === 1) {
            this.exception = [...colorChange][0];
        }
    }

    static make3() {
        return [new Program(Color.RED), new Program(Color.GREEN), new Program(Color.BLUE)];
    }
}