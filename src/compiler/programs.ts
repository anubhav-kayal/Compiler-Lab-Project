/** Sample programs shared by the interface, the tests and the benchmark script. */
export const samplePrograms = [
  { key: 'sum', label: 'Sum with loop', source: 'i = 0; s = 0;\nwhile (i < n) {\n  s = s + i * 2 + (3 * 4);\n  i = i + 1;\n}', inputs: [{ n: 0 }, { n: 5 }, { n: 12 }] },
  { key: 'evenodd', label: 'Even and odd', source: 'i = 0; e = 0; o = 0;\nwhile (i < n) {\n  if (i % 2 == 0) e = e + 1; else o = o + 1;\n  i = i + 1;\n}', inputs: [{ n: 0 }, { n: 7 }, { n: 10 }] },
  { key: 'gcd', label: 'Greatest common divisor', source: 'while (b != 0) {\n  t = a % b;\n  a = b;\n  b = t;\n}', inputs: [{ a: 48, b: 18 }, { a: 17, b: 5 }, { a: 9, b: 0 }] },
  { key: 'guard', label: 'Short-circuit guard', source: 'ok = y != 0 && x / y > 2;\nif (ok || x == 0) r = 1; else r = 0 - 1;', inputs: [{ x: 10, y: 0 }, { x: 10, y: 3 }, { x: 0, y: 0 }] },
  { key: 'fold', label: 'Constant folding', source: 'a = 2 * 3 + 4;\nb = a - (10 / 5);\nif (3 < 4) c = b * 2; else c = 0;', inputs: [{}] },
  { key: 'collatz', label: 'Collatz steps', source: 'steps = 0;\nwhile (n != 1) {\n  if (n % 2 == 0) n = n / 2; else n = 3 * n + 1;\n  steps = steps + 1;\n}', inputs: [{ n: 1 }, { n: 6 }, { n: 27 }] },
  { key: 'bool', label: 'Boolean variables', source: 'small = x < 10;\nbig = x > 100;\nmid = !small && !big;\nif (mid) r = 1; else r = 0;', inputs: [{ x: 5 }, { x: 50 }, { x: 500 }] },
  { key: 'nested', label: 'Nested loops', source: 'i = 0; c = 0;\nwhile (i < n) {\n  j = 0;\n  while (j < i) { c = c + 1; j = j + 1; }\n  i = i + 1;\n}', inputs: [{ n: 0 }, { n: 4 }, { n: 9 }] },
]
