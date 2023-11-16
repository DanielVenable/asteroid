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

            const { contentDocument: doc } : HTMLObjectElement =
                document.querySelector('object[data="program.svg"]')!,

                menu : SVGElement = doc!.querySelector('#menu')!,
                submitBtn : SVGElement = doc!.querySelector('#submit')!;

            let selectedColor : number, value : number | boolean | undefined;

            function setValue(val : number | boolean | undefined) {
                if (value === val) return;

                if (value === undefined) {
                    // there was nothing selected but now there is
                    submitBtn.classList.remove('hidden');
                } else {
                    // there was something selected
                    buttons.get(value)!.classList.remove('selected');
                }

                if (val === undefined) {
                    // it is being unselected
                    submitBtn.classList.add('hidden');
                } else {
                    // something is being selected
                    buttons.get(val)!.classList.add('selected');
                }

                value = val;
            }

            /** a map from value to button */
            const buttons = new Map(<[number | boolean, SVGElement][]> [
                [false, doc!.querySelector('#btn-l')],
                [true, doc!.querySelector('#btn-r')]
            ]);

            // when you click on a program tile, select that color and show the menu
            for (const color of [0, 1, 2]) {
                buttons.set(color, doc!.querySelector(`[data-btn-color="${color}"]`)!);

                doc!.querySelector(`[data-color="${color}"]`)!
                        .addEventListener('click', () => {
                    menu.classList.remove('hidden');
                    setValue(undefined);
                    selectedColor = color;
                });
            }

            // attach events to each button that set value
            for (const [val, btn] of buttons) {
                btn.addEventListener('click', () => setValue(val));
            }

            doc!.querySelector('#submit')!.addEventListener('click', () => {
                // submit whatever is selected
                if (selectedColor !== undefined && value !== undefined) {
                    emit('action', [selectedColor, value]);
                    menu.classList.add('hidden');
                    setValue(undefined);
                } else {
                    console.error('value must be selected before submitting');
                }
            });

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
            const elem : HTMLObjectElement = document.querySelector(`object.programs`)!;
            for (const { isRight, exception, color } of data) {
                const triangles : [SVGPathElement, SVGPathElement] = [
                    elem.contentDocument!.querySelector(`[data-color="${color}"] .left`)!,
                    elem.contentDocument!.querySelector(`[data-color="${color}"] .right`)!];
                
                triangles[+isRight].style.fill = colors[exception];
                triangles[+!isRight].style.fill = 'none';
            }
        }
    });
}