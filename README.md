# Resolvedor de Intercambiadores de Calor

App web (React + Vite) para resolver ejercicios de intercambiadores de calor
(método LMTD y efectividad-NTU, siguiendo el capítulo 11 de Cengel):
pegas el enunciado, **Gemini** extrae los datos automáticamente, y un motor
de cálculo propio (matemática pura, sin IA) resuelve el ejercicio y grafica
el perfil de temperatura a lo largo del intercambiador.

## 1. Requisitos

- [Node.js](https://nodejs.org) 18 o superior (trae `npm`).

## 2. Instalación

```bash
npm install
```

## 3. Clave de API de Gemini (gratis, sin tarjeta)

1. Ve a **https://aistudio.google.com/apikey**
2. Inicia sesión con tu cuenta de Google → **"Create API key"**
3. Tienes dos formas de usarla (elige una):
   - **Rápida**: pégala directamente en la app cuando la abras (se guarda en
     el `localStorage` de tu navegador, no necesitas repetirla).
   - **Recomendada para uso diario**: copia `.env.example` a `.env.local` y
     pon tu clave ahí:
     ```bash
     cp .env.example .env.local
     # edita .env.local y pon VITE_GEMINI_API_KEY=tu_clave_aquí
     ```
     `.env.local` ya está en `.gitignore`, no se sube a ningún repositorio.

El tier gratuito de Gemini (`gemini-3.5-flash`) no pide tarjeta y alcanza de
sobra para resolver ejercicios uno por uno.

## 4. Correr la app

```bash
npm run dev
```

Abre `http://localhost:5173` en tu navegador.

## 5. Probar que resuelve bien (sin gastar llamadas a la API)

En la sección "Paso 1 · Enunciado" hay tres botones ("Ej. 11-3", "Ej. 11-4",
"Ej. 11-9") que cargan ejercicios **ya extraídos**, tomados directamente del
libro, para que veas el motor de cálculo + la gráfica funcionando al
instante, sin necesitar clave de API ni conexión. Los tres ejemplos están
validados contra la solución impresa en el libro.

Cuando quieras probar la extracción real con IA: pega cualquier enunciado en
el cuadro de texto y pulsa **"Resolver con Gemini"**.

## 6. Pruebas automatizadas

```bash
npm test
```

Corre 25 pruebas con `vitest`:
- **`src/engine.test.js`**: valida el motor de cálculo (LMTD, efectividad-NTU,
  factor de corrección F, perfil de temperatura) contra los Ejemplos 11-3,
  11-4 y 11-9 del libro.
- **`src/App.test.jsx`**: monta la app completa de verdad (React Testing
  Library) y prueba el flujo de extremo a extremo — cargar ejemplo, ver
  resultados, editar un dato y recalcular — sin tocar la red.

## 7. Estructura del proyecto

```
src/
  engine.js         motor de cálculo puro (LMTD y efectividad-NTU)
  engine.test.js     pruebas del motor contra ejemplos del libro
  extraction.js      llamada a la API de Gemini + prompt + schema de extracción
  sampleData.js       3 ejercicios de ejemplo ya "extraídos" para pruebas sin red
  App.jsx             interfaz completa (React)
  App.test.jsx         pruebas de extremo a extremo de la interfaz
  main.jsx             punto de entrada de React
```

## 8. Qué resuelve (alcance actual)

- Tubo doble (flujo paralelo o contraflujo).
- Coraza y tubos de 1 paso por la coraza (con factor de corrección F exacto,
  fórmula de Underwood).
- Coraza y tubos multipasos / flujo cruzado: se resuelve pero con F≈1 como
  aproximación (revisa la Figura 11-18 del libro para el valor exacto en
  esos casos — queda marcado con una advertencia en pantalla).
- Condensadores y calderas (cambio de fase).
- Casos donde falta una temperatura de salida y hay que hallarla por balance
  de energía antes de aplicar LMTD.
- Casos donde ni siquiera el balance de energía alcanza (verdadero método
  NTU): requiere U (o hᵢ y h₀) y el área superficial conocidos.

**Lo que todavía NO hace automáticamente**: calcular h a partir de
correlaciones de convección (Reynolds/Nusselt/Dittus-Boelter) cuando el
enunciado solo da velocidad/caudal y propiedades del fluido, sin dar h
directamente. En esos casos la extracción lo marca (`requiere_correlacion_convectiva`)
y te deja calcular tú ese paso y escribir hᵢ/h₀ (o U) a mano en el panel
"Datos detectados" antes de recalcular.

## 9. Build de producción (opcional)

```bash
npm run build
npm run preview   # sirve la carpeta dist/ para probarla
```
