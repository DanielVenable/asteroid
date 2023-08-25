import { Board } from '../out/server/board.js';
import Game from '../out/server/game.js';

function fakePlayer() {
    return jasmine.createSpyObj('Connection', ['sendData']);
}

describe('game before starting', () => {
    let /** @type {{'sendData': jasmine.Spy}} */ player,
        /** @type {Game} */ game;

    beforeEach(() => {
        player = fakePlayer();
        game = new Game(player);
    });

    it('join the game up to 6 players', () => {
        for (let i = 2; i <= 6; i++) {
            expect(game.join(fakePlayer())).toBe(undefined);
        }
        expect(game.join(fakePlayer())).toBe('full');
    });

    it('start the game', () => {
        expect(player.sendData).not.toHaveBeenCalledWith('board', jasmine.anything());
        game.start();
        expect(player.sendData).toHaveBeenCalledWith('board', jasmine.anything());
        expect(game.join(fakePlayer())).toBe('already started');
    });

    it('send code', done => {
        player.sendData.and.callFake((type, code) => {
            expect(type).toBe('code');
            expect(code).toBeInstanceOf(String);
            expect(Game.find(code)).toBe(game);
            expect(Game.find('')).toBe(undefined);
            done();
        });
    });
});

describe('game while playing', () => {
    let /** @type {{ 'sendData': jasmine.Spy }} */ player1,
        /** @type { Object } */ player2,
        /** @type { Game } */ game;

    beforeEach(() => {
        player1 = jasmine.createSpyObj('Connection', ['sendData']);
        player2 = jasmine.createSpyObj('Connection', ['sendData']);
        game = new Game(player1);
        game.join(player2);
        game.start();
    });

    it('accept actions', () => {
        const doRound = spyOn(Game.prototype, 'doRound');
        game.action(player1, [0, 1]);
        expect(doRound).not.toHaveBeenCalled();
        game.action(player2, [1, true]);
        expect(doRound).toHaveBeenCalled();
    });

    it('disallows invalid actions', () => {
        const doRound = spyOn(Game.prototype, 'doRound');
        game.action(player1, [0, 1]);
        game.action(player1, [400, true]); // invalid
        expect(game.changes.size).toBe(0);
        game.action(player1, [2, false]);
        expect(game.changes.size).toBe(1);
        game.action(player2, 'invalid');
        expect(doRound).not.toHaveBeenCalled();
    });

    it('update programs', () => {
        expect(player1.sendData).toHaveBeenCalledWith('programs', jasmine.arrayWithExactContents([
            jasmine.objectContaining({ color: 0, exception: 0, isRight: true }),
            jasmine.objectContaining({ color: 1, exception: 1, isRight: true }),
            jasmine.objectContaining({ color: 2, exception: 2, isRight: true })
        ]));

        game.changes
            .set({}, [0, 1])
            .set({}, [0, 2])
            .set({}, [0, false])
            .set({}, [1, 2])
            .set({}, [2, true])
            .set({}, [2, false])
            .set({}, [2, false]);

        game.doRound();

        expect(game.changes.size).toBe(0);

        expect(player1.sendData).toHaveBeenCalledWith('programs', jasmine.arrayWithExactContents([
            jasmine.objectContaining({ color: 0, exception: 0, isRight: false }),
            jasmine.objectContaining({ color: 1, exception: 2, isRight: true }),
            jasmine.objectContaining({ color: 2, exception: 2, isRight: true })
        ]));
    });

    it('moves robots', () => {
        const exampleGrid = [
            [ ,  , 1, 0, 0, 1, 0, 0,  ,  ],
            [ ,  , 1, 0, 2, 2, 1, 2,  ,  ],
            [ ,  , 0, 1, 2, 1, 1, 2,  ,  ],
            [ , 1, 2, 1, 1, 2, 2, 2, 2,  ],
            [ , 2, 0, 0, 1, 2, 0, 1, 0,  ],
            [ , 0, 0, 1, 2, 2, 0, 1, 1,  ],
            [0, 0, 1, 0, 2, 1, 0, 2, 0, 1],
            [1, 2, 2, 1, 0, 2, 2, 0, 1, 1],
            [0, 1, 0, 0, 0, 1, 1, 2, 2, 0],
            [ , 1, 2, 1, 2, 1, 2, 2, 0,  ],
            [ , 0, 2, 1, 1, 1, 1, 0, 1,  ],
            [ , 0, 0, 2, 0, 2, 1, 1, 1,  ],
            [ ,  , 1, 1, 0, 1, 2, 1,  ,  ],
            [ ,  , 2, 2, 2, 2, 1, 1,  ,  ],
            [ ,  , 1, 2, 2, 2, 2, 0,  ,  ]
        ];

        spyOn(Board.prototype, 'get').and.callFake((x, y) => exampleGrid[x + 8][y + 5]);

        // set an example program
        game.programs[0].exception = 1;
        game.programs[0].isRight = true;

        game.programs[1].exception = 1;
        game.programs[1].isRight = false;

        game.programs[2].exception = 2;
        game.programs[2].isRight = true;

        game.doRound();

        const robot = jasmine.objectContaining;
        expect(game.robots[0]).toEqual(robot({ x: -1, y:  0, facing: 0 }));
        expect(game.robots[1]).toEqual(robot({ x:  0, y:  0, facing: 5 }));
        expect(game.robots[2]).toEqual(robot({ x:  2, y: -1, facing: 0 }));
        expect(game.robots[3]).toEqual(robot({ x: -1, y: -1, facing: 3 }));
        expect(game.robots[4]).toEqual(robot({ x: -2, y: -1, facing: 4 }));
        expect(game.robots[5]).toEqual(robot({ x: -2, y:  0, facing: 3 }));
    });
});