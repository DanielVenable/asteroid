type Mode = 'intro' | 'waiting-for-players' | 'playing';

export default function player (
       { document, history } : Window, ws: WebSocket, genQR: (code : string) => void) {

    // define functions:

    const select = (str: string) => document.getElementById(str)!;
    const btnClick = (str: string, func: (ev: MouseEvent) => void) =>
        select(str).addEventListener('click', func);

    function emit(type : any, data? : any) {
        const send = () => ws.send(JSON.stringify([type, data]));

        if (ws.readyState === 1) {
            send();
        } else if (ws.readyState === 0) {
            ws.addEventListener('open', send);
        }
    }

    function changeMode(newMode : Mode) {
        document.body.dataset.mode = newMode;
    }

    // if the url is for a specific game, join it
    let joiningFromURL = false;

    const URLcode = new URLSearchParams(document.location.search).get('g');
    if (URLcode) {
        joiningFromURL = true;
        emit('join', URLcode);
    }

    // handle event listeners on the intro part:

    btnClick('start', () => {
        emit('new game');
        changeMode('waiting-for-players');
        select('begin').hidden = false;
        btnClick('begin', () => emit('begin'));
    });

    btnClick('join', () => {
        select('enter-code-box').hidden = false;
        select('enter-code').focus();
    });

    btnClick('submit-code', submitCode);
    select('enter-code').addEventListener('keydown', e => {
        if (e.code === 'Enter') {
            submitCode();
        }
    });

    function submitCode() {
        const code = (<HTMLInputElement> select('enter-code')).value;
        emit('join', code);
        const response = select('join-response');
        response.textContent = 'Loading...';
        response.classList.remove('join-error');
    }

    // handle information from the server:

    ws.addEventListener('message', message => {
        const colors = ['#ff0000', '#00ff00', '#0000ff'];

        const [type, data] : [string, any] = JSON.parse(message.data);
        if (type === 'board') {
            changeMode('playing');
            select('board-placeholder').outerHTML = data;
            const { contentDocument } : HTMLObjectElement =
                document.querySelector('object[data="program.svg"]')!;
            for (const color of [0, 1, 2]) {
                contentDocument!.querySelector(`[data-color="${color}"]`)!
                        .addEventListener('click', () => {
                    // TODO: make menu appear that lets you pick what to change it to
                });
            }
        } else if (type === 'code') {
            changeMode('waiting-for-players');
            select('code').textContent = data;
            genQR(data);
            history.pushState({}, '', '?g=' + data);
        } else if (type === 'join error') {
            if (joiningFromURL) {
                console.error('Unable to join from URL. Reason: ', data);
                history.replaceState({}, '', '/');
                joiningFromURL = false;
            } else {
                const response = select('join-response');
                if (data === 'not found') {
                    response.textContent = 'Game not found';
                } else if (data === 'full') {
                    response.textContent = 'Game is full';
                } else if (data === 'already started') {
                    response.textContent = 'Game has already been started';
                }
                response.classList.add('join-error');
            }
        } else if (type === 'programs') {
            for (const { isRight, exception, color } of data) {
                const elem : HTMLObjectElement =
                    document.querySelector(`object[data-color="${color}"]`)!;
                const triangles : [SVGPathElement, SVGPathElement] = [
                    elem.contentDocument!.querySelector('#left')!,
                    elem.contentDocument!.querySelector('#right')!];
                
                triangles[+isRight].style.fill = colors[exception];
                triangles[+!isRight].style.fill = 'none';
            }
        }
    });
}