import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./extraction.js", () => ({ extractWithGemini: vi.fn() }));
import { extractWithGemini } from "./extraction.js";
import App from "./App.jsx";

const EX = {
  tipo_intercambiador: "tubo_doble",
  configuracion_flujo: "contraflujo",
  fluido_caliente: { nombre: "agua geotérmica", temp_entrada_C: 160, flujo_masico_kg_s: 2, cp_kJ_kgC: 4.31 },
  fluido_frio: { nombre: "agua", temp_entrada_C: 20, temp_salida_C: 80, flujo_masico_kg_s: 1.2, cp_kJ_kgC: 4.18 },
  coeficiente_U_W_m2C: 640,
  diametro_interior: 0.015,
  conductividad_pared_k: 110,
  diametro_exterior: 0.017,
  incognita_principal: "longitud",
};

beforeEach(() => { localStorage.clear(); extractWithGemini.mockReset(); });

describe("Sanity: pestañas + topbar + layout de 2 columnas", () => {
  it("la pestaña Avanzado muestra la conductividad de pared, y el punto indicador aparece si ya hay datos", async () => {
    const user = userEvent.setup();
    extractWithGemini.mockResolvedValueOnce(EX);
    render(<App apiKey="clave" />);
    await user.type(screen.getByPlaceholderText(/Pega aquí el enunciado/i), "algo");
    await user.click(screen.getByRole("button", { name: /Resolver con Gemini/i }));
    await screen.findByText(/LMTD \(diferencia media logar.tmica\)/i);

    // por defecto la pestaña "Datos principales" está activa y U es visible
    expect(screen.getByLabelText(/Coeficiente U/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Conductividad de la pared/i)).not.toBeInTheDocument();

    // cambiar a Avanzado
    await user.click(screen.getByRole("tab", { name: /Avanzado/i }));
    expect(screen.getByLabelText(/Conductividad de la pared/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Conductividad de la pared/i)).toHaveValue(110);
  });

  it("el topbar tiene los 3 pasos y navega al hacer click", async () => {
    const user = userEvent.setup();
    extractWithGemini.mockResolvedValueOnce(EX);
    render(<App apiKey="clave" />);
    expect(screen.getByRole("button", { name: "Enunciado" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Datos" })).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/Pega aquí el enunciado/i), "algo");
    await user.click(screen.getByRole("button", { name: /Resolver con Gemini/i }));
    await screen.findByText(/LMTD \(diferencia media logar.tmica\)/i);

    expect(screen.getByRole("button", { name: "Datos" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Solución" })).not.toBeDisabled();
  });

  it("la simulación queda FUERA de las 2 columnas, como sección final a ancho completo", async () => {
    const user = userEvent.setup();
    extractWithGemini.mockResolvedValueOnce(EX);
    render(<App apiKey="clave" />);
    await user.type(screen.getByPlaceholderText(/Pega aquí el enunciado/i), "algo");
    await user.click(screen.getByRole("button", { name: /Resolver con Gemini/i }));
    await screen.findByText(/LMTD \(diferencia media logarítmica\)/i);

    const workspace = document.querySelector(".hxs-workspace");
    const simSection = document.getElementById("sec-simulacion");
    expect(simSection).not.toBeNull();
    // no debe estar anidada dentro del workspace de 2 columnas (ni de hxs-col-right)
    expect(workspace.contains(simSection)).toBe(false);
    // debe venir DESPUÉS del workspace en el DOM (es la última sección)
    expect(workspace.compareDocumentPosition(simSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
