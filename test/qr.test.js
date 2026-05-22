// Verifies the from-scratch QR encoder against published reference values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rsRemainder, rsDivisor, formatBits, encodeToMatrix } from '../lib/qr.js';

// Reed-Solomon: canonical worked example from ISO/IEC 18004 (numeric "01234567",
// version 1-M). 16 data codewords -> these exact 10 EC codewords.
test('Reed-Solomon matches the spec example', () => {
  const data = [16, 32, 12, 86, 97, 128, 236, 17, 236, 17, 236, 17, 236, 17, 236, 17];
  const expected = [165, 36, 212, 193, 237, 54, 199, 135, 44, 85];
  assert.deepEqual(rsRemainder(data, rsDivisor(10)), expected);
});

// Format information words against the published 32-value table.
test('format information bits match published table', () => {
  const expect = {
    L: ['111011111000100', '111001011110011', '111110110101010', '111100010011101',
        '110011000101111', '110001100011000', '110110001000001', '110100101110110'],
    M: ['101010000010010', '101000100100101', '101111001111100', '101101101001011',
        '100010111111001', '100000011001110', '100111110010111', '100101010100000'],
    Q: ['011010101011111', '011000001101000', '011111100110001', '011101000000110',
        '010010010110100', '010000110000011', '010111011011010', '010101111101101'],
    H: ['001011010001001', '001001110111110', '001110011100111', '001100111010000',
        '000011101100010', '000001001010101', '000110100001100', '000100000111011'],
  };
  for (const level of ['L', 'M', 'Q', 'H']) {
    for (let mask = 0; mask < 8; mask++) {
      const bits = formatBits(level, mask).toString(2).padStart(15, '0');
      assert.equal(bits, expect[level][mask], `${level} mask ${mask}`);
    }
  }
});

test('matrix has correct size and three finder patterns', () => {
  const m = encodeToMatrix('https://example.com/r/abcd1234', 'M');
  const size = m.length;
  assert.ok(size >= 21 && (size - 17) % 4 === 0, `size ${size}`);

  // Finder pattern (7x7): dark for Chebyshev dist 0,1,3; light ring at dist 2.
  const finderOk = (cx, cy) => {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const expectedDark = dist !== 2;
        if (m[cy + dy][cx + dx] !== expectedDark) return false;
      }
    }
    return true;
  };
  assert.ok(finderOk(3, 3), 'top-left finder');
  assert.ok(finderOk(size - 4, 3), 'top-right finder');
  assert.ok(finderOk(3, size - 4), 'bottom-left finder');
});

test('shorter input selects version 1', () => {
  const m = encodeToMatrix('hi', 'M');
  assert.equal(m.length, 21); // version 1
});
