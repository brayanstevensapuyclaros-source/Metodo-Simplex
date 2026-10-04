// Motor del método Simplex (2 fases) — lógica pura, sin interfaz
const EPS = 1e-9;

export function solveSimplex(c, consIn, sense) {
  const n = c.length;

  // Normalizar: RHS >= 0
  const rows0 = consIn.map((r) => {
    let coeffs = r.coeffs.slice();
    let op = r.op;
    let rhs = r.rhs;
    if (rhs < 0) {
      coeffs = coeffs.map((v) => -v);
      rhs = -rhs;
      op = op === "<=" ? ">=" : op === ">=" ? "<=" : "=";
    }
    return { coeffs, op, rhs };
  });
  const m = rows0.length;

  // Etiquetas y columnas: x1..xn, holguras/excedo s, artificiales a
  let labels = Array.from({ length: n }, (_, i) => `x${i + 1}`);
  const slackCol = [];
  const artCol = [];
  let col = n;
  for (let i = 0; i < m; i++) {
    if (rows0[i].op === "<=" || rows0[i].op === ">=") {
      slackCol.push(col);
      labels.push(`s${i + 1}`);
      col++;
    } else slackCol.push(null);
  }
  const hasArt = rows0.some((r) => r.op !== "<=");
  for (let i = 0; i < m; i++) {
    if (rows0[i].op !== "<=") {
      artCol.push(col);
      labels.push(`a${i + 1}`);
      col++;
    } else artCol.push(null);
  }
  let total = col;
  let isArt = new Array(total).fill(false);
  for (let i = 0; i < m; i++) if (artCol[i] !== null) isArt[artCol[i]] = true;

  // Tabla inicial
  let T = [];
  let basis = [];
  for (let i = 0; i < m; i++) {
    const row = new Array(total + 1).fill(0);
    rows0[i].coeffs.forEach((v, j) => (row[j] = v));
    if (rows0[i].op === "<=") {
      row[slackCol[i]] = 1;
      basis.push(slackCol[i]);
    } else if (rows0[i].op === ">=") {
      row[slackCol[i]] = -1;
      row[artCol[i]] = 1;
      basis.push(artCol[i]);
    } else {
      row[artCol[i]] = 1;
      basis.push(artCol[i]);
    }
    row[total] = rows0[i].rhs;
    T.push(row);
  }

  const iters = [];

  const snap = (phase, reduced, objVal, enter, prow, optimal, unbounded) => ({
    phase,
    labels: labels.slice(),
    tableau: T.map((r) => r.slice()),
    basis: basis.slice(),
    reduced: reduced.slice(),
    objVal,
    enter,
    prow,
    optimal,
    unbounded,
  });

  const reducedCosts = (cost) => {
    const r = new Array(total).fill(0);
    let z = 0;
    for (let i = 0; i < T.length; i++) z += cost[basis[i]] * T[i][total];
    for (let j = 0; j < total; j++) {
      let val = cost[j];
      for (let i = 0; i < T.length; i++) val -= cost[basis[i]] * T[i][j];
      r[j] = val;
    }
    return { r, z };
  };

  const doPivot = (prow, pcol) => {
    const pv = T[prow][pcol];
    for (let j = 0; j <= total; j++) T[prow][j] /= pv;
    for (let i = 0; i < T.length; i++) {
      if (i === prow) continue;
      const f = T[i][pcol];
      if (Math.abs(f) > EPS) {
        for (let j = 0; j <= total; j++) T[i][j] -= f * T[prow][j];
      }
    }
    basis[prow] = pcol;
  };

  const runPhase = (cost, phase, allowArt) => {
    for (let guard = 0; guard < 300; guard++) {
      const { r, z } = reducedCosts(cost);
      // Entra: mayor Cj − Zj positivo
      let enter = -1;
      let best = 1e-7;
      for (let j = 0; j < total; j++) {
        if (!allowArt && isArt[j]) continue;
        if (r[j] > best) {
          best = r[j];
          enter = j;
        }
      }
      if (enter === -1) {
        iters.push(snap(phase, r, z, -1, -1, true, false));
        return "optimal";
      }
      // Sale: menor cociente positivo
      let prow = -1;
      let bestRatio = Infinity;
      for (let i = 0; i < T.length; i++) {
        if (T[i][enter] > EPS) {
          const ratio = T[i][total] / T[i][enter];
          if (ratio < bestRatio - 1e-12) {
            bestRatio = ratio;
            prow = i;
          }
        }
      }
      if (prow === -1) {
        iters.push(snap(phase, r, z, enter, -1, false, true));
        return "unbounded";
      }
      iters.push(snap(phase, r, z, enter, prow, false, false));
      doPivot(prow, enter);
    }
    return "optimal";
  };

  if (hasArt) {
    // Fase 1: maximizar −(suma de artificiales)
    const cost1 = new Array(total).fill(0);
    for (let j = 0; j < total; j++) if (isArt[j]) cost1[j] = -1;
    runPhase(cost1, 1, false);
    const { z: z1 } = reducedCosts(cost1);
    if (z1 < -1e-7) return { status: "infeasible", iters, x: [], z: 0 };

    // Sacar artificiales de la base y limpiar columnas/filas
    for (let i = 0; i < T.length; i++) {
      if (isArt[basis[i]]) {
        let pcol = -1;
        for (let j = 0; j < total; j++) {
          if (!isArt[j] && Math.abs(T[i][j]) > 1e-9) {
            pcol = j;
            break;
          }
        }
        if (pcol >= 0) doPivot(i, pcol);
      }
    }
    const colMap = new Map();
    const newLabels = [];
    let newTotal = 0;
    for (let j = 0; j < total; j++) {
      if (!isArt[j]) {
        colMap.set(j, newTotal);
        newLabels.push(labels[j]);
        newTotal++;
      }
    }
    const newT = [];
    const newBasis = [];
    for (let i = 0; i < T.length; i++) {
      if (isArt[basis[i]]) continue; // fila redundante
      const row = new Array(newTotal + 1).fill(0);
      for (let j = 0; j < total; j++) {
        if (!isArt[j]) row[colMap.get(j)] = T[i][j];
      }
      row[newTotal] = T[i][total];
      newT.push(row);
      newBasis.push(colMap.get(basis[i]));
    }
    T = newT;
    basis = newBasis;
    labels = newLabels;
    total = newTotal;
    isArt = new Array(total).fill(false);
  }

  // Fase 2
  const cost2 = sense === "max" ? c.slice() : c.map((v) => -v);
  while (cost2.length < total) cost2.push(0);
  const st = runPhase(cost2, 2, false);
  if (st === "unbounded") return { status: "unbounded", iters, x: [], z: 0 };

  const x = new Array(n).fill(0);
  for (let i = 0; i < T.length; i++) {
    if (basis[i] < n) x[basis[i]] = T[i][total];
  }
  const { z: z2 } = reducedCosts(cost2);
  const z = sense === "max" ? z2 : -z2;
  return { status: "optimal", iters, x, z };
}