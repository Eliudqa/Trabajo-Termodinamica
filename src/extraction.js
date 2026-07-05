// ============================================================
// Conexión con la API de Gemini para extraer los datos del
// enunciado en el formato que espera engine.js
// ============================================================

// Gemini 3.5 Flash es un modelo de razonamiento que por defecto piensa en el
// nivel MÁS ALTO antes de responder — para un enunciado largo + un schema
// grande como el nuestro, eso se traduce en varios minutos de "pensamiento"
// interno, y si consume demasiado del presupuesto de tokens de salida, el
// JSON final llega cortado a la mitad (el motivo real detrás de "responde
// tarde y con un JSON incompleto", no un límite que hayamos puesto nosotros).
//
// gemini-3.1-flash-lite usa "minimal" thinking por defecto — Google lo
// recomienda explícitamente para extracción de datos estructurados, que es
// justo lo que hace este módulo. No tocamos ningún parámetro de "thinking":
// simplemente usamos el modelo cuyo comportamiento por defecto ya es el que
// necesitamos.
export const GEMINI_MODEL = "gemini-3.1-flash-lite";

const FLUID_SCHEMA = {
  type: "object",
  properties: {
    nombre: { type: "string" },
    tipo_fluido: { type: "string", enum: ["agua", "aire", "aceite_motor", "etilenglicol", "refrigerante_134a", "amoniaco", "otro"] },
    temp_entrada_C: { type: "number" },
    temp_salida_C: { type: "number" },
    flujo_masico_kg_s: { type: "number" },
    velocidad_m_s: { type: "number" },
    cp_kJ_kgC: { type: "number" },
    cp_estimado: { type: "boolean" },
    cambio_fase: { type: "boolean" },
    hfg_kJ_kg: { type: "number" },
    hfg_estimado: { type: "boolean" },
  },
  required: ["nombre", "cambio_fase"],
  propertyOrdering: [
    "nombre",
    "cambio_fase",
    "tipo_fluido",
    "temp_entrada_C",
    "temp_salida_C",
    "flujo_masico_kg_s",
    "velocidad_m_s",
    "cp_kJ_kgC",
    "cp_estimado",
    "hfg_kJ_kg",
    "hfg_estimado",
  ],
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
    numero_tubos: { type: "integer" },
    fluido_por_tubo: { type: "string", enum: ["caliente", "frio"] },
    diametro_coraza_m: { type: "number" },
    configuracion_lado_externo: { type: "string", enum: ["anulo_tubo_doble", "flujo_cruzado_cilindro"] },
    velocidad_externa_m_s: { type: "number" },
    Q_dado_kW: { type: "number" },
    efectividad_dada: { type: "number" },
    velocidad_maxima_tubo_m_s: { type: "number" },
    fluido_caliente: FLUID_SCHEMA,
    fluido_frio: FLUID_SCHEMA,
    coeficiente_U_W_m2C: { type: "number" },
    hi: { type: "number" },
    ho: { type: "number" },
    factor_incrustacion_i: { type: "number" },
    factor_incrustacion_o: { type: "number" },
    incrustacion_i_espesor_m: { type: "number" },
    incrustacion_i_k_W_mC: { type: "number" },
    incrustacion_o_espesor_m: { type: "number" },
    incrustacion_o_k_W_mC: { type: "number" },
    conductividad_pared_k: { type: "number" },
    diametro_interior: { type: "number" },
    diametro_exterior: { type: "number" },
    area_m2: { type: "number" },
    longitud_m: { type: "number" },
    longitud_por_paso: { type: "boolean" },
    perdida_calor_porcentaje: { type: "number" },
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
  propertyOrdering: [
    "tipo_intercambiador",
    "configuracion_flujo",
    "fluido_caliente",
    "fluido_frio",
    "requiere_correlacion_convectiva",
    "incognita_principal",
    "pasos_coraza",
    "pasos_tubos",
    "numero_tubos",
    "diametro_interior",
    "diametro_exterior",
    "diametro_coraza_m",
    "area_m2",
    "longitud_m",
    "longitud_por_paso",
    "fluido_por_tubo",
    "configuracion_lado_externo",
    "velocidad_externa_m_s",
    "Q_dado_kW",
    "velocidad_maxima_tubo_m_s",
    "coeficiente_U_W_m2C",
    "hi",
    "ho",
    "conductividad_pared_k",
    "factor_incrustacion_i",
    "factor_incrustacion_o",
    "incrustacion_i_espesor_m",
    "incrustacion_i_k_W_mC",
    "incrustacion_o_espesor_m",
    "incrustacion_o_k_W_mC",
    "perdida_calor_porcentaje",
    "notas",
  ],
};

export const EXTRACTION_PROMPT = `Eres un asistente experto en transferencia de calor e intercambiadores de calor (método LMTD y efectividad-NTU, nomenclatura del libro de Cengel). Vas a leer el enunciado de un ejercicio universitario en español y extraer TODOS los datos en el formato JSON solicitado. NO resuelvas el ejercicio, solo extrae y estructura los datos.

REGLAS:
1. Fluido "caliente" = el de mayor temperatura (sin importar el orden en que aparece en el texto). Fluido "frío" = el de menor temperatura.
2. tipo_intercambiador: "tubo_doble" (tubos concéntricos simples), "tubos_coraza" (mencionan coraza/casco y tubos, o "N pasos por la coraza y M pasos por los tubos"), "flujo_cruzado" (radiadores, intercambiadores compactos, mencionan flujo cruzado). Cuando sea "tubos_coraza", captura SIEMPRE pasos_coraza y pasos_tubos como números (ej. "dos pasos por la coraza y 12 pasos por los tubos" → pasos_coraza=2, pasos_tubos=12; si el enunciado no especifica pasos por la coraza asume pasos_coraza=1). ADEMÁS, si el enunciado menciona un NÚMERO DE TUBOS individuales dentro de la coraza (p. ej. "24 tubos", "un haz de 130 tubos"), captúralo por separado en numero_tubos — esto es DISTINTO de pasos_tubos: "pasos_tubos" es cuántas veces el fluido recorre la coraza de ida y vuelta dentro de un mismo circuito (afecta el factor de corrección F / la fórmula de efectividad), mientras que "numero_tubos" es cuántos tubos físicos idénticos están dispuestos en paralelo dentro de la coraza (afecta directamente el área total: As = π·D·L·numero_tubos). Un ejercicio puede dar solo uno de los dos, ambos, o ninguno (tubo doble no tiene ninguno de los dos). Si el enunciado solo dice "N tubos" sin mencionar pasos, asume pasos_tubos=1 (single pass) salvo que se indique lo contrario.
3. configuracion_flujo: "paralelo" (entran por el mismo extremo), "contraflujo" (extremos opuestos — úsala también como base para coraza-tubos), "cruzado_no_mezclado", "cruzado_cmax_mezclado" o "cruzado_cmin_mezclado" (indica cuál fluido va mezclado).
4. cambio_fase=true si el fluido se condensa, hierve, se evapora, o es "vapor/líquido saturado" a temperatura constante. En ese caso temp_entrada_C = temp_salida_C = esa temperatura, y captura hfg_kJ_kg si se menciona.
5. Si cp NO se da numéricamente, ESTIMA un valor típico según el fluido (agua≈4.18, aceite de motor≈1.9-2.2, etilenglicol≈2.4-2.6, glicerina≈2.4, aire≈1.005-1.01, amoniaco≈4.8, alcohol etílico≈2.5-2.7 kJ/kg·°C) y marca cp_estimado=true. Si el enunciado sí da el valor, cp_estimado=false.
5b. Si un fluido cambia de fase (cambio_fase=true) y el enunciado NO da directamente el valor de hfg, DEBES estimarlo tú mismo con tablas de vapor/líquido saturado según la sustancia y la temperatura de saturación (nunca lo dejes vacío si hay suficiente información para estimarlo). Para AGUA/VAPOR DE AGUA, usa estos valores de referencia de hfg (interpola linealmente entre los más cercanos si la temperatura no coincide exactamente): 0°C≈2501, 20°C≈2454, 40°C≈2406, 50°C≈2383, 60°C≈2359, 80°C≈2309, 100°C≈2257, 120°C≈2203, 150°C≈2114, 180°C≈2015, 200°C≈1941, 250°C≈1716 kJ/kg. Para amoniaco, refrigerantes u otras sustancias, usa el valor típico de hfg a esa temperatura según tablas de propiedades estándar. Marca hfg_estimado=true cuando lo hayas estimado así; hfg_estimado=false si el enunciado dio el valor explícitamente (o los datos suficientes para calcularlo sin tabla, p. ej. energía y masa).

6. Convierte SIEMPRE a: temperaturas en °C; flujo másico en kg/s (kg/min÷60, kg/h÷3600, L/min de agua≈÷60 con densidad≈1000 kg/m³); velocidades en m/s (ft/s×0.3048); cp en kJ/kg·°C; U/hi/ho en W/m²·°C; longitudes/diámetros en m (in×0.0254, ft×0.3048); hfg en kJ/kg; incrustación en m²·°C/W.
6b. GEOMETRÍA DEL TUBO — captúrala SIEMPRE que el enunciado la dé, sin importar si requiere_correlacion_convectiva es true o false (el motor necesita el diámetro para relacionar el área superficial As con la longitud del tubo, As=π·D·L·número_tubos, incluso cuando U ya viene dado directamente y no hace falta ninguna correlación de convección): captura diametro_interior y diametro_exterior en metros. Si el tubo es de PARED DELGADA y el enunciado da un solo diámetro (p. ej. "tubo de 2 cm de diámetro", sin distinguir interior/exterior), usa ese mismo valor en AMBOS campos. Si da los dos diámetros por separado, captura cada uno en su campo correspondiente.
7. IMPORTANTE sobre longitud_m: cuando el enunciado dice algo como "la longitud de CADA PASO de los tubos es de X m", pon longitud_m=X y longitud_por_paso=true (el motor de cálculo se encarga de multiplicar por el número de pasos). Cuando el enunciado da la "longitud TOTAL de los tubos" directamente (p. ej. "la longitud total de los tubos en el intercambiador es de 60 m"), pon longitud_m=60 y longitud_por_paso=false. Si el intercambiador es de tubo doble (sin pasos), longitud_por_paso=false (o simplemente omítelo).
8. Si el enunciado menciona que el intercambiador NO está bien aislado y se pierde cierto porcentaje del calor (p. ej. "se pierde 3% del calor liberado por el fluido caliente"), captura ese número en perdida_calor_porcentaje (como 3, no como 0.03). Si no se menciona ninguna pérdida, omite este campo (se asume aislamiento perfecto).
9. Si el enunciado da hi y ho DIRECTAMENTE como números, captúralos y pon requiere_correlacion_convectiva=false. Si en cambio hay que calcular hi u ho mediante correlaciones de convección (Reynolds, Nusselt, Dittus-Boelter, Churchill-Bernstein, etc. — es decir, se dan velocidad/caudal y propiedades pero NO un valor de h), deja hi/ho sin definir y pon requiere_correlacion_convectiva=true. En este caso, para que el motor pueda calcular hi/ho automáticamente, captura TAMBIÉN:
   - tipo_fluido de CADA fluido: uno de "agua", "aire", "aceite_motor", "etilenglicol", "refrigerante_134a", "amoniaco", "otro" (según lo que sea el fluido, no lo dejes vacío si es identificable).
   - Para el fluido del lado del tubo: su gasto másico (flujo_masico_kg_s) O, si el enunciado da directamente su velocidad media dentro del tubo (p. ej. "agua a una velocidad promedio de 4 ft/s"), captúrala en velocidad_m_s (ya convertida a m/s) — no necesitas ambos, el que el enunciado dé.
   - fluido_por_tubo: "caliente" o "frio", indicando cuál de los dos fluidos circula por el tubo interior (el otro va por fuera: coraza/ánulo, o flujo cruzado externo). En intercambiadores de tubo doble/coraza-tubos esto casi siempre se puede inferir del enunciado ("el refrigerante fluye por el tubo", "el agua fluye por el interior de los tubos", etc.).
   - configuracion_lado_externo: indica la geometría del fluido que va POR FUERA del tubo interior. Usa "anulo_tubo_doble" (el caso de siempre: ese fluido fluye confinado en el espacio anular entre el tubo y la coraza/casco — necesita diametro_coraza_m y su gasto másico). Usa "flujo_cruzado_cilindro" cuando el enunciado describe un fluido (típicamente aire) fluyendo PERPENDICULAR y libremente alrededor de un tubo individual, NO confinado en un ánulo (p. ej. "aire que fluye perpendicular al tubo con una velocidad de 12 ft/s") — en ese caso captura la velocidad de ese fluido en velocidad_externa_m_s (ya convertida a m/s) en vez de diametro_coraza_m/gasto másico.
   - diametro_coraza_m: el diámetro interior de la coraza/casco/ánulo (diferente del diámetro del tubo interior), SOLO cuando configuracion_lado_externo="anulo_tubo_doble" y el enunciado lo dé (p. ej. "diámetros del tubo y del casco de 1.0 cm y 2.5 cm").
   - diametro_interior y diametro_exterior del tubo interior como ya se pedía en la regla de geometría (diametro_exterior es el que se usa como diámetro del cilindro en flujo_cruzado_cilindro).
   Nota: el motor solo sabe aplicar esta correlación automática a flujo interno en tubo circular, al ánulo de un tubo doble, y a flujo cruzado externo sobre UN cilindro aislado (no bancos de varios tubos); si el fluido en cuestión cambia de fase (condensa/hierve), su h normalmente se da directamente en el enunciado y no requiere esta correlación.
10. incognita_principal: describe en pocas palabras qué pide encontrar el ejercicio.
11. En "notas" explica brevemente cualquier suposición (unidades convertidas, propiedades estimadas, ambigüedades resueltas).
12. Resistencias adicionales de la pared del tubo:
    - Si el enunciado da la conductividad térmica del MATERIAL del tubo (p. ej. "tubo de cobre, k=386 W/m·°C", "tubo de latón, k=110 W/m·K"), captúrala en conductividad_pared_k. Esto solo aplica al material del tubo mismo, no a un depósito o incrustación.
    - Factor de incrustación (fouling): puede venir en DOS formatos distintos, captura el que corresponda:
      a) Directo, ya como resistencia Rf en h·ft²·°F/Btu o m²·°C/W (conviértelo a m²·°C/W si hace falta) → factor_incrustacion_i (lado interior/tubo) o factor_incrustacion_o (lado exterior/coraza).
      b) Como una CAPA de depósito/incrustación (p. ej. "una capa de 2 mm de espesor de caliza, k=1.3 W/m·°C") de la que das espesor y conductividad por separado, NO un valor Rf ya combinado → captura por separado incrustacion_i_espesor_m + incrustacion_i_k_W_mC (si la capa está en el lado interior/tubo) o incrustacion_o_espesor_m + incrustacion_o_k_W_mC (si está en el lado exterior/coraza). El motor de cálculo hace la división espesor/k automáticamente, no la hagas tú.
    Nunca captures ambos formatos para el mismo lado a la vez; usa el que el enunciado realmente da.
13. Problemas de DISEÑO INVERSO (piden dimensionar algo, no solo evaluar un intercambiador ya definido):
    - Si el enunciado da la razón/carga de transferencia de calor DIRECTAMENTE como un dato (p. ej. "la carga de transferencia de calor del calentador es de 600 kW"), y NO se puede derivar de otra forma más directa (gastos másicos y temperaturas de ambos fluidos), captúrala en Q_dado_kW (convertida a kW si hace falta, p. ej. Btu/h × 0.000293).
    - Si el enunciado da la EFECTIVIDAD del intercambiador DIRECTAMENTE como dato (p. ej. "con una efectividad de 0.65", "la efectividad es 65%"), captúrala en efectividad_dada como decimal entre 0 y 1 (0.65, no 65). Esto es distinto de cuando la efectividad es la INCÓGNITA a calcular — solo llena este campo cuando el enunciado la da como un dato conocido de entrada, no cuando la pide como resultado.
    - Si el enunciado pide encontrar CUÁNTOS TUBOS se necesitan dado un límite de velocidad (p. ej. "si el diámetro interior de los tubos es de 1 cm y la velocidad del agua no debe ser mayor a 3 m/s, determine cuántos tubos es necesario usar"), captura ese límite en velocidad_maxima_tubo_m_s (convertida a m/s) y NO captures numero_tubos (precisamente es la incógnita) — el motor lo calcula a partir del gasto másico del fluido del tubo, su densidad, el diámetro interior y esta velocidad máxima. Asegúrate de capturar también fluido_por_tubo para este caso (cuál de los dos fluidos es el que circula por dentro de los tubos), aun si el enunciado no requiere correlación convectiva.

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

  // Diagnóstico: cuántos tokens se fueron en "pensamiento" interno vs. en el
  // JSON de salida — útil si alguna vez vuelve a tardar mucho o cortarse.
  const usage = json?.usageMetadata;
  const thoughtsTokens = usage?.thoughtsTokenCount ?? 0;
  const outputTokens = usage?.candidatesTokenCount ?? 0;

  if (candidate.finishReason === "MAX_TOKENS") {
    throw new Error(
      `Gemini se quedó sin espacio de tokens antes de terminar el JSON (usó ${thoughtsTokens} tokens de razonamiento interno y ${outputTokens} de salida). Intenta con un enunciado más corto o vuelve a intentarlo.`
    );
  }
  if (candidate.finishReason && candidate.finishReason !== "STOP") {
    throw new Error("Gemini no pudo completar la extracción (motivo: " + candidate.finishReason + ").");
  }

  let text = candidate?.content?.parts?.map((p) => p.text || "").join("") || "";
  // Por si acaso el modelo envuelve el JSON en una valla de código markdown
  // (no debería pasar con responseMimeType=application/json, pero es gratis
  // protegerse contra eso).
  text = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");

  try {
    return JSON.parse(text);
  } catch (e) {
    const preview = text.length > 500 ? text.slice(0, 250) + " […] " + text.slice(-250) : text;
    throw new Error(
      `No se pudo interpretar el JSON devuelto por Gemini (${thoughtsTokens} tokens de razonamiento, ${outputTokens} de salida). Respuesta cruda: ${preview}`
    );
  }
}
