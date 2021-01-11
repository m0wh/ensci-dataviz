
export function range (val: number, inMin: number, inMax: number, outMin: number, outMax: number): number { return (val - inMin) * (outMax - outMin) / (inMax - inMin) + outMin }
export function lerp (start: number, end: number, amt: number): number { return (1 - amt) * start + amt * end }
