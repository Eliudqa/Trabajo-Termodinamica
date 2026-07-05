import { useState, useEffect, useCallback } from "react";
import "./theme.css";
import Header from "./components/Header.jsx";
import ProblemForm from "./components/ProblemForm.jsx";
import DataPanel from "./components/DataPanel.jsx";
import ResultsPanel from "./components/ResultsPanel.jsx";
import { solveExchanger } from "./engine.js";
import { extractWithGemini } from "./extraction.js";

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

  return (
    <div className="hxs-root">
      <div className="hxs-shell">
        <Header />

        <ProblemForm
          problemText={problemText}
          onChangeText={setProblemText}
          onSolve={handleSolve}
          status={status}
          errorMsg={errorMsg}
          hasApiKey={!!apiKey}
        />

        {editedData && <DataPanel data={editedData} onChange={setEditedData} onRecalculate={handleRecalculate} />}

        {solution && (
          <>
            <div className="hxs-eyebrow" style={{ margin: "6px 0 12px" }}>Paso 3 · Solución</div>
            <ResultsPanel solution={solution} incognita={editedData?.incognita_principal} data={editedData} />
          </>
        )}
      </div>
    </div>
  );
}
