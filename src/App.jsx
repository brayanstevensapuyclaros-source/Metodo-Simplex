import { useState } from "react";
import { solveSimplex } from "./simplex";

function fmt(v) {
  if (!isFinite(v)) return "—";
  const r = Math.abs(v) < 1e-9 ? 0 : Math.round(v * 10000) / 10000;
  return String(r);
}

function IterTable({ it, sense }) {
  const total = it.labels.length;
  return (
    <div className="iter-table">
      <table>
        <thead>
          <tr>
            <th>Base</th>
            {it.labels.map((l) => <th key={l}>{l}</th>)}
            <th>RHS</th>
          </tr>
        </thead>
        <tbody>
          {it.tableau.map((row, i) => (
            <tr key={i} className={i === it.prow ? "row-out" : ""}>
              <td className="base-col">{it.basis[i] !== null ? it.labels[it.basis[i]] : "—"}</td>
              {row.slice(0, total).map((v, j) => {
                const isPivot = j === it.enter && i === it.prow;
                const inCol = j === it.enter;
                return (
                  <td key={j} className={isPivot ? "pivot" : inCol ? "col-in" : ""}>
                    {fmt(v)}
                  </td>
                );
              })}
              <td className="rhs">{fmt(row[total])}</td>
            </tr>
          ))}
          <tr className="z-row">
            <td>{it.phase === 1 ? "w (−Σa)" : "Cj − Zj"}</td>
            {it.reduced.map((v, j) => (
              <td key={j} className={j === it.enter ? "col-in" : ""}>{fmt(v)}</td>
            ))}
            <td>
              {it.phase === 1 ? fmt(-it.objVal) : fmt(sense === "max" ? it.objVal : -it.objVal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function IterCard({ it, index, sense }) {
  let note;
  if (it.optimal) {
    note = it.phase === 1
      ? "Fin de Fase 1: ya no hay coeficientes positivos en la fila w."
      : "Óptimo alcanzado: no quedan coeficientes positivos en Cj − Zj.";
  } else if (it.unbounded) {
    note = `No acotado: la columna de ${it.labels[it.enter]} no tiene cocientes positivos.`;
  } else {
    note = `Entra ${it.labels[it.enter]} · Sale ${it.labels[it.basis[it.prow]]} · pivote = ${fmt(it.tableau[it.prow][it.enter])}`;
  }
  return (
    <div className="iter-card">
      <h4>
        Iteración {index + 1} <span className="phase-tag">Fase {it.phase}</span>
        {it.optimal && <span className="badge ok">óptimo</span>}
        {it.unbounded && <span className="badge bad">no acotado</span>}
      </h4>
      <IterTable it={it} sense={sense} />
      <p className="note">{note}</p>
    </div>
  );
}

export default function App() {
  const [sense, setSense] = useState("max");
  const [nVars, setNVars] = useState(2);
  const [nCons, setNCons] = useState(3);
  const [obj, setObj] = useState(["3", "5"]);
  const [cons, setCons] = useState([
    { coeffs: ["1", "0"], op: "<=", rhs: "4" },
    { coeffs: ["0", "2"], op: "<=", rhs: "12" },
    { coeffs: ["3", "2"], op: "<=", rhs: "18" },
  ]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const changeNVars = (k) => {
    setNVars(k);
    setObj((prev) => { const a = prev.slice(0, k); while (a.length < k) a.push("0"); return a; });
    setCons((prev) => prev.map((con) => {
      const a = con.coeffs.slice(0, k);
      while (a.length < k) a.push("0");
      return { ...con, coeffs: a };
    }));
  };

  const changeNCons = (k) => {
    setNCons(k);
    setCons((prev) => {
      const a = prev.slice(0, k);
      while (a.length < k)
        a.push({ coeffs: Array.from({ length: nVars }, () => "0"), op: "<=", rhs: "0" });
      return a;
    });
  };

  const setCon = (i, patch) => {
    setCons((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const loadExample = (which) => {
    setError(null); setResult(null);
    if (which === 1) {
      setSense("max"); setNVars(2); setNCons(3);
      setObj(["3", "5"]);
      setCons([
        { coeffs: ["1", "0"], op: "<=", rhs: "4" },
        { coeffs: ["0", "2"], op: "<=", rhs: "12" },
        { coeffs: ["3", "2"], op: "<=", rhs: "18" },
      ]);
    } else {
      setSense("min"); setNVars(2); setNCons(2);
      setObj(["2", "3"]);
      setCons([
        { coeffs: ["1", "1"], op: ">=", rhs: "4" },
        { coeffs: ["1", "2"], op: ">=", rhs: "6" },
      ]);
    }
  };

  const solve = () => {
    setError(null);
    let bad = false;
    const c = obj.map((s) => { const v = Number(s); if (!isFinite(v)) bad = true; return v; });
    const consP = cons.map((con) => {
      const coeffs = con.coeffs.map((s) => { const v = Number(s); if (!isFinite(v)) bad = true; return v; });
      const rhs = Number(con.rhs);
      if (!isFinite(rhs)) bad = true;
      return { coeffs, op: con.op, rhs };
    });
    if (bad) { setError("Revisa los datos: todos los campos deben ser números válidos."); setResult(null); return; }
    setResult(solveSimplex(c, consP, sense));
  };

  const phaseList = result ? [1, 2].filter((p) => result.iters.some((it) => it.phase === p)) : [];

  return (
    <div className="app">
      <header>
        <h1>Solver del Método Simplex</h1>
        <p>Programación lineal paso a paso (máx/mín, ≤ ≥ =, dos fases). Se asume x ≥ 0.</p>
      </header>

      <section className="card">
        <div className="controls">
          <label>
            Objetivo
            <select value={sense} onChange={(e) => setSense(e.target.value)}>
              <option value="max">Maximizar Z</option>
              <option value="min">Minimizar Z</option>
            </select>
          </label>
          <label>
            Variables
            <select value={nVars} onChange={(e) => changeNVars(Number(e.target.value))}>
              {[1,2,3,4,5,6,7,8].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label>
            Restricciones
            <select value={nCons} onChange={(e) => changeNCons(Number(e.target.value))}>
              {[1,2,3,4,5,6,7,8].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <div className="examples">
            <button className="ghost" onClick={() => loadExample(1)}>Ejemplo Max</button>
            <button className="ghost" onClick={() => loadExample(2)}>Ejemplo Min</button>
          </div>
        </div>

        <h3>Función objetivo: {sense === "max" ? "Max" : "Min"} Z =</h3>
        <div className="row-inputs">
          {obj.map((v, j) => (
            <span key={j} className="term">
              <input value={v} onChange={(e) => setObj((p) => p.map((s, i) => (i === j ? e.target.value : s)))} />
              <b>x{j + 1}</b>{j < obj.length - 1 ? "+" : ""}
            </span>
          ))}
        </div>

        <h3>Sujeto a:</h3>
        <div className="constraints">
          {cons.slice(0, nCons).map((con, i) => (
            <div key={i} className="row-inputs">
              <span className="rlabel">R{i + 1}</span>
              {con.coeffs.slice(0, nVars).map((v, j) => (
                <span key={j} className="term">
                  <input
                    value={v}
                    onChange={(e) => setCon(i, { coeffs: con.coeffs.map((s, k) => (k === j ? e.target.value : s)) })}
                  />
                  <b>x{j + 1}</b>
                </span>
              ))}
              <select value={con.op} onChange={(e) => setCon(i, { op: e.target.value })}>
                <option value="<=">≤</option>
                <option value=">=">≥</option>
                <option value="=">=</option>
              </select>
              <input className="rhs-input" value={con.rhs} onChange={(e) => setCon(i, { rhs: e.target.value })} />
            </div>
          ))}
        </div>

        <button className="primary" onClick={solve}>Resolver con Simplex</button>
        {error && <div className="alert error">{error}</div>}
      </section>

      {result && result.status === "optimal" && (
        <section className="card result-ok">
          <h3>✅ Solución óptima</h3>
          <div className="solution">
            <div className="sol z"><span>{sense === "max" ? "Z máximo" : "Z mínimo"}</span><b>{fmt(result.z)}</b></div>
            {result.x.map((v, j) => (
              <div key={j} className="sol"><span>x{j + 1}</span><b>{fmt(v)}</b></div>
            ))}
          </div>
        </section>
      )}
      {result && result.status === "unbounded" && (
        <div className="alert error"><b>Problema no acotado:</b> la función objetivo mejora sin límite.</div>
      )}
      {result && result.status === "infeasible" && (
        <div className="alert error"><b>Problema infactible:</b> la Fase 1 no eliminó los artificiales.</div>
      )}

      {result && phaseList.map((p) => (
        <section key={p}>
          <h2 className="phase-title">
            {p === 1 ? "Fase 1 · Factibilidad (minimizar artificiales)" : "Fase 2 · Optimización"}
          </h2>
          {result.iters.filter((it) => it.phase === p).map((it, idx) => (
            <IterCard key={`${p}-${idx}`} it={it} index={idx} sense={sense} />
          ))}
        </section>
      ))}
    </div>
  );
}