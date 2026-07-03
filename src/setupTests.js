import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Asegura que cada prueba desmonte el componente anterior (evita coincidencias
// de texto duplicadas entre pruebas si el auto-cleanup no se registra a tiempo).
afterEach(() => cleanup());

// jsdom no implementa ResizeObserver, pero recharts (ResponsiveContainer) lo necesita.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

