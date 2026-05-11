export function applyDecay(value: number, age: number) {
  return value * Math.pow(0.92, age);
}