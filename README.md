# 🏔️ Euskera Ikasi

**PWA para aprender euskera desde cero**, dirigida a castellanohablantes del País Vasco que quieren iniciarse en el idioma. Sigue un currículo A1.1 completo con repetición espaciada, sin necesidad de instalar nada.

🌐 **[euskera-ikasi.github.io](https://spiffrgr.github.io/euskera)** · Funciona offline · Instálala como app en tu móvil

---

## 🎯 Propósito Educativo

El objetivo es llevar al usuario de cero a un nivel A1 consolidado en euskera, con énfasis en los rasgos que más dificultan el aprendizaje a castellanohablantes:

- **El caso ergativo** (NOR vs. NORK): *ni naiz* ≠ *nik ikusi dut* — el hecho más diferenciador del euskera
- **La morfología verbal** (IZAN, EGON, JOAN, ETORRI) con sus formas de presente, pasado y futuro
- **Oraciones subordinadas** con sufijos causales (-lako), temporales (-nean) y de finalidad (-tzeko)
- **Vocabulario contextualizado**: nunca palabra suelta, siempre en una frase de ejemplo real

La filosofía es **grammar-first**: cada lección empieza explicando la gramática, luego presenta el vocabulario con ejemplos, y solo entonces pide al usuario que produzca respuestas. El error es parte del aprendizaje — el feedback siempre muestra la respuesta correcta y una explicación cuando es necesario.

---

## 🔧 Stack Técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | Vanilla JS ES6+ · HTML5 · CSS3 con variables |
| Base de datos | Firebase Firestore (SDK v9 compat) |
| Autenticación | Firebase Email/Password Auth |
| Persistencia offline | Service Worker (cache-first, estrategia estática) |
| Instalabilidad | Web App Manifest (PWA) |
| Despliegue | GitHub Pages (ficheros estáticos, sin servidor) |
| Build | **Ninguno** — no hay npm, no hay bundler |

> La ausencia de framework y build step es intencional: la app tiene que funcionar como ficheros estáticos servidos directamente desde GitHub Pages, instalable como PWA sin intermediarios.

---

## 📁 Estructura del Proyecto

```
euskera/
├── index.html              # SPA con todas las pantallas en el DOM
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (cache-first, versión actual: v18)
│
├── css/
│   └── style.css           # Estilos completos con CSS custom properties
│
├── js/
│   ├── app.js              # Orquestador: estado, navegación, flujo de sesión
│   ├── ui.js               # Renderizado de todas las pantallas y ejercicios
│   ├── exercises.js        # Lógica de corrección (normalize + Levenshtein)
│   ├── srs.js              # Algoritmo SM-2 lite (spaced repetition)
│   ├── course.js           # Carga y caché de ficheros JSON
│   └── firebase.js         # Capa de datos: Firestore, Auth, progreso, SRS, racha
│
├── data/
│   ├── course_a1.json      # Definición del curso A1.1 (19 unidades)
│   └── units/
│       ├── u01/
│       │   ├── meta.json   # Índice de lecciones de la unidad
│       │   ├── l01.json    # Lección (grammar_note + slides + exercises)
│       │   ├── ...
│       │   ├── l07.json
│       │   └── test.json   # Test de la unidad (12 ejercicios, sin cap)
│       ├── u03/
│       │   └── repaso.json # Repaso acumulativo u01-u03 (16 ejercicios)
│       ├── u06/ · u09/ · u12/ · u15/ · u18/  # Ídem con su repaso.json
│       └── u04/ – u19/    # Resto de unidades
│
└── icons/
    ├── icon-192.svg
    └── icon-512.svg
```

---

## 🏗️ Arquitectura

### Patrón de módulos

Todos los módulos JavaScript usan el patrón **IIFE + objeto público**, sin módulos ES (`import/export`) para mantener compatibilidad con servicio de ficheros estáticos sin servidor:

```
App ──────── UI          (renderiza DOM a partir de datos)
     ──────── Exercises  (corrige respuestas, sin estado)
     ──────── SRS        (calcula intervalos, sin estado)
     ──────── Course     (fetch + caché en memoria)
     ──────── FB         (Firestore, Email/Password Auth)
```

### Máquina de estados de pantallas

```
loading ──▶ auth (sin sesión) ──▶ register
        │        └────────────────────┘
        │              login exitoso
        ▼
        home ──▶ unit ──▶ lesson (slides) ──▶ session (ejercicios) ──▶ summary
                                                      ▲
               home ──▶ [review button] ──────────────┘
```

La navegación es puramente mediante `show(screenId)` — se activa/desactiva la clase `active` en el div correspondiente. No hay router.

### Flujo de una sesión de ejercicios

1. `onLessonClick` carga el JSON de la lección, aplica el **cap** (máx. 8 para lecciones normales, sin límite para `test` y `repaso`) y construye la lista de slides
2. Se muestran los slides (nota gramatical → vocabulario)
3. `renderCurrentExercise` → `UI.renderExercise` → `bindAnswerEvents`
4. El usuario responde → `handleAnswer` → `Exercises.checkAnswer` → `UI.showFeedback`
5. Simultáneamente, fire-and-forget: `FB.getSRSItem` → `SRS.update` → `FB.setSRSItem`
6. Al terminar todos los ejercicios → `endSession` → `FB.updateStreak` → `FB.setProgress` → pantalla `summary`

### Schema de Firestore

```
users/{uid}/
  progress/{unitId_lessonId}           → { completed: true }
  srs/{unitId_lessonId_exerciseId}     → { topicId, itemId, interval, ease,
                                           nextReview, correct, wrong,
                                           streak, learning, mastered }
  streak/current                       → { days: number, lastDate: "YYYY-MM-DD" }
```

---

## 🎮 Metodología Didáctica

### Estructura de cada lección

```
[Nota gramatical] → [Slides de vocabulario] → [8 ejercicios]
```

Cada lección en `l0X.json` tiene:
- `grammar_note`: título, cuerpo con **negrita** Markdown, tip destacado
- `slides`: pares eu/es con `example_eu` y `example_es` (frases reales, no traducciones literales)
- `exercises`: máximo 8, variados en tipo

### Los 9 tipos de ejercicio

| Tipo | Qué practica | Tolerancia de respuesta |
|------|-------------|------------------------|
| `multiple_choice` | Reconocimiento de vocabulario | Exacta (botón, opciones barajadas) |
| `grammar_select` | Elección de forma gramatical correcta | Exacta (botón, opciones barajadas) |
| `translation_eu_es` | Comprensión euskera→castellano | Normalize + Levenshtein + equivalencia numérica |
| `translation_es_eu` | Producción castellano→euskera | Normalize + Levenshtein |
| `fill_blank` | Producción en contexto | Normalize + Levenshtein |
| `error_correction` | Detectar y corregir error morfológico | Normalize + Levenshtein |
| `true_false` | Contraste gramatical (no vocabulario trivial) | Exacta (botón) |
| `order_words` | Orden sintáctico del euskera | Normalize + Levenshtein |
| `match_pairs` | Vocabulario por pares | Todos los pares correctos |

**Tolerancia de respuesta en texto** (`exercises.js`):
1. Se normalizan ambas cadenas: minúsculas, sin diacríticos (NFD), sin puntuación, colapso de espacios
2. Si la longitud ≥ 5 caracteres y la distancia de Levenshtein es ≤ 1, se acepta como correcta
3. Si ninguna coincide pero ambas cadenas representan el mismo número (dígitos o palabra en español, p. ej. "7" y "siete"), también se acepta

Esto permite erratas de un carácter sin penalizar al usuario, pero no "regala" respuestas cortas.

**Múltiples respuestas válidas**: el campo `answer` de un ejercicio puede ser un string o un array de strings aceptados (p. ej. `["¡Gracias!", "¡Muchas gracias!"]`). `checkAnswer` acepta cualquiera de ellas; `multiple_choice`/`grammar_select` resaltan como correctas todas las opciones presentes en el array al fallar.

**Sinónimos de traducción**: `SYNONYM_GROUPS` en `exercises.js` define frases en castellano intercambiables para la misma expresión en euskera (p. ej. `["gracias", "muchas gracias"]` para "Eskerrik asko"). Se comprueba sustituyendo una variante por otra dentro de la respuesta correcta, así que también funciona si la frase está incrustada en una oración más larga. Esto evita que la misma traducción correcta falle según qué ejercicio (o qué pareja de un `match_pairs` reconvertida en tarjeta de repaso) se la pida.

**Opciones barajadas**: `multiple_choice` y `grammar_select` barajan `exercise.options` en cada render (igual que `order_words` y el lado castellano de `match_pairs`) para que la respuesta correcta no caiga siempre en la misma posición.

### Calidad de los true/false

Los `true_false` testean contraste gramatical, nunca vocabulario trivial. Formato canónico:
- `eu`: frase completa con el fenómeno gramatical en contexto
- `es`: explicación del contraste o frase equivalente
- `explanation`: por qué es verdadero o falso, qué regla aplica

❌ Mal: `"eu": "Komuna = el baño"` — un niño de 5 años lo adivina  
✅ Bien: `"eu": "Nik nago = Yo estoy (con EGON)"` — testea qué verbo usar con el ergativo

### Spaced Repetition (SRS)

Implementación SM-2 simplificada en `srs.js`:

| Evento | Intervalo siguiente | Ease factor |
|--------|--------------------|-|
| Acierto (intervalo 0) | 1 día | +0.1 |
| Acierto (intervalo 1) | 6 días | +0.1 |
| Acierto (intervalo n) | n × ease días | +0.1 |
| Fallo (cualquiera) | 1 día | −0.2 |

- Ease inicial: **2.5** · Ease mínimo: **1.3**
- Cada ejercicio respondido crea/actualiza un ítem SRS en Firestore
- El botón "Repasar" en el home aparece cuando hay ítems con `nextReview ≤ Date.now()`
- Las sesiones de revisión cargan los ejercicios originales desde los JSON de lección y los mezclan aleatoriamente

**Retiro explícito ("mastered")**: tras 5 aciertos consecutivos (`streak >= MASTERY_STREAK` en `srs.js`), el ítem se marca `mastered: true` y su `nextReview` se fija ~100 años en el futuro, con lo que la consulta `where('nextReview', '<=', Date.now())` deja de devolverlo de forma indefinida — ya no reaparece en el repaso. Si el alumno lo falla más adelante (en cualquier ejercicio, incluido un test o repaso de unidad), `mastered` vuelve a `false` y el intervalo se reinicia a 1 día, reingresando al repaso normal.

### Progresión del curso

```
Unidades 1-3  ──▶  Repaso acumulativo u01-u03
Unidades 4-6  ──▶  Repaso acumulativo u04-u06
Unidades 7-9  ──▶  Repaso acumulativo u07-u09
Unidades 10-12 ──▶ Repaso acumulativo u10-u12
```

Los tests (12 ejercicios) cubren todas las lecciones de su unidad de forma equilibrada: al menos 1-2 ejercicios por lección, siempre con `grammar_select` que contraste los dos puntos gramaticales principales.

---

## ✨ Características Implementadas

- **19 unidades A1.1 completas**: 7 lecciones + test + repaso (donde aplica) por unidad
- **~100 lecciones** con grammar notes, slides de vocabulario y ejercicios
- **9 tipos de ejercicio** con variedad pedagógica real
- **SRS funcional**: cada respuesta actualiza el intervalo; sesiones de revisión desde el home
- **Racha diaria** (🔥 streak): se actualiza al completar cualquier lección o repaso
- **Progreso persistido**: cada lección completada queda marcada en Firestore
- **PWA instalable**: funciona offline, se puede instalar en iOS y Android como app nativa
- **Autenticación email/contraseña**: registro e inicio de sesión con Firebase Auth — el progreso se sincroniza entre todos los dispositivos del usuario
- **Tolerancia de erratas** en respuestas escritas (Levenshtein ≤ 1)
- **Feedback contextual**: respuesta correcta siempre visible, explicación gramatical en ejercicios complejos
- **Cap de ejercicios**: 8 por lección ordinaria para no saturar; tests y repasos sin límite
- **Caché en memoria**: los JSON de lección no se vuelven a fetchar dentro de la misma sesión de navegador

---

## 🚀 Roadmap

### A2 — Siguiente nivel de contenido
Ampliar el curso con 12 nuevas unidades de nivel A2. El formato de datos es idéntico al A1 — solo hay que crear los JSON. `course_a1.json` pasaría a tener un nivel A2 con `available: false` hasta que esté listo.

### Audio / Pronunciación
Añadir un campo `audio` en los slides para reproducir la pronunciación de cada palabra y frase de ejemplo. El euskera tiene fonética muy regular, por lo que podría generarse con TTS (Web Speech API o servicio externo) sin grabaciones humanas.

### Estadísticas detalladas
Pantalla de progreso con: racha histórica, porcentaje de acierto por unidad, palabras en intervalo SRS (aprendidas / en repaso / pendientes), errores más frecuentes.

---

## 💡 Decisiones Técnicas

### Vanilla JS sin framework ni build step
La app está pensada para vivir en GitHub Pages como ficheros estáticos. Introducir React/Vue/Svelte requeriría npm, un proceso de build y despliegue más complejo. Con vanilla JS y el patrón IIFE se consigue separación de responsabilidades sin ninguna dependencia — la app entera son ~6 ficheros JS.

### Firebase Email/Password
El usuario se registra con email y contraseña una sola vez. El UID de Firebase queda vinculado a esa cuenta — el mismo progreso es accesible desde cualquier dispositivo donde inicie sesión. La API key de Firebase se embebe en el código frontend (práctica estándar y segura — la seguridad viene de las Firestore Rules, no de mantener la key secreta).

### Datos en JSON estático
Todo el contenido está en ficheros JSON versionados en git. Esto facilita la edición del currículo (es solo contenido, no código), permite revisiones fáciles en PRs y hace la app completamente funcional offline una vez cacheada.

### SM-2 simplificado vs. SM-2 completo
El algoritmo original SM-2 distingue entre "grado 0-5" de calidad de respuesta. Aquí se simplifica a binario (correcto/incorrecto) porque los tipos de ejercicio no admiten gradación — o está bien o está mal. El efecto práctico es casi idéntico para vocabulario y morfología.

### Cap de 8 ejercicios por lección
8 es el número que permite completar una lección en ~5 minutos en móvil. Más ejercicios aumentan la fatiga sin mejorar la retención (el SRS ya se encarga de que los ítems débiles vuelvan). Los tests y repasos no tienen cap porque son sesiones de evaluación explícita.

### `error_correction` como 9º tipo
Tipear la forma correcta de una frase errónea activa un tipo de procesamiento diferente al de múltiple opción: el usuario tiene que producir la forma, no reconocerla. Se usa específicamente para el caso ergativo porque es el error más frecuente y más difícil de automatizar con `grammar_select`.

---

## ⚙️ Setup (Desarrollo Local)

La app no tiene dependencias de Node. Solo necesitas un servidor HTTP local para evitar errores CORS al cargar los JSON:

```bash
# Con Python
python -m http.server 8080

# Con Node (si lo tienes)
npx serve .
```

Luego abre `http://localhost:8080` en el navegador.

**Para guardar progreso y sincronizar entre dispositivos** necesitas una instancia de Firebase:
1. Crea un proyecto en [console.firebase.google.com](https://console.firebase.google.com)
2. Activa Firestore y Authentication (método: Email/Contraseña)
3. Copia la configuración del proyecto web en `js/firebase.js` (objeto `CONFIG`)
4. Al abrir la app aparecerá la pantalla de registro/login — el progreso queda vinculado a la cuenta y es accesible desde cualquier dispositivo

---

## 📊 Contenido del Curso A1.1 (19 unidades)

| Unidad | Tema | Contenido gramatical clave |
|--------|------|---------------------------|
| U01 👋 | Kaixo! (Saludos) | Presentaciones, NAIZ, saludos formales/informales |
| U02 🔢 | Zenbakiak (Números) | 1-100, DITUT para posesión, años y edades |
| U03 🙋 | Nor naiz ni? (Identidad) | Profesiones, origen, NOR + DA/NAIZ · *Repaso u01-u03* |
| U04 🎨 | Koloreak (Colores) | Adjetivo pospuesto, artículo -a/-ak |
| U05 👨‍👩‍👧‍👦 | Familia | Vocabulario de familia, DITUT, género en parentesco |
| U06 🍎 | Janaria (Comida) | Artículo determinado/indefinido, NAHI DUT vs. hábito · *Repaso u04-u06* |
| U07 ⚡ | Aditzak I (IZAN) | IZAN presente, **caso NOR vs. NORK** |
| U08 🚶 | Aditzak II | EGON, JOAN, ETORRI, casos locativos (-n, -ra, -tik) |
| U09 📅 | Denbora (Tiempo) | Días, horas, rutina, presente habitual (-tzen) · *Repaso u07-u09* |
| U10 🏠 | Etxea (Casa) | Objetos, muebles, locativos de posición |
| U11 ❓ | Galderak (Preguntas) | NOR, ZER, NON, NOIZ, NOLA |
| U12 🏥 | Gorputza (Cuerpo) | Partes del cuerpo, MIN DUT, salud básica · *Repaso u10-u12* |
| U13 🏙️ | Hiria (Ciudad) | Lugares, direcciones, transporte |
| U14 ☀️ | Eguraldia (Tiempo meteo) | El tiempo atmosférico, estaciones |
| U15 🎭 | Aisia eta kirolak (Ocio) | Deportes, aficiones · *Repaso u13-u15* |
| U16 🤝 | EDUN eta EGIN | Verbos transitivos, tener y hacer |
| U17 🚌 | Mugimendua eta bidaia | Transporte, viajes, billetes |
| U18 🔮 | Etorkizuna (Futuro) | Planes, futuro · *Repaso final A1.1 u16-u18* |
| U19 🔗 | Atzizkiak (Sufijos) | -rekin (sociativo), -ko (genitivo locativo), -rik (partitivo) |
