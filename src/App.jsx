import { useState, useEffect, useCallback } from "react";
import "./theme.css";
import Header from "./components/Header.jsx";
import TopBar from "./components/TopBar.jsx";
import ProblemForm from "./components/ProblemForm.jsx";
import DataPanel from "./components/DataPanel.jsx";
import ResultsPanel from "./components/ResultsPanel.jsx";
import HeatExchangerSimulation from "./components/HeatExchangerSimulation.jsx";
import { solveExchanger } from "./engine.js";
import { extractWithGemini } from "./extraction.js";
import { Compass } from "lucide-react";

const LS_KEY_SESSION = "hxs.lastSession";
const DEFAULT_API_KEY = import.meta.env?.VITE_GEMINI_API_KEY || "";

export default function App({ apiKey = DEFAULT_API_KEY } = {}) {
  const [problemText, setProblemText] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [errorMsg, setErrorMsg] = useState("");
  const [editedData, setEditedData] = useState(null);
  const [solution, setSolution] = useState(null);

  // recuperar la última sesión (solo el enunciado y los datos, nunca la clave)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_SESSION);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.problemText) setProblemText(parsed.problemText);
        if (parsed.editedData) {
          setEditedData(parsed.editedData);
          setSolution(solveExchanger(parsed.editedData));
        }
      }
    } catch (e) {
      /* sesión previa corrupta o inexistente, se ignora */
    }
  }, []);

  const persistSession = useCallback((text, data) => {
    try {
      localStorage.setItem(LS_KEY_SESSION, JSON.stringify({ problemText: text, editedData: data }));
    } catch (e) {
      /* cuota de almacenamiento llena, no crítico */
    }
  }, []);

  const handleSolve = useCallback(async () => {
    if (!apiKey || !problemText.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    setSolution(null);
    try {
      const data = await extractWithGemini(apiKey, problemText.trim());
      setEditedData(data);
      setSolution(solveExchanger(data));
      setStatus("idle");
      persistSession(problemText.trim(), data);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e.message || "Ocurrió un error inesperado.");
    }
  }, [apiKey, problemText, persistSession]);

  const handleRecalculate = useCallback(() => {
    if (!editedData) return;
    setSolution(solveExchanger(editedData));
    persistSession(problemText, editedData);
  }, [editedData, problemText, persistSession]);

  const scrollToSection = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="hxs-root">
      <TopBar onNavigate={scrollToSection} problemText={problemText} editedData={editedData} solution={solution} />

      <div className={`hxs-shell ${editedData ? "hxs-shell-wide" : ""}`}>
        <Header />

        <div className="hxs-workspace">
          <div className="hxs-col-left">
            <section id="sec-enunciado">
              <ProblemForm
                problemText={problemText}
                onChangeText={setProblemText}
                onSolve={handleSolve}
                status={status}
                errorMsg={errorMsg}
                hasApiKey={!!apiKey}
              />
            </section>

            {editedData && (
              <section id="sec-datos">
                <DataPanel data={editedData} onChange={setEditedData} onRecalculate={handleRecalculate} />
              </section>
            )}
          </div>

          <div className="hxs-col-right">
            <section id="sec-solucion">
              {solution ? (
                <>
                  <div className="hxs-eyebrow" style={{ margin: "6px 0 12px" }}>Paso 3 · Solución</div>
                  <ResultsPanel solution={solution} incognita={editedData?.incognita_principal} />
                </>
              ) : (
                <div className="hxs-card hxs-empty-results">
                  <Compass size={22} color="var(--ink-faint)" />
                  <p>Aquí va a aparecer la solución en cuanto resuelvas un enunciado.</p>
                </div>
              )}
            </section>
          </div>
        </div>

        {solution && !solution.error && (
          <section id="sec-simulacion" className="hxs-sim-full">
            <div className="hxs-eyebrow" style={{ margin: "26px 0 12px" }}>Paso 4 · Simulación</div>
            <HeatExchangerSimulation solution={solution} data={editedData} />
          </section>
        )}
      </div>
    </div>
  );
}
