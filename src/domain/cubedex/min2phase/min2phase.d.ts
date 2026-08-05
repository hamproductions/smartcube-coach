/**
 * Ported from poliva/cubedex (MIT licensed).
 * Source: src/lib/min2phase/min2phase.d.ts
 * Copyright (c) 2024 Pau Oliva Fora
 */

declare module 'min2phase.js'
export class Search {
	constructor();
	solution(
		facelets: string,
		maxDepth: number=21,
		probeMax: number=1e9,
		probeMin: number=0,
		verbose: number=0,
		firstAxisFilter: number=0,
		lastAxisFilter: number=0
	): string;
	next(
		probeMax: number=1e9,
		probeMin: number=0,
		verbose: number=0
	): string;
};
export function solve(facelet: string): string;
export function randomCube(): string;
export function initFull();
export var INVERSE_SOLUTION;
