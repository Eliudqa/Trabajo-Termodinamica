import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./extraction.js", () => ({
  extractWithGemini: vi.fn(),
}));

import { extractWithGemini } from "./extraction.js";
import App from "./App.jsx";

const EX_11_4 = {
  tipo_intercambiador: "tubo_doble",
  configuracion_flujo: "contraflujo",
  fluido_caliente: { nombre: "agua geotérmica", temp_entrada_C: 160, flujo_masico_kg_s: 2, cp_kJ_kgC: 4.31, cambio_fase: false },
  fluido_frio: { nombre: "agua", temp_entrada_C: 20, temp_salida_C: 80, flujo_masico_kg_s: 1.2, cp_kJ_kgC: 4.18, cambio_fase: false },
  coeficiente_U_W_m2C: 640,
  diametro_interior: 0.015,
  requiere_correlacion_convectiva: false,
  incognita_principal: "longitud requerida del intercambiador",
};

beforeEach(() => {
  localStorage.clear();
  extractWithGemini.mockReset();
});

describe("App", () => {
  it("muestra el título y el formulario de enunciado", () => {
    render(<App apiKey="clave-de-prueba" />);
    expect(screen.getByText(/Resuelve tu ejercicio de intercambiadores/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Pega aquí el enunciado/i)).toBeInTheDocument();
  });

  it("el botón Resolver está deshabilitado sin clave de API", () => {
    render(<App apiKey="" />);
    expect(screen.getByRole("button", { name: /Resolver con Gemini/i })).toBeDisabled();
  });

  it("el botón Resolver está deshabilitado sin texto, incluso con clave", () => {
    render(<App apiKey="clave-de-prueba" />);
    expect(screen.getByRole("button", { name: /Resolver con Gemini/i })).toBeDisabled();
  });

  it("resuelve un ejercicio de verdad (extracción simulada -> motor real -> resultados)", async () => {
    const user = userEvent.setup();
    extractWithGemini.mockResolvedValueOnce(EX_11_4);
    render(<App apiKey="clave-de-prueba" />);

    await user.type(screen.getByPlaceholderText(/Pega aquí el enunciado/i), "cualquier enunciado");
    await user.click(screen.getByRole("button", { name: /Resolver con Gemini/i }));

    expect(await screen.findByText(/LMTD \(diferencia media logarítmica\)/i)).toBeInTheDocument();

    const asStat = screen.getByText(/Área superficial, As/i).closest(".hxs-stat");
    const asValue = parseFloat(asStat.querySelector(".hxs-stat-value").textContent);
    expect(asValue).toBeCloseTo(5.12, 1); // valor del libro (Ejemplo 11-4)

    expect(extractWithGemini).toHaveBeenCalledWith("clave-de-prueba", "cualquier enunciado");
  });

  it("muestra un error claro si la extracción falla", async () => {
    const user = userEvent.setup();
    extractWithGemini.mockRejectedValueOnce(new Error("La clave de API parece inválida."));
    render(<App apiKey="clave-de-prueba" />);

    await user.type(screen.getByPlaceholderText(/Pega aquí el enunciado/i), "cualquier enunciado");
    await user.click(screen.getByRole("button", { name: /Resolver con Gemini/i }));

    expect(await screen.findByText(/La clave de API parece inválida\./i)).toBeInTheDocument();
  });

  it("editar un dato y recalcular cambia el resultado sin volver a llamar a la IA", async () => {
    const user = userEvent.setup();
    extractWithGemini.mockResolvedValueOnce(EX_11_4);
    render(<App apiKey="clave-de-prueba" />);

    await user.type(screen.getByPlaceholderText(/Pega aquí el enunciado/i), "cualquier enunciado");
    await user.click(screen.getByRole("button", { name: /Resolver con Gemini/i }));
    expect(await screen.findByText(/LMTD \(diferencia media logarítmica\)/i)).toBeInTheDocument();

    const uInput = screen.getByLabelText(/Coeficiente U/i);
    await user.clear(uInput);
    await user.type(uInput, "1000");
    await user.click(screen.getByRole("button", { name: /Recalcular/i }));

    const asStat = screen.getByText(/Área superficial, As/i).closest(".hxs-stat");
    const asValue = parseFloat(asStat.querySelector(".hxs-stat-value").textContent);
    // con U más alto, se necesita menos área para transferir el mismo calor
    expect(asValue).toBeLessThan(5.12);

    expect(extractWithGemini).toHaveBeenCalledTimes(1); // recalcular NO debe llamar la API otra vez
  });
});
