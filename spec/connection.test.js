import Connection from '../out/server/connection.js';
import Game from '../out/server/game.js';

describe('connection should respond to commands:', () => {
    let /** @type { Connection } */ connection;
    let /** @type {{ on: jasmine.Spy, send: jasmine.Spy }} */ wsSpy;

    function send(data) {
        connection.receive(JSON.stringify(data));
    }

    beforeEach(() => {
        wsSpy = jasmine.createSpyObj('WebSocket', ['on', 'send']);
        connection = new Connection(wsSpy);
    });

    it('new game', () => {
        send(['new game', undefined]);
        expect(connection.game).toEqual(jasmine.any(Game));
    });

    it('join', () => {
        send(['join', '']);
        expect(wsSpy.send).toHaveBeenCalledWith('["join error","not found"]');

        const game = jasmine.createSpyObj('Game', ['join']);
        Game.instances.set('example-code', game);

        send(['join', 'example-code']);
        send(['join', 'example-code']);
        expect(game.join).toHaveBeenCalledOnceWith(connection);
    });

    it('display name', () => {
        send(['new game', undefined]);

        let wsSpy2 = jasmine.createSpyObj('WebSocket', ['on', 'send']),
            connection2 = new Connection(wsSpy2);

        connection2.receive(JSON.stringify(['join', connection.game.code]));

        expect(wsSpy.send).toHaveBeenCalledWith(JSON.stringify(['you are', {index:0, name:'Player 1'}]));
        expect(wsSpy.send).toHaveBeenCalledWith(JSON.stringify(['name', {index:1, name:'Player 2'}]));

        expect(wsSpy2.send).toHaveBeenCalledWith(JSON.stringify(['name', {index:0, name:'Player 1'}]));
        expect(wsSpy2.send).toHaveBeenCalledWith(JSON.stringify(['you are', {index:1, name:'Player 2'}]));

        send(['display name', 'Bob']);
        expect(connection.name).toBe('Bob');
        expect(wsSpy2.send).toHaveBeenCalledWith(JSON.stringify(['name', {index:0, name:'Bob'}]));
    });
});