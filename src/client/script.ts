class Player {
    ws = new WebSocket(
        `${window.location.protocol === 'http:' ? 'ws' : 'wss'
        }://${window.location.host}`);
    code?: string;

    constructor() {
        this.ws.addEventListener('message', message => {
            const [type, data] : [string, any] = message.data;
            if (type === 'board') {
                document.querySelector('#svg-container')!.innerHTML = data;
            } else if (type === 'code') {
                this.code = data;
                document.querySelector('#code')!.textContent = data;
            }
        });

        document.querySelector('#start')!.addEventListener('click', () => {
            this.emit('start game');
        });
    }

    emit(type : any, data? : any) {
        this.ws.send(JSON.stringify([type, data]));
    }
}

new Player();