// Self-contained QR Code encoder — no dependencies, no external services.
// Byte mode, versions 1-10, EC levels L/M/Q/H. Renders to inline SVG.
// Algorithm follows ISO/IEC 18004 (port of Project Nayuki's reference design).

// Error-correction block structure for versions 1-10.
// version: { level: [ecCodewordsPerBlock, [[blockCount, dataCodewordsPerBlock], ...]] }
const EC_TABLE = {
  1: { L: [7, [[1, 19]]], M: [10, [[1, 16]]], Q: [13, [[1, 13]]], H: [17, [[1, 9]]] },
  2: { L: [10, [[1, 34]]], M: [16, [[1, 28]]], Q: [22, [[1, 22]]], H: [28, [[1, 16]]] },
  3: { L: [15, [[1, 55]]], M: [26, [[1, 44]]], Q: [18, [[2, 17]]], H: [22, [[2, 13]]] },
  4: { L: [20, [[1, 80]]], M: [18, [[2, 32]]], Q: [26, [[2, 24]]], H: [16, [[4, 9]]] },
  5: { L: [26, [[1, 108]]], M: [24, [[2, 43]]], Q: [18, [[2, 15], [2, 16]]], H: [22, [[2, 11], [2, 12]]] },
  6: { L: [18, [[2, 68]]], M: [16, [[4, 27]]], Q: [24, [[4, 19]]], H: [28, [[4, 15]]] },
  7: { L: [20, [[2, 78]]], M: [18, [[4, 31]]], Q: [18, [[2, 14], [4, 15]]], H: [26, [[4, 13], [1, 14]]] },
  8: { L: [24, [[2, 97]]], M: [22, [[2, 38], [2, 39]]], Q: [22, [[4, 18], [2, 19]]], H: [26, [[4, 14], [2, 15]]] },
  9: { L: [30, [[2, 116]]], M: [22, [[3, 36], [2, 37]]], Q: [20, [[4, 16], [4, 17]]], H: [24, [[4, 12], [4, 13]]] },
  10: { L: [18, [[2, 68], [2, 69]]], M: [26, [[4, 43], [1, 44]]], Q: [24, [[6, 19], [2, 20]]], H: [28, [[6, 15], [2, 16]]] },
};

const ALIGN_POS = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

const getBit = (x, i) => ((x >>> i) & 1) !== 0;

// --- Reed-Solomon over GF(2^8), primitive polynomial 0x11D ---
function rsMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

export function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = rsMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = rsMultiply(root, 0x02);
  }
  return result;
}

export function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= rsMultiply(coef, factor);
    });
  }
  return result;
}

