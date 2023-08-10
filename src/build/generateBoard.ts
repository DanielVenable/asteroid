/**
 * This file is run on the build step.
 * It generates the board.svg file and puts it in out/client
 */

import { writeFile } from 'fs/promises';
import { create as createXML } from 'xmlbuilder2';

/** represents a triangle using a triangular coordinate system */
class Triangle {
    constructor(public x : number, public y : number) {}

    /** is the triangle facing down? */
    isDown() {
        return (this.x + this.y) % 2 === 0;
    }

    toCartesian() : [number, number] {
        return [this.x / 2, this.y / 2 * Math.sqrt(3)];
    }
}

const svg = createXML({ version: "1.0", encoding: "UTF-8" })
    .ele('svg', {
        xmlns: "http://www.w3.org/2000/svg",
        width: "1000",
        height: "1000",
        viewBox: "-5 -5 10 10"
    });

svg.ele('style').txt(`
    polygon {
        fill: none;
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
for (const [hexX, hexY] of [
              [ 0, -4],
         [-3, -3], [ 3, -3],
    [-6, -2], [ 0, -2], [ 6, -2],
         [-3, -1], [ 3, -1],
    [-6,  0], [ 0,  0], [ 6,  0],
         [-3,  1], [ 3,  1],
    [-6,  2], [ 0,  2], [ 6,  2],
         [-3,  3], [ 3,  3],
              [ 0,  4]
]) for (const [triX, triY] of [
    [-2, -1], [-1, -1], [0, -1],
    [-2,  0], [-1,  0], [0,  0]
]) {
    const triangle = new Triangle(hexX + triX, hexY + triY);
    svg.ele('use', {
        href: triangle.isDown() ? '#down-triangle' : '#up-triangle',
        transform: `translate(${triangle.toCartesian()})`,
        "data-x": triangle.x,
        "data-y": triangle.y
    });
}

await writeFile('out/client/board.svg', svg.end({ prettyPrint: true }));