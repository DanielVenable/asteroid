import { randomBytes } from 'crypto';

import { Board, Color } from './board.js';

import type Connection from './connection.js';

export default class Game {
    players : Set<Connection> = new Set;
    isStarted = false;
    isDone = false;
    code?: string;
    playerNum = 0;

    board? : Board;
    robots? : Robot[];
    programs? : Program[];
    changes : Map<Connection, Change> = new Map;
    goals? : Map<Number, Number[]>;

    constructor(creator : Connection) {
        this.newPlayer(creator);
        this.generateCode();
    }

    /** adds a player to this game */
    join(player : Connection) {
        if (this.players.size >= 6) {
            return 'full';
        }
        if (this.isStarted) {
            return 'already started';
        }
        
        for (const other of this.players) {
            player.sendData('name', {index: other.number, name: other.name});
        }
        this.newPlayer(player);

        return undefined;
    }

    newPlayer(player : Connection) {
        player.number = this.playerNum++;
        player.name = `Player ${this.playerNum}`;
        const obj = { index: player.number, name: player.name };
        this.emit('name', obj);
        player.sendData('you are', obj);
        this.players.add(player);
    }

    /** tells everyone else one player's new name */
    nameChange(player : Connection) {
        this.tellOthers(player, 'name', {index: player.number, name: player.name});
    }

    /** remove a player from the game */
    remove(player : Connection) {
        const iterator = this.players[Symbol.iterator]();
        if (player === iterator.next().value) {
            iterator.next().value?.sendData('host');
        }
        this.players.delete(player);
        this.goals?.delete(player.number!);
        this.emit('remove', player.number);
    }

    /** starts the game */
    start() {
        this.isStarted = true;
        this.board = new Board();
        this.robots = Robot.make6();
        this.programs = Program.make3();

        this.goals = new Map;
        const goals = Game.goals[this.players.size - 1][Symbol.iterator]();
        for (const { number } of this.players) {
            this.goals.set(number!, goals.next().value);
        }

        this.emit('board', this.board.toSVG());
        this.emit('robots', this.robots);
        this.emit('programs', this.programs);
        this.emit('goals', [...this.goals]);
    }

    /** swich back to waiting for players mode */
    restart(player : Connection) {
        this.isDone = false;
        this.isStarted = false;
        this.tellOthers(player, 'restart', undefined);
    }

    /** accept an action from a player */
    action(player : Connection, data : any) {
        if (this.isStarted && !this.isDone) {
            if (data instanceof Array &&
                    [Color.RED, Color.GREEN, Color.BLUE].includes(data[0]) &&
                    [Color.RED, Color.GREEN, Color.BLUE, true, false].includes(data[1])) {
                this.changes.set(player, data as Change);
            } else {
                this.changes.delete(player);
            }

            if (this.changes.size === this.players.size) {
                // all changes are in
                this.doRound();
            } else {
                this.tellOthers(player, 'ready', player.number);
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
        let winners = [];

        for (const robot of this.robots!) {
            const winner = robot.move(this);
            if (winner) {
                winners.push(winner);
            }
        }

        // if there are multiple winners in the same round,
        // only those who won in the first step win
        if (winners.length) {
            const step = winners[0][1];
            for (let i = 1; i < winners.length; i++) {
                if (winners[i][1] !== step) {
                    winners = winners.filter(([, step]) => step === 0);
                    break;
                }
            }
            this.emit('winners', winners.map(([a]) => a));
            this.isDone = true;
        }

        // send information to the players
        this.emit('changes', [...this.players].map(player =>
            [player.number, this.changes.get(player)]));
        this.emit('robots', this.robots);
        this.emit('programs', this.programs);

        this.changes.clear();
    }

    generateCode() {
        this.code = randomBytes(6).toString('base64url');
        Game.instances.set(this.code, this);
        this.emit('code', this.code);
    }

    /** sends information to all players */
    emit(type : string, data : any) {
        for (const player of this.players) {
            player.sendData(type, data);
        }
    }

    tellOthers(player : Connection, type : string, data : any) {
        for (const other of this.players) {
            if (other !== player) {
                other.sendData(type, data);
            }
        }
    }

    static find(code : string) {
        return this.instances.get(code);
    }

    static instances : Map<string, Game> = new Map();

    static goals = [
        [[-1,3]],
        [[-1,3], [-1,-4]],
        [[-1,3], [-6,-2], [4,-2]],
        [[-1,3], [-6, 1], [-1,-4], [4,-2]],
        [[-1,3], [-6, 1], [-6,-2], [-1,-4], [4,-2]],
        [[-1,3], [-6, 1], [-6,-2], [-1,-4], [4,-2], [4,1]]
    ];
}

/** directions a robot could face. robots 1-6 start facing in these directions (in order) */
enum Direction {
    DOWN_RIGHT, UP_RIGHT, UP,
    UP_LEFT, DOWN_LEFT, DOWN
}

/** a robot that goes on the board */
class Robot {
    intermediatePos? : { x : number, y : number, facing : Direction };

    constructor(public x : number, public y : number, public facing : Direction) {}

    /** moves the robot 2 steps */
    move(game : Game) {
        const win1 = this.moveOnce(game);
        this.intermediatePos = { x: this.x, y: this.y, facing: this.facing };
        if (win1 !== undefined) {
            return [win1, 0];
        }
        const win2 = this.moveOnce(game);
        if (win2 !== undefined) {
            return [win2, 1];
        }
        return undefined;
    }

    /** moves the robot 1 step */
    moveOnce({ board, programs, robots, goals } : Game) {
        const program = programs![board!.get(this.x, this.y)];

        const positionAfterStep = (isRight : boolean) : [number, number] => {
            const [x, y] = (isRight ? [
                [0, 1], [1, 0], [1, 0], [0, -1], [-1, 0], [-1, 0]
            ] : [
                [1, 0], [0, -1], [-1, 0], [-1, 0], [0, 1], [1, 0]
            ])[this.facing];

            return [x + this.x, y + this.y];
        }

        const pos = positionAfterStep(program.isRight);
        const doOpposite = (board!.get(...pos) ?? board!.get(this.x, this.y)) === program.exception;
        const direction = doOpposite !== program.isRight;
        const newPos = positionAfterStep(direction);

        if (board!.get(...newPos) === undefined ||
                robots!.some(robot => robot.x === newPos[0] && robot.y === newPos[1])) {
            // if the robot would go off the board or there is already a robot there,
            // it stays where it is and rotates 120 degrees
            this.rotate(direction ? -2 : 2);
        } else {
            // otherwise, it moves and rotates 60 degrees
            [this.x, this.y] = newPos;
           this.rotate(direction ? -1 : 1);
        }

        for (const [i, [x, y]] of goals!) {
            if (x === this.x && y === this.y) {
                return i;
            }
        }

        return undefined;
    }

    rotate(amount : -2 | -1 | 1 | 2) {
        // I need to add 6 before doing % here because % does not work properly on negative numbers
        this.facing = (this.facing + amount + 6) % 6;
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