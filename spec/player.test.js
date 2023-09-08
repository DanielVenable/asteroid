import { readFile } from 'fs/promises';
import { JSDOM } from 'jsdom';

import player from '../out/client/player.js';

describe('the player', () => {
    let html,
        /** @type { JSDOM } */ dom,
        /** @type {{ addEventListener: jasmine.Spy, send: jasmine.Spy }} */ ws,
        send;

    beforeAll(async () => {
        process.chdir('public');
        html = await readFile('index.html');
    });

    beforeEach(async () => {
        dom = new JSDOM(html);
        ws = jasmine.createSpyObj('WebSocket', ['addEventListener', 'send']);
        ws.readyState = 1;
        ws.addEventListener.and.callFake((type, listener) => {
            if (type === 'message') {
                send = obj => listener({ data: JSON.stringify(obj) });
            }
        }); 
        player(dom.window, ws, () => {});
    });

    it('create a new game', () => {
        clickOn('start');
        expectJSON(['new game', null]);
        expect(dom.window.document.body.dataset.mode === 'waiting-for-players');
    });
    
    it('begin the game', () => {
        clickOn('start');
        clickOn('begin');
        expectJSON(['begin', null]);
    });

    it('join a game', () => {
        dom.window.document.getElementById('enter-code').value = 'example-code';
        clickOn('submit-code');
        expectJSON(['join', 'example-code']);
    });

    it('join from URL', () => {
        expect(ws.send).not.toHaveBeenCalled();
        dom.reconfigure({ url: 'https://example.com/?g=example-code' });
        player(dom.window, ws, () => {});
        expectJSON(['join', 'example-code']);
    });

    it('receive join error', () => {
        send(['join error', 'full']);
        expect(dom.window.document.querySelector('#join-response.join-error').textContent)
            .toBe('Game is full');
    });

    function expectJSON(obj) {
        expect(ws.send).toHaveBeenCalledWith(JSON.stringify(obj));
    }

    function clickOn(id) {
        dom.window.document.getElementById(id).dispatchEvent(new dom.window.Event('click'));
    }
});