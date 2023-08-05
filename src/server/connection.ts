import Game from './game.js';
import type { WebSocket } from 'ws';

export default class Connection {
    game: Game | null = null;
    socket: WebSocket;

    constructor(socket : WebSocket) {
        this.socket = socket;

        socket.on('message', data => this.receive(data));
    }

    /** handle an incoming message */
    receive(data : any) {
        const [type, info] : [string, any] = JSON.parse(String(data));
        if (type === 'start game') {
            if (this.game !== null) {
                this.game = new Game(this);
                this.game.on('code', code => this.sendData('code', code));
            }
        } else if (type === 'join') {
            if (this.game !== null) {
                const game = Game.find(info);
                if (game === undefined) {
                    this.sendData('join error', 'not found');
                } else {
                    const reason = game.join(this);
                    if (reason) {
                        this.sendData('join error', reason);
                    } else {
                        this.game = game;
                        this.listen();
                    }
                }
            }
        }
    }

    /** once a game has been joined, listen for information about it */
    listen() {
        
    }

    /** send information to the client */
    sendData(type : string, data : any) {
        this.socket.send(JSON.stringify([type, data]));
    }
}