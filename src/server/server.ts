import { createServer } from 'http';
import serveStatic from 'serve-static';
import { WebSocketServer } from 'ws';

import Connection from './connection.js';

// serve static files in public and client folders
const servePublic = serveStatic('public');
const serveClient = serveStatic('out/client');

const server = createServer((req, res) => {
    servePublic(req, res, () => serveClient(req, res, () => {
        res.statusCode = 404;
        res.end();
    }));
});

new WebSocketServer({ server }).on('connection', socket => new Connection(socket));

server.listen(process.env.PORT ?? 3000);