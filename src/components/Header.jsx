import BrandMark from "./BrandMark.jsx";

export default function Header() {
  return (
    <>
      <div className="hxs-brandrow">
        <BrandMark />
        <div className="hxs-eyebrow">Herramienta · Transferencia de calor</div>
      </div>
      <h1 className="hxs-h1">Resuelve tu ejercicio de intercambiadores</h1>
      <p className="hxs-sub">
        Pega el enunciado, Gemini extrae los datos y este motor aplica LMTD o efectividad-NTU
        —validado contra los ejemplos del libro— sin que tengas que teclear un solo número.
      </p>
    </>
  );
}
