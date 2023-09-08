import Player from './player.js';
import QRCode from 'https://cdn.skypack.dev/qrcode@1.5.3';

const { protocol, host, origin, pathname } = window.location;

Player(window, new WebSocket(
    `${protocol === 'http:' ? 'ws' : 'wss'}://${host}`),
    code => QRCode.toCanvas(document.querySelector('#qrcode'), `${origin}${pathname}?g=${code}`));