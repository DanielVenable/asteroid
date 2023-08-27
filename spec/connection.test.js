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

    it('start game', () => {
        send(['start game', undefined]);
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
    })
});