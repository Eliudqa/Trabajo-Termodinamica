import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App.jsx";

beforeEach(() => {
  localStorage.clear();
});

describe("App (flujo completo sin red, usando los ejemplos precargados)", () => {
  it("carga el Ejemplo 11-4 y muestra los resultados correctos (LMTD)", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Ej\. 11-4/i }));

    // Debe aparecer la sección de solución con el método correcto
    expect(await screen.findByText(/LMTD \(diferencia media logarítmica\)/i)).toBeInTheDocument();

    // El área calculada debe rondar 5.12 m² (valor del libro)
    const asStat = screen.getByText(/Área superficial, As/i).closest(".hxs-stat");
    const asValue = parseFloat(asStat.querySelector(".hxs-stat-value").textContent);
    expect(asValue).toBeCloseTo(5.12, 1);
  });

  it("carga el Ejemplo 11-9 y muestra el método NTU con temperaturas de salida", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Ej\. 11-9/i }));

    expect(await screen.findByText(/Efectividad – NTU/i)).toBeInTheDocument();
    // temperatura de salida del aceite ronda 89.9°C (fórmula exacta del método NTU)
    expect(screen.getByText(/89\.9°C/)).toBeInTheDocument();
  });

  it("el botón Resolver está deshabilitado sin clave de API y sin texto", () => {
    render(<App />);
    const btn = screen.getByRole("button", { name: /Resolver con Gemini/i });
    expect(btn).toBeDisabled();
  });

  it("recalcular tras editar un dato cambia el resultado", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /Ej\. 11-3/i }));
    expect(await screen.findByText(/LMTD \(diferencia media logarítmica\)/i)).toBeInTheDocument();

    // cambiar el coeficiente U y recalcular
    const uInput = screen.getByLabelText(/Coeficiente U/i);
    await user.clear(uInput);
    await user.type(uInput, "3000");
    await user.click(screen.getByRole("button", { name: /Recalcular/i }));

    const qStat = screen.getByText(/Calor transferido, Q/i).closest(".hxs-stat");
    // con U=3000 (antes 2100), Q debe ser notablemente mayor que los ~1087 kW originales
    const qValueEl = qStat.querySelector(".hxs-stat-value");
    const qValue = parseFloat(qValueEl.textContent);
    expect(qValue).toBeGreaterThan(1400);
  });
});