// 15-bit format information word (EC level + mask + BCH + XOR mask).
export function formatBits(levelName, mask) {
  const data = (FORMAT_BITS[levelName] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return (((data << 10) | rem) ^ 0x5412) & 0x7fff;
}

function dataCodewordCount(version, levelName) {
  const [, groups] = EC_TABLE[version][levelName];
  return groups.reduce((sum, [count, len]) => sum + count * len, 0);
}

class QrCode {
  constructor(version, levelName, dataCodewords) {
    this.version = version;
    this.levelName = levelName;
    this.size = version * 4 + 17;
    this.modules = [];
    this.isFunction = [];
    for (let i = 0; i < this.size; i++) {
      this.modules.push(new Array(this.size).fill(false));
      this.isFunction.push(new Array(this.size).fill(false));
    }
    this.drawFunctionPatterns();
    const all = this.addEccAndInterleave(dataCodewords);
    this.drawCodewords(all);

    let best = 0;
    let minPenalty = Infinity;
    for (let m = 0; m < 8; m++) {
      this.applyMask(m);
      this.drawFormatBits(m);
      const p = this.getPenaltyScore();
      if (p < minPenalty) {
        best = m;
        minPenalty = p;
      }
      this.applyMask(m); // undo
    }
    this.mask = best;
    this.applyMask(best);
    this.drawFormatBits(best);
  }

  setFunction(x, y, isDark) {
    this.modules[y][x] = isDark;
    this.isFunction[y][x] = true;
  }

  drawFunctionPatterns() {
    const size = this.size;
    for (let i = 0; i < size; i++) {
      this.setFunction(6, i, i % 2 === 0);
      this.setFunction(i, 6, i % 2 === 0);
    }
    this.drawFinder(3, 3);
    this.drawFinder(size - 4, 3);
    this.drawFinder(3, size - 4);

    const pos = ALIGN_POS[this.version];
    const n = pos.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        this.drawAlignment(pos[i], pos[j]);
      }
    }

    this.drawFormatBits(0);
    this.drawVersion();
  }

  drawFinder(cx, cy) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
          this.setFunction(x, y, dist !== 2 && dist !== 4);
        }
      }
    }
  }

  drawAlignment(cx, cy) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  drawVersion() {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = getBit(bits, i);
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunction(a, b, bit);
      this.setFunction(b, a, bit);
    }
  }

  drawFormatBits(mask) {
    const bits = formatBits(this.levelName, mask);
    for (let i = 0; i < 6; i++) this.setFunction(8, i, getBit(bits, i));
    this.setFunction(8, 7, getBit(bits, 6));
    this.setFunction(8, 8, getBit(bits, 7));
    this.setFunction(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++) this.setFunction(14 - i, 8, getBit(bits, i));
    for (let i = 0; i < 8; i++) this.setFunction(this.size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++) this.setFunction(8, this.size - 15 + i, getBit(bits, i));
    this.setFunction(8, this.size - 8, true); // always-dark module
  }

  addEccAndInterleave(data) {
    const [ecPerBlock, groups] = EC_TABLE[this.version][this.levelName];
    const divisor = rsDivisor(ecPerBlock);
    const blocks = [];
    let k = 0;
    for (const [count, dataLen] of groups) {
      for (let b = 0; b < count; b++) {
        const dat = data.slice(k, k + dataLen);
        k += dataLen;
        blocks.push({ dat, ecc: rsRemainder(dat, divisor) });
      }
    }
    const result = [];
    const maxData = Math.max(...blocks.map((b) => b.dat.length));
    for (let i = 0; i < maxData; i++) {
      for (const blk of blocks) if (i < blk.dat.length) result.push(blk.dat[i]);
    }
    for (let i = 0; i < ecPerBlock; i++) {
      for (const blk of blocks) result.push(blk.ecc[i]);
    }
    return result;
  }

  drawCodewords(data) {
    const size = this.size;
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  applyMask(mask) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.isFunction[y][x]) continue;
        let invert;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        }
        if (invert) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  getPenaltyScore() {
    const size = this.size;
    const m = this.modules;
    const N1 = 3, N2 = 3, N3 = 40, N4 = 10;
    let result = 0;

    for (let y = 0; y < size; y++) {
      let runColor = false, runLen = 0;
      const hist = [0, 0, 0, 0, 0, 0, 0];
      for (let x = 0; x < size; x++) {
        if (m[y][x] === runColor) {
          runLen++;
          if (runLen === 5) result += N1;
          else if (runLen > 5) result++;
        } else {
          this._addHistory(runLen, hist);
          if (!runColor) result += this._countFinders(hist) * N3;
          runColor = m[y][x];
          runLen = 1;
        }
      }
      result += this._terminate(runColor, runLen, hist) * N3;
    }
    for (let x = 0; x < size; x++) {
      let runColor = false, runLen = 0;
      const hist = [0, 0, 0, 0, 0, 0, 0];
      for (let y = 0; y < size; y++) {
        if (m[y][x] === runColor) {
          runLen++;
          if (runLen === 5) result += N1;
          else if (runLen > 5) result++;
        } else {
          this._addHistory(runLen, hist);
          if (!runColor) result += this._countFinders(hist) * N3;
          runColor = m[y][x];
          runLen = 1;
        }
      }
      result += this._terminate(runColor, runLen, hist) * N3;
    }

    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) result += N2;
      }
    }

    let dark = 0;
    for (const row of m) for (const v of row) if (v) dark++;
    const total = size * size;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * N4;
    return result;
  }

  _addHistory(runLen, hist) {
    if (hist[0] === 0) runLen += this.size; // light border before the first run
    hist.pop();
    hist.unshift(runLen);
  }

  _countFinders(hist) {
    const n = hist[1];
    const core = n > 0 && hist[2] === n && hist[3] === n * 3 && hist[4] === n && hist[5] === n;
    return (
      (core && hist[0] >= n * 4 && hist[6] >= n ? 1 : 0) +
      (core && hist[6] >= n * 4 && hist[0] >= n ? 1 : 0)
    );
  }

  _terminate(runColor, runLen, hist) {
    if (runColor) {
      this._addHistory(runLen, hist);
      runLen = 0;
    }
    runLen += this.size; // light border after the last run
    this._addHistory(runLen, hist);
    return this._countFinders(hist);
  }
}

function appendBits(value, len, bits) {
  for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

// Returns a 2D boolean matrix (true = dark module).
export function encodeToMatrix(text, levelName = 'M') {
  const data = Array.from(Buffer.from(String(text), 'utf8'));
  for (let version = 1; version <= 10; version++) {
    const capacityBits = dataCodewordCount(version, levelName) * 8;
    const ccBits = version <= 9 ? 8 : 16;
    if (4 + ccBits + data.length * 8 > capacityBits) continue;

    const bits = [];
    appendBits(0b0100, 4, bits); // byte mode
    appendBits(data.length, ccBits, bits);
    for (const b of data) appendBits(b, 8, bits);
    appendBits(0, Math.min(4, capacityBits - bits.length), bits); // terminator
    appendBits(0, (8 - (bits.length % 8)) % 8, bits); // byte align
    for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) appendBits(pad, 8, bits);

    const codewords = new Array(bits.length / 8).fill(0);
    bits.forEach((bit, i) => {
      if (bit) codewords[i >>> 3] |= 1 << (7 - (i & 7));
    });

    return new QrCode(version, levelName, codewords).modules;
  }
  throw new Error('Data too long to encode as a QR code (exceeds version 10).');
}

// Render a module matrix as a compact, crisp inline SVG.
export function toSvg(matrix, { border = 4, dark = '#0b1020', light = '#ffffff' } = {}) {
  const size = matrix.length;
  const dim = size + border * 2;
  let path = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (matrix[y][x]) path += `M${x + border} ${y + border}h1v1h-1z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="QR code">` +
    `<rect width="${dim}" height="${dim}" fill="${light}"/>` +
    `<path d="${path}" fill="${dark}"/></svg>`
  );
}

// Convenience: text -> inline SVG string.
export function qrSvg(text, opts = {}) {
  return toSvg(encodeToMatrix(text, opts.level || 'M'), opts);
}
