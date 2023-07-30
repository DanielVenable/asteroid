import { createServer } from 'http';
import serveStatic from 'serve-static';

import handleSocketRequests from './handleSocketRequests.js';

// serve static files in public folder
const serve = serveStatic('public', { index: ['index.html'] })

const server = createServer((req, res) => serve(req, res, () => res.end()));

handleSocketRequests(server);

server.listen(process.env.PORT ?? 3000);
