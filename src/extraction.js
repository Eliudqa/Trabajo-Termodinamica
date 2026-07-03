// ============================================================
// Conexión con la API de Gemini para extraer los datos del
// enunciado en el formato que espera engine.js
// ============================================================

export const GEMINI_MODEL = "gemini-3.5-flash";

const FLUID_SCHEMA = {
  type: "object",
  properties: {
    nombre: { type: "string" },
    temp_entrada_C: { type: "number" },
    temp_salida_C: { type: "number" },
    flujo_masico_kg_s: { type: "number" },
    cp_kJ_kgC: { type: "number" },
    cp_estimado: { type: "boolean" },
    cambio_fase: { type: "boolean" },
    hfg_kJ_kg: { type: "number" },
  },
  required: ["nombre", "cambio_fase"],
};

export const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    tipo_intercambiador: { type: "string", enum: ["tubo_doble", "tubos_coraza", "flujo_cruzado"] },
    configuracion_flujo: {
      type: "string",
      enum: ["paralelo", "contraflujo", "cruzado_no_mezclado", "cruzado_cmax_mezclado", "cruzado_cmin_mezclado"],
    },
    pasos_coraza: { type: "integer" },
    pasos_tubos: { type: "integer" },
    fluido_caliente: FLUID_SCHEMA,
    fluido_frio: FLUID_SCHEMA,
    coeficiente_U_W_m2C: { type: "number" },
    hi: { type: "number" },
    ho: { type: "number" },
    factor_incrustacion_i: { type: "number" },
    factor_incrustacion_o: { type: "number" },
    conductividad_pared_k: { type: "number" },
    diametro_interior: { type: "number" },
    diametro_exterior: { type: "number" },
    area_m2: { type: "number" },
    longitud_m: { type: "number" },
    requiere_correlacion_convectiva: { type: "boolean" },
    incognita_principal: { type: "string" },
    notas: { type: "string" },
  },
  required: [
    "tipo_intercambiador",
    "configuracion_flujo",
    "fluido_caliente",
    "fluido_frio",
    "requiere_correlacion_convectiva",
    "incognita_principal",
  ],
};

export const EXTRACTION_PROMPT = `Eres un asistente experto en transferencia de calor e intercambiadores de calor (método LMTD y efectividad-NTU, nomenclatura del libro de Cengel). Vas a leer el enunciado de un ejercicio universitario en español y extraer TODOS los datos en el formato JSON solicitado. NO resuelvas el ejercicio, solo extrae y estructura los datos.

REGLAS:
1. Fluido "caliente" = el de mayor temperatura (sin importar el orden en que aparece en el texto). Fluido "frío" = el de menor temperatura.
2. tipo_intercambiador: "tubo_doble" (tubos concéntricos simples), "tubos_coraza" (mencionan coraza/casco y tubos, o "N pasos por la coraza y M pasos por los tubos"), "flujo_cruzado" (radiadores, intercambiadores compactos, mencionan flujo cruzado).
3. configuracion_flujo: "paralelo" (entran por el mismo extremo), "contraflujo" (extremos opuestos — úsala también como base para coraza-tubos), "cruzado_no_mezclado", "cruzado_cmax_mezclado" o "cruzado_cmin_mezclado" (indica cuál fluido va mezclado).
4. cambio_fase=true si el fluido se condensa, hierve, se evapora, o es "vapor/líquido saturado" a temperatura constante. En ese caso temp_entrada_C = temp_salida_C = esa temperatura, y captura hfg_kJ_kg si se menciona.
5. Si cp NO se da numéricamente, ESTIMA un valor típico según el fluido (agua≈4.18, aceite de motor≈1.9-2.2, etilenglicol≈2.4-2.6, glicerina≈2.4, aire≈1.005-1.01, amoniaco≈4.8, alcohol etílico≈2.5-2.7 kJ/kg·°C) y marca cp_estimado=true. Si el enunciado sí da el valor, cp_estimado=false.
6. Convierte SIEMPRE a: temperaturas en °C; flujo másico en kg/s (kg/min÷60, kg/h÷3600, L/min de agua≈÷60 con densidad≈1000 kg/m³); cp en kJ/kg·°C; U/hi/ho en W/m²·°C; longitudes/diámetros en m; hfg en kJ/kg; incrustación en m²·°C/W.
7. Si el enunciado da hi y ho DIRECTAMENTE como números, captúralos y pon requiere_correlacion_convectiva=false. Si en cambio hay que calcular hi u ho mediante correlaciones de convección (Reynolds, Nusselt, Dittus-Boelter, etc. — es decir, se dan velocidad/caudal y propiedades pero NO un valor de h), deja hi/ho sin definir y pon requiere_correlacion_convectiva=true.
8. incognita_principal: describe en pocas palabras qué pide encontrar el ejercicio.
9. En "notas" explica brevemente cualquier suposición (unidades convertidas, propiedades estimadas, ambigüedades resueltas).

Responde ÚNICAMENTE con el JSON, sin texto adicional.

EJERCICIO:
`;

/**
 * Llama a la API de Gemini (generateContent) y devuelve el objeto JSON
 * ya parseado con la forma que espera engine.js -> solveExchanger().
 */
export async function extractWithGemini(apiKey, problemText) {
  if (!apiKey) throw new Error("Falta la clave de API de Gemini.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: EXTRACTION_PROMPT + problemText }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });
  } catch (e) {
    throw new Error("No se pudo conectar con la API de Gemini (revisa tu conexión a internet). Detalle: " + e.message);
  }

  let json;
  try {
    json = await resp.json();
  } catch (e) {
    throw new Error("La respuesta de Gemini no se pudo leer como JSON.");
  }

  if (!resp.ok) {
    const msg = json?.error?.message || `Error HTTP ${resp.status}`;
    if (resp.status === 400 && /API key|API_KEY/i.test(msg)) {
      throw new Error("La clave de API parece inválida o mal copiada. Revísala en Google AI Studio.");
    }
    if (resp.status === 403) {
      throw new Error("Acceso denegado (403). Verifica que la clave esté activa y que el proyecto de Google Cloud tenga la API de Gemini habilitada.");
    }
    if (resp.status === 429) {
      throw new Error("Se alcanzó el límite de solicitudes gratuitas por minuto/día. Espera un momento y vuelve a intentar.");
    }
    throw new Error("Gemini devolvió un error: " + msg);
  }

  const candidate = json?.candidates?.[0];
  if (!candidate) throw new Error("Gemini no devolvió ninguna respuesta utilizable.");
  if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
    throw new Error("Gemini no pudo completar la extracción (motivo: " + candidate.finishReason + ").");
  }

  const text = candidate?.content?.parts?.map((p) => p.text || "").join("") || "";
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error("No se pudo interpretar el JSON devuelto por Gemini. Respuesta cruda: " + text.slice(0, 200));
  }
}
