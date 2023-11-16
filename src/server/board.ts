import { create as createXML } from 'xmlbuilder2';

/** the game board composed of 114 triangles */
export class Board {
    #grid : Color[][] = Array.from({ length: 15 }).map(() => new Array(10));

    constructor() {
        // randomly generate the color for each triangle in the board
        for (const [hexX, hexY] of Board.hexes) {
            for (const [triX, triY] of Board.triangles) {
                this.#grid
                    [hexX + triX + Board.shiftX]
                    [hexY + triY + Board.shiftY]
                    = Math.floor(Math.random() * 3) as Color;
            }
        }
    }

    /** get the color at a certain position */
    get(x : number, y : number) : Color {
        return this.#grid[x + Board.shiftX]?.[y + Board.shiftY];
    }

    /** create an svg of the board */
    toSVG() {
        const svg = createXML({ version: "1.0", encoding: "UTF-8" })
            .ele('svg', {
                xmlns: "http://www.w3.org/2000/svg",
                width: "1000",
                height: "1000",
                viewBox: "-5 -5 10 10"
            });
    
        svg.ele('style').txt(`
            polygon {
                stroke: black;
                stroke-width: 0.07;
                stroke-linejoin: round;
            }
        `);
    
        svg.ele('defs').ele('polygon', {
            id: "down-triangle",
            points: "0,0 1,0 0.5,0.866", // 0.866 ~= sqrt(3) / 2
        }).up().ele('polygon', {
            id: "up-triangle",
            points: "0.5,0 0,0.866 1,0.866"
        });
    
        // loop through all triangles in the grid.
        // the outer loop loops through the coordinates of each hexagon,
        // and the inner loop loops through the coordinates of each triangle inside each hex.
        const colors = ['#ff0000', '#00ff00', '#0000ff'];

        for (const [hexX, hexY] of Board.hexes) {
            for (const [triX, triY] of Board.triangles) {
                const x = hexX + triX,
                    y = hexY + triY;
                svg.ele('use', {
                    href: isDown(x, y) ? '#down-triangle' : '#up-triangle',
                    transform: `translate(${toCartesian(x, y)})`,
                    fill: colors[this.get(x, y)],
                    "data-x": x,
                    "data-y": y
                });
            }
        }
    
        return svg.end({ prettyPrint: true });

        /** is a triangle facing down? */
        function isDown(x : number, y : number) {
            return (x + y) % 2 === 0;
        }

        /** convert from triangular to cartesian coordinates */
        function toCartesian(x : number, y : number) : [number, number] {
            return [x / 2, y / 2 * Math.sqrt(3)];
        }
    }

    // order doesn't matter
    static hexes = [
              [ 0, -4],
        [-3, -3], [ 3, -3],
    [-6, -2], [ 0, -2], [ 6, -2],
        [-3, -1], [ 3, -1],
    [-6,  0], [ 0,  0], [ 6,  0],
        [-3,  1], [ 3,  1],
    [-6,  2], [ 0,  2], [ 6,  2],
        [-3,  3], [ 3,  3],
              [ 0,  4]
    ] as const;

    // order is important for creating robots
    static triangles = [[-1, 0], [0, 0], [0, -1], [-1, -1], [-2, -1], [-2, 0]] as const;

    // indices must be shifted over by this much so they won't be negative
    static readonly shiftX = 8;
    static readonly shiftY = 5;
}

export enum Color {
    RED, GREEN, BLUE
}