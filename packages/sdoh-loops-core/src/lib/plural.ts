/** "1 link", "2 links": a count with its noun in the right number (K6 D8). */
export const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
