// Ejercicios de ejemplo ya "extraídos", para probar el motor de cálculo y la
// interfaz sin gastar llamadas a la API ni necesitar clave de Gemini todavía.

export const SAMPLES = [
  {
    id: "ex-11-3",
    label: "Ej. 11-3 · Condensador (LMTD)",
    texto: `Se va a condensar vapor de agua de una planta generadora a una temperatura de 30°C, con agua de enfriamiento de un lago cercano, la cual entra en los tubos del condensador a 14°C y sale a 22°C. El área superficial de los tubos es de 45 m² y el coeficiente de transferencia de calor total es de 2100 W/m²·°C. Determine el gasto de masa necesario de agua de enfriamiento y la razón de la condensación del vapor en el condensador.`,
    data: {
      tipo_intercambiador: "tubo_doble",
      configuracion_flujo: "contraflujo",
      fluido_caliente: { nombre: "vapor de agua", temp_entrada_C: 30, temp_salida_C: 30, cambio_fase: true, hfg_kJ_kg: 2431, cp_estimado: false },
      fluido_frio: { nombre: "agua de enfriamiento", temp_entrada_C: 14, temp_salida_C: 22, cp_kJ_kgC: 4.18, cambio_fase: false, cp_estimado: false },
      coeficiente_U_W_m2C: 2100,
      area_m2: 45,
      requiere_correlacion_convectiva: false,
      incognita_principal: "gasto másico del agua de enfriamiento y razón de condensación del vapor",
      notas: "Ejemplo de prueba precargado (Ejemplo 11-3 del libro), no requiere llamar a la API.",
    },
  },
  {
    id: "ex-11-4",
    label: "Ej. 11-4 · Tubo doble a contraflujo (LMTD)",
    texto: `Se va a calentar agua en un intercambiador de tubo doble a contraflujo, desde 20°C hasta 80°C, a razón de 1.2 kg/s. El calentamiento se va a realizar por medio de agua geotérmica de la que se dispone a 160°C con un gasto de masa de 2 kg/s. El tubo interior es de pared delgada y tiene un diámetro de 1.5 cm. Si el coeficiente de transferencia de calor total del intercambiador es de 640 W/m²·°C, determine la longitud requerida de ese intercambiador para lograr el calentamiento deseado.`,
    data: {
      tipo_intercambiador: "tubo_doble",
      configuracion_flujo: "contraflujo",
      fluido_caliente: { nombre: "agua geotérmica", temp_entrada_C: 160, flujo_masico_kg_s: 2, cp_kJ_kgC: 4.31, cambio_fase: false, cp_estimado: false },
      fluido_frio: { nombre: "agua", temp_entrada_C: 20, temp_salida_C: 80, flujo_masico_kg_s: 1.2, cp_kJ_kgC: 4.18, cambio_fase: false, cp_estimado: false },
      coeficiente_U_W_m2C: 640,
      diametro_interior: 0.015,
      requiere_correlacion_convectiva: false,
      incognita_principal: "longitud requerida del intercambiador",
      notas: "Ejemplo de prueba precargado (Ejemplo 11-4 del libro), no requiere llamar a la API.",
    },
  },
  {
    id: "ex-11-9",
    label: "Ej. 11-9 · Coraza y tubos (efectividad-NTU)",
    texto: `Se va a enfriar aceite caliente por medio de agua en un intercambiador de calor de un paso por el casco y 8 pasos por los tubos. Los tubos son de pared delgada y están hechos de cobre con un diámetro interno de 1.4 cm. La longitud de cada paso por los tubos en el intercambiador es de 5 m y el coeficiente de transferencia de calor total es de 310 W/m²·°C. Por los tubos fluye agua a razón de 0.2 kg/s y por el casco el aceite a razón de 0.3 kg/s. El agua y el aceite entran a las temperaturas de 20°C y 150°C, respectivamente. Determine la razón de la transferencia de calor en el intercambiador y las temperaturas de salida del agua y del aceite.`,
    data: {
      tipo_intercambiador: "tubos_coraza",
      configuracion_flujo: "contraflujo",
      pasos_coraza: 1,
      pasos_tubos: 8,
      fluido_caliente: { nombre: "aceite", temp_entrada_C: 150, flujo_masico_kg_s: 0.3, cp_kJ_kgC: 2.13, cambio_fase: false, cp_estimado: false },
      fluido_frio: { nombre: "agua", temp_entrada_C: 20, flujo_masico_kg_s: 0.2, cp_kJ_kgC: 4.18, cambio_fase: false, cp_estimado: false },
      coeficiente_U_W_m2C: 310,
      area_m2: 1.76,
      requiere_correlacion_convectiva: false,
      incognita_principal: "razón de transferencia de calor y temperaturas de salida de ambos fluidos",
      notas: "Ejemplo de prueba precargado (Ejemplo 11-9 del libro), no requiere llamar a la API.",
    },
  },
];
