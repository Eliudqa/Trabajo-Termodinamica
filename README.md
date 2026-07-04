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

La clave se configura **solo por código**, no hay ningún campo en la
interfaz para pegarla:

1. Ve a **https://aistudio.google.com/apikey**
2. Inicia sesión con tu cuenta de Google → **"Create API key"**
3. Copia `.env.example` a `.env.local` y pon tu clave ahí:
   ```bash
   cp .env.example .env.local
   # edita .env.local y pon VITE_GEMINI_API_KEY=tu_clave_aquí
   ```
   `.env.local` ya está en `.gitignore`, no se sube a ningún repositorio.
4. Reinicia `npm run dev` si ya lo tenías corriendo (las variables de
   entorno solo se leen al arrancar).

El tier gratuito de Gemini (`gemini-3.5-flash`) no pide tarjeta y alcanza de
sobra para resolver ejercicios uno por uno. Si `VITE_GEMINI_API_KEY` no está
configurada, el botón "Resolver con Gemini" queda deshabilitado y la app te
lo recuerda debajo del botón.

## 4. Correr la app

```bash
npm run dev
```

Abre `http://localhost:5173` en tu navegador. Pega el enunciado y pulsa
**"Resolver con Gemini"**.

## 5. Pruebas automatizadas

```bash
npm test
```

Corre 36 pruebas con `vitest`:
- **`src/engine.test.js`**: valida el motor de cálculo (LMTD, efectividad-NTU,
  factor de corrección F, pérdidas de calor, perfil de temperatura) contra
  los Ejemplos 11-3, 11-4, 11-9, 11-43 y el Problema 11-94 del libro.
- **`src/App.test.jsx`**: monta la app completa de verdad (React Testing
  Library), simula la llamada a Gemini (sin red real) y prueba el flujo de
  extremo a extremo: escribir un enunciado, resolver, ver resultados, editar
  un dato y recalcular sin volver a llamar a la API.

## 6. Estructura del proyecto

```
src/
  engine.js                 motor de cálculo puro (LMTD y efectividad-NTU)
  engine.test.js            pruebas del motor contra ejemplos del libro
  extraction.js             llamada a la API de Gemini + prompt + schema
  theme.css                 tokens de diseño y estilos base
  App.jsx                   orquestador (estado + composición de componentes)
  App.test.jsx              pruebas de extremo a extremo de la interfaz
  main.jsx                  punto de entrada de React
  components/
    Header.jsx               título y marca
    BrandMark.jsx             logo (corte transversal de tubo doble)
    ProblemForm.jsx           cuadro de texto + botón "Resolver"
    DataPanel.jsx             datos detectados, editables
    FluidEditor.jsx           tarjeta de un fluido (caliente o frío)
    NumField.jsx / SelectField.jsx   campos reutilizables
    ResultsPanel.jsx          tarjeta de resultados
    StatCard.jsx              una estadística individual con ícono
    ProfileChart.jsx          gráfica del perfil de temperatura
```

## 7. Qué resuelve (alcance actual)

El motor (`src/engine.js`) no funciona con dos ramas rígidas ("¿tengo las 4
temperaturas? LMTD; si no, NTU"). En vez de eso, combina por propagación
algebraica todas las relaciones del capítulo 11 (balances de energía de cada
fluido, pérdidas de calor, Q=U·As·F·ΔTml y sus tres despejes, back-fill de
gastos másicos) hasta que ya no pueda deducir nada más, y solo recurre al
método NTU si, después de agotar el álgebra, siguen faltando las
temperaturas de salida. Esto cubre, entre otros:

- Tubo doble (flujo paralelo o contraflujo).
- Coraza y tubos multipasos: fórmula exacta de Underwood para 1 paso por la
  coraza; para N pasos por la coraza (2, 3, 4...) usa la fórmula de Kays &
  London que combina N pasos de 1-shell-pass en serie.
- Flujo cruzado (con F≈1 de aproximación — revisa la Fig. 11-18 del libro
  para el valor exacto; queda marcado con una advertencia en pantalla).
- Condensadores y calderas (cambio de fase).
- Pérdidas de calor hacia el ambiente (p. ej. "se pierde el 3% del calor
  liberado por el fluido caliente") — el calor usado en Q=UAsΔTml es el que
  realmente recibe el fluido frío, no el que libera el caliente.
- Casos donde solo se conoce completamente UN fluido (temperaturas, gasto,
  cp) y del otro no se sabe nada — el motor despeja Q y ΔTml directamente de
  Q=UAsΔTml sin necesitar las temperaturas del segundo fluido.
- Cualquier combinación donde falte una sola temperatura, o U, o As, o un
  gasto másico: se despeja algebraicamente en vez de exigir que esté todo.
- El método NTU "puro" cuando de verdad no hay forma de determinar las
  temperaturas de salida por álgebra (requiere U, As, y ambas razones de
  capacidad calorífica).

**Lo que todavía NO hace automáticamente**: calcular h a partir de
correlaciones de convección (Reynolds/Nusselt/Dittus-Boelter) cuando el
enunciado solo da velocidad/caudal y propiedades del fluido, sin dar h
directamente. En esos casos la extracción lo marca (`requiere_correlacion_convectiva`)
y te deja calcular tú ese paso y escribir hᵢ/h₀ (o U) a mano en el panel
"Datos detectados" antes de recalcular.

## 8. Diseño

Paleta "cobre y acero": el tubo interior de un intercambiador de tubo doble
suele ser de cobre (fluido caliente) dentro de una coraza de acero (fluido
frío) — de ahí salen los colores de acento. El logo es un corte transversal
de ese mismo tubo doble (la Figura 11-8 del libro, en miniatura). Todos los
tokens de color/tipografía están centralizados en `src/theme.css`.

## 9. Build de producción (opcional)

```bash
npm run build
npm run preview   # sirve la carpeta dist/ para probarla
```
