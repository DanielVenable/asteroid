type Mode = 'intro' | 'waiting-for-players' | 'playing';

export default function player (
       { document, history } : Window, ws: WebSocket, genQR: (code : string) => void) {

    // define functions:

    const select = (str: string) => document.getElementById(str)!;
    const btnClick = (str: string, func: (ev: MouseEvent) => void) =>
        select(str).addEventListener('click', func);

    function inputSubmit(input : string, button : string, func : (value: string) => void) {
        const elem = <HTMLInputElement> select(input);
        btnClick(button, () => func(elem.value));
        elem.addEventListener('keydown', e => {
            if (e.code === 'Enter') {
                func(elem.value);
            }
        });
    }

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

    inputSubmit('enter-code', 'submit-code', code => {
        emit('join', code);
        const response = select('join-response');
        response.textContent = 'Loading...';
        response.classList.remove('join-error');
    });

    select('display-name').addEventListener('change', function() {
        const { value } = <HTMLInputElement> this;
        if (value) {
            emit('display name', value);
        }
    });

    /** the directions each of the robots are facing */
    const robotFacing = [0, 1, 2, 3, 4, 5];

    let me : Number;

    let isDone = false;
    let begun = false;

    const programLoad = new Promise(resolve =>
        document.querySelector('object.programs')!.addEventListener('load', resolve));

    // handle information from the server:

    ws.addEventListener('message', async message => {
        const colors = ['#ff0000', '#00ff00', '#0000ff'];

        const [type, data] : [string, any] = JSON.parse(message.data);

        if (type === 'board') {
            if (!begun) begin();
            select('board-container').innerHTML = data;
            isDone = false;
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
            await programLoad;

            const elem : HTMLObjectElement = document.querySelector(`object.programs`)!;
            for (const { isRight, exception, color } of data) {
                const triangles : [SVGPathElement, SVGPathElement] = [
                    elem.contentDocument!.querySelector(`[data-color="${color}"] .left`)!,
                    elem.contentDocument!.querySelector(`[data-color="${color}"] .right`)!];
                
                triangles[+isRight].style.fill = colors[exception];
                triangles[+!isRight].style.fill = 'none';
            }
        } else if (type === 'robots') {
            const robots : any = document.querySelector('#robots')!.children;
            for (let i = 0; i < 6; i++) {
                if (data[i].intermediatePos) {
                    await animate(robots[i], robotFacing[i], data[i].intermediatePos);
                    await animate(robots[i], data[i].intermediatePos.facing, data[i]);
                } else {
                    robots[i].transform.baseVal.getItem(0)
                        .setTranslate(...coords(data[i].x, data[i].y));
                    robots[i].children[0].transform.baseVal.getItem(1)
                        .setRotate(300 - data[i].facing * 60, 0, 0);
                }
                robotFacing[i] = data[i].facing;
            }

            function animate(bot : any, prevFacing : number,
                    { x, y, facing } : { x : number, y : number, facing : number }) {
                return new Promise<void>(resolve => {                
                    const DURATION = 200, // milliseconds
                        startTime = performance.now(),

                        translateMatrix : SVGTransform = bot.transform.baseVal.getItem(0),
                        rotateMatrix : SVGTransform = bot.children[0].transform.baseVal.getItem(1),

                        { e: startX, f: startY } = translateMatrix.matrix,
                        [endX, endY] = coords(x, y),

                        deltaX = endX - startX,
                        deltaY = endY - startY,

                        rotationMultiplier = (facing - prevFacing + 9) % 6 - 3;

                    function frame() {
                        const progress = (performance.now() - startTime) / DURATION;
                        if (progress >= 1) {
                            translateMatrix.setTranslate(endX, endY);
                            rotateMatrix.setRotate(300 - facing * 60, 0, 0);
                            resolve();
                        } else {
                            translateMatrix.setTranslate(
                                startX + progress * deltaX,
                                startY + progress * deltaY);
                            rotateMatrix.setRotate(300 - (prevFacing + progress * rotationMultiplier) * 60, 0, 0);
                            requestAnimationFrame(frame);
                        }
                    }
                    requestAnimationFrame(frame);
                });
            }

            function coords(x : number, y : number) {
                return [(x + 1) / 2, Math.sqrt(3) / 2 * (y + ((x + y) % 2 === 0 ? 1/3 : 2/3))];
            }
        } else if (type === 'changes') {
            for (const [player, [color, value]] of data) {
                const object : HTMLObjectElement = document.querySelector(
                    `[data-player-id="${player}"] object.status`)!;
                
                if (object.contentDocument === null) {
                    // not loaded yet
                    await new Promise(resolve => object.addEventListener('load', resolve));
                }

                const doc = object.contentDocument!;
                (<SVGElement> doc.querySelector('#triangle'))!.dataset.color = color;
                doc.documentElement.dataset.value = value;
            }
        } else if (type === 'name') {
            let textElem = document.querySelector(`[data-player-id="${data.index}"] > .display-name`);
            if (textElem === null) {
                const parentElem = document.createElement('div'),
                    changeElem = createChangeElem();
                textElem = document.createElement('div');
                parentElem.append(textElem, changeElem);
                textElem.classList.add('display-name');
                parentElem.dataset.playerId = data.index;
                document.querySelector('.players')!.append(parentElem);
            }
            textElem.textContent = data.name;
        } else if (type === 'you are') {
            (<HTMLInputElement> document.querySelector('#display-name')).value = data.name;
            (<HTMLElement> document.querySelector('.you')).dataset.playerId = me = data.index;
            (<HTMLElement> document.querySelector('.you')).append(createChangeElem());
        } else if (type === 'goals') {
            for (const [i, [x, y]] of data) {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'use');
                circle.setAttribute('href', '#circle');
                circle.setAttribute('transform',
                    `translate(${x / 2}, ${((x + y) % 2 === 0 ? y : y + 1/3) * Math.sqrt(3) / 2})`);
                circle.dataset.player = String(i);
                if (i === me) {
                    // make this player's goal bright yellow
                    circle.setAttribute('fill', '#ffff00');
                } else {
                    // other players' goals are gray
                    circle.setAttribute('fill', '#dddddd');
                }
                document.querySelector('#goals')!.append(circle);

                const player = document.querySelector(`.players > [data-player-id="${i}"`)?.classList;

                circle.addEventListener('pointerenter', () => player?.add('highlight'));
                circle.addEventListener('pointerout', () => player?.remove('highlight'));
            }
        } else if (type === 'winners') {
            for (const winner of data) {
                document.querySelector(`.players > [data-player-id="${winner}"] > .display-name`)!
                    .insertAdjacentHTML('afterend', '<div class="winner">Winner!</div>');
            }
            isDone = true;
        } else if (type === 'remove') {
            document.querySelector(`.players > [data-player-id="${data}"]`)!.remove();
            document.querySelector(`#goals > [data-player="${data}"]`)!.remove();
        } else if (type === 'host') {
            select('begin').hidden = false;
            btnClick('begin', () => emit('begin'));
        }

        function createChangeElem() {
            const changeElem = document.createElement('object');
            changeElem.classList.add('status');
            changeElem.type = 'image/svg+xml';
            changeElem.data = 'change.svg';
            return changeElem;
        }
    });

    async function begin() {
        begun = true;

        changeMode('playing');

        // set this player's display name
        const elem = document.createElement('div');
        elem.classList.add('display-name');
        elem.textContent =
            (<HTMLInputElement> document.querySelector('#display-name')!).value;
        document.querySelector('#display-name')!.remove();
        document.querySelector('.you')!.prepend(elem);

        // attach event listeners to programs
        await programLoad;
        
        const { contentDocument: doc } : HTMLObjectElement =
        document.querySelector('object.programs')!,

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
                if (!isDone) {
                    menu.classList.remove('hidden');
                    setValue(undefined);
                    selectedColor = color;
                }
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
    }
}