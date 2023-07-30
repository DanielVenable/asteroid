import WebSocket, { WebSocketServer } from 'ws';

export default function handleSocketRequests(server) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', socket => new Connection(socket));
}

class Connection {
    /** @param {WebSocket} socket */
    constructor(socket) {
        this.socket = socket;

        socket.on('message', data => this.receive(data));
    }

    /** handle an incoming message */
    receive(data) {
        
    }
}