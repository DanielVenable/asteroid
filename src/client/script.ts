// open a websocket for communication with the server
const ws = new WebSocket(`${window.location.protocol === 'http' ? 'ws' : 'wss'}://${window.location.host}`);

// wait until the socket is open
await new Promise(resolve => ws.addEventListener('open', resolve));

