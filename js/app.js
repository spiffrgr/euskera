const App = (() => {
  // ---- State ----
  let course = null;
  let currentUnit = null;       // full unit meta (with .lessons array)
  let currentLessonId = null;   // lesson id from meta (e.g. 'l01', 'test')
  let currentLesson = null;     // full lesson data (slides + exercises)
  let allSlides = [];
  let slideIndex = 0;
  let slideRevealed = false;
  let currentExercises = [];
  let exerciseIndex = 0;
  let sessionStats = { correct: 0, wrong: 0 };
  let failedExercises = [];
  let isRefuerzoRound = false;
  let lessonProgressMap = {};
  let streakDays = 0;
  let interactiveAbort = null;  // AbortController for interactive exercise listeners

  // ---- Boot ----

  async function init() {
    UI.show('screen-loading');
    setupAuthListeners();

    const loggedIn = await FB.init();
    if (loggedIn) {
      await showHome();
    } else {
      UI.show('screen-auth');
    }
  }

  function setupAuthListeners() {
    document.getElementById('btn-login').addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      const errorEl = document.getElementById('auth-error');
      errorEl.textContent = '';
      try {
        await FB.login(email, password);
        await showHome();
      } catch (e) {
        errorEl.textContent = getAuthError(e.code);
      }
    });

    document.getElementById('btn-register').addEventListener('click', async () => {
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const confirm = document.getElementById('reg-password-confirm').value;
      const errorEl = document.getElementById('reg-error');
      errorEl.textContent = '';
      if (password !== confirm) {
        errorEl.textContent = 'Las contraseñas no coinciden.';
        return;
      }
      try {
        await FB.register(email, password);
        await showHome();
      } catch (e) {
        errorEl.textContent = getAuthError(e.code);
      }
    });

    document.getElementById('link-to-register').addEventListener('click', () => {
      document.getElementById('auth-error').textContent = '';
      UI.show('screen-register');
    });

    document.getElementById('link-to-login').addEventListener('click', () => {
      document.getElementById('reg-error').textContent = '';
      UI.show('screen-auth');
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
      await FB.logout();
      course = null;
      lessonProgressMap = {};
      streakDays = 0;
      UI.show('screen-auth');
    });
  }

  function getAuthError(code) {
    const map = {
      'auth/user-not-found': 'No existe ninguna cuenta con ese email.',
      'auth/wrong-password': 'Contraseña incorrecta.',
      'auth/invalid-email': 'El email no es válido.',
      'auth/email-already-in-use': 'Ya existe una cuenta con ese email.',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
      'auth/too-many-requests': 'Demasiados intentos fallidos. Inténtalo más tarde.',
      'auth/invalid-credential': 'Email o contraseña incorrectos.',
      'auth/network-request-failed': 'Error de red. Comprueba tu conexión.',
    };
    return map[code] || 'Error al iniciar sesión. Inténtalo de nuevo.';
  }

  // ---- Home (unit map) ----

  async function showHome() {
    course = await Course.load();

    const streak = await FB.getStreak();
    streakDays = streak.days;
    UI.setStreak(streakDays);

    // Load metas for available units to know their lesson IDs
    const availableUnits = course.units.filter(u => u.available);
    const metas = await Promise.all(availableUnits.map(u => Course.loadUnit(u.id)));
    const unitMetaMap = Object.fromEntries(metas.map(m => [m.id, m]));

    // Build progress keys from actual lesson data
    const keys = [];
    metas.forEach(meta => meta.lessons.forEach(l => keys.push(`${meta.id}_${l.id}`)));
    const entries = await Promise.all(keys.map(k => FB.getProgress(k).then(p => [k, p])));
    lessonProgressMap = Object.fromEntries(entries);

    UI.renderUnitMap(course, unitMetaMap, lessonProgressMap, onUnitClick);

    const dueItems = await FB.getAllDueSRSItems();
    UI.renderReviewButton(dueItems.length, startReviewSession);

    UI.show('screen-home');
  }

  async function startReviewSession() {
    const dueItems = await FB.getAllDueSRSItems();
    if (!dueItems.length) return;

    const topicIds = [...new Set(dueItems.map(item => item.topicId))];
    const lessonMap = {};
    await Promise.all(topicIds.map(async topicId => {
      const [unitId, lessonId] = topicId.split('_');
      try { lessonMap[topicId] = await Course.loadLesson(unitId, lessonId); } catch {}
    }));

    const exercises = dueItems.flatMap(item => {
      const lesson = lessonMap[item.topicId];
      if (!lesson) return [];
      const pairMatch = item.itemId.match(/^(.+)_p(\d+)$/);
      if (pairMatch) {
        const parentEx = lesson.exercises?.find(e => e.id === pairMatch[1]);
        if (!parentEx || parentEx.type !== 'match_pairs') return [];
        const pair = parentEx.pairs?.[parseInt(pairMatch[2])];
        if (!pair) return [];
        return [{ id: item.itemId, type: 'translation_eu_es', eu: pair.eu, answer: pair.es,
                  _itemId: `${item.topicId}_${item.itemId}` }];
      }
      const ex = lesson.exercises?.find(e => e.id === item.itemId);
      return ex ? [{ ...ex, _itemId: `${item.topicId}_${item.itemId}` }] : [];
    }).sort(() => Math.random() - 0.5).slice(0, 20);

    if (!exercises.length) return;

    currentUnit = null;
    currentLessonId = 'review';
    currentLesson = { title: 'Repaso SRS' };
    currentExercises = exercises;
    exerciseIndex = 0;
    sessionStats = { correct: 0, wrong: 0 };
    failedExercises = [];
    isRefuerzoRound = false;
    allSlides = [];

    UI.setSessionTitle(`Repaso · ${exercises.length} ejercicios`);
    UI.show('screen-session');
    renderCurrentExercise();
  }

  async function onUnitClick(unit) {
    currentUnit = await Course.loadUnit(unit.id);
    UI.renderLessonList(currentUnit, lessonProgressMap, onLessonClick);
    UI.show('screen-unit');
  }

  // ---- Lesson list → Lesson slides ----

  async function onLessonClick(lesson) {
    const dueItems = await FB.getAllDueSRSItems();
    if (dueItems.length >= 5) {
      UI.showSRSPrompt(dueItems.length, startReviewSession, () => openLesson(lesson));
      return;
    }
    openLesson(lesson);
  }

  async function openLesson(lesson) {
    currentLessonId = lesson.id;
    const data = await Course.loadLesson(currentUnit.id, lesson.id);
    currentLesson = data;
    const allExercises = data.exercises || [];
    const isUncapped = currentLessonId === 'test' || currentLessonId === 'repaso';
    const cap = isUncapped ? allExercises.length : (data.exercise_cap || 8);
    currentExercises = allExercises.slice(0, cap);
    exerciseIndex = 0;
    sessionStats = { correct: 0, wrong: 0 };
    failedExercises = [];
    isRefuerzoRound = false;

    // Build slide list: optional grammar note + vocab slides
    allSlides = [];
    if (data.grammar_note) {
      allSlides.push({ type: 'grammar', ...data.grammar_note });
    }
    (data.slides || []).forEach(s => allSlides.push({ type: 'vocab', ...s }));

    slideIndex = 0;
    slideRevealed = false;
    if (allSlides.length > 0) {
      UI.renderLessonSlide(allSlides[0], 0, allSlides.length, data.title);
      UI.show('screen-lesson');
    } else {
      startSession();
    }
  }

  function nextSlide() {
    const slide = allSlides[slideIndex];
    if (slide.type === 'vocab' && !slideRevealed) {
      slideRevealed = true;
      UI.revealSlide();
      return;
    }
    slideIndex++;
    slideRevealed = false;
    if (slideIndex >= allSlides.length) {
      startSession();
    } else {
      UI.renderLessonSlide(allSlides[slideIndex], slideIndex, allSlides.length, currentLesson.title);
    }
  }

  // ---- Session ----

  function startSession() {
    UI.setSessionTitle(currentLesson.title);
    UI.show('screen-session');
    renderCurrentExercise();
  }

  function renderCurrentExercise() {
    if (exerciseIndex >= currentExercises.length) {
      if (!isRefuerzoRound && failedExercises.length > 0) {
        isRefuerzoRound = true;
        currentExercises = [...failedExercises].sort(() => Math.random() - 0.5);
        failedExercises = [];
        exerciseIndex = 0;
        const n = currentExercises.length;
        UI.setSessionTitle(`Refuerzo · ${n} error${n !== 1 ? 'es' : ''}`);
        renderCurrentExercise();
        return;
      }
      endSession();
      return;
    }
    const exercise = currentExercises[exerciseIndex];
    UI.renderExercise(exercise, exerciseIndex, currentExercises.length);
    bindAnswerEvents(exercise);
  }

  function bindAnswerEvents(exercise) {
    // Abort any leftover interactive listeners from previous exercises
    if (interactiveAbort) { interactiveAbort.abort(); interactiveAbort = null; }

    const answerArea = document.getElementById('answer-area');

    if (exercise.type === 'multiple_choice' || exercise.type === 'grammar_select') {
      answerArea.querySelectorAll('.choice-btn').forEach(btn => {
        btn.addEventListener('click', () => handleAnswer(exercise, btn.dataset.value));
      });

    } else if (exercise.type === 'order_words') {
      setupOrderWords(exercise, answerArea);

    } else if (exercise.type === 'match_pairs') {
      setupMatchPairs(exercise, answerArea);

    } else {
      // text input: translation_*, fill_blank
      const submitBtn = answerArea.querySelector('.btn-submit');
      const input = answerArea.querySelector('.answer-input');
      if (submitBtn) {
        submitBtn.addEventListener('click', () => handleAnswer(exercise, input?.value || ''));
      }
      if (input) {
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') answerArea.querySelector('.btn-submit')?.click();
        });
      }
    }
  }

  function setupOrderWords(exercise, answerArea) {
    interactiveAbort = new AbortController();
    const signal = interactiveAbort.signal;

    const bankEl = document.getElementById('order-bank');
    const answerEl = document.getElementById('order-answer');
    const submitBtn = answerArea.querySelector('.btn-submit');
    const totalWords = exercise.words.length;

    function countAnswerWords() {
      return answerEl.querySelectorAll('.word-tile').length;
    }

    function refreshSubmit() {
      submitBtn.disabled = countAnswerWords() !== totalWords;
      answerEl.classList.toggle('has-words', countAnswerWords() > 0);
    }

    bankEl.addEventListener('click', e => {
      const tile = e.target.closest('.word-tile');
      if (!tile) return;
      const word = tile.dataset.word;
      tile.remove();
      const newTile = document.createElement('button');
      newTile.className = 'word-tile';
      newTile.dataset.word = word;
      newTile.textContent = word;
      answerEl.appendChild(newTile);
      refreshSubmit();
    }, { signal });

    answerEl.addEventListener('click', e => {
      const tile = e.target.closest('.word-tile');
      if (!tile) return;
      const word = tile.dataset.word;
      tile.remove();
      const newTile = document.createElement('button');
      newTile.className = 'word-tile';
      newTile.dataset.word = word;
      newTile.textContent = word;
      bankEl.appendChild(newTile);
      refreshSubmit();
    }, { signal });

    submitBtn.addEventListener('click', () => {
      const assembled = [...answerEl.querySelectorAll('.word-tile')].map(t => t.dataset.word).join(' ');
      handleAnswer(exercise, assembled);
    }, { signal });
  }

  function setupMatchPairs(exercise, answerArea) {
    interactiveAbort = new AbortController();
    const signal = interactiveAbort.signal;

    function srsForPair(pairIdx, wasCorrect) {
      const base = exercise._itemId || (currentUnit ? `${currentUnit.id}_${currentLessonId}_${exercise.id}` : null);
      if (!base) return;
      const key = `${base}_p${pairIdx}`;
      FB.getSRSItem(key).then(existing => {
        const kp = key.split('_');
        const item = existing || SRS.defaultItem(`${kp[0]}_${kp[1]}`, kp.slice(2).join('_'));
        FB.setSRSItem(key, SRS.update(item, wasCorrect));
      });
    }

    let selectedLeftBtn = null;
    let matchedPairs = [];
    const totalPairs = exercise.pairs.length;

    answerArea.addEventListener('click', e => {
      const btn = e.target.closest('.match-btn');
      if (!btn || btn.disabled) return;

      if (btn.dataset.side === 'eu') {
        if (selectedLeftBtn) selectedLeftBtn.classList.remove('selected');
        selectedLeftBtn = (selectedLeftBtn === btn) ? null : btn;
        if (selectedLeftBtn) selectedLeftBtn.classList.add('selected');
        return;
      }

      if (!selectedLeftBtn) return;

      const euVal = selectedLeftBtn.dataset.value;
      const esVal = btn.dataset.value;
      const pairIdx = exercise.pairs.findIndex(p => p.eu === euVal && p.es === esVal);
      const isPair = pairIdx !== -1;

      if (isPair) {
        selectedLeftBtn.classList.remove('selected');
        selectedLeftBtn.classList.add('correct');
        selectedLeftBtn.disabled = true;
        btn.classList.add('correct');
        btn.disabled = true;
        matchedPairs.push({ eu: euVal, es: esVal });
        selectedLeftBtn = null;
        srsForPair(pairIdx, true);
        if (matchedPairs.length === totalPairs) {
          handleAnswer(exercise, matchedPairs);
        }
      } else {
        const leftRef = selectedLeftBtn;
        leftRef.classList.remove('selected');
        leftRef.classList.add('wrong-flash');
        btn.classList.add('wrong-flash');
        selectedLeftBtn = null;
        const wrongIdx = exercise.pairs.findIndex(p => p.eu === euVal);
        if (wrongIdx !== -1) srsForPair(wrongIdx, false);
        setTimeout(() => {
          leftRef.classList.remove('wrong-flash');
          btn.classList.remove('wrong-flash');
        }, 600);
      }
    }, { signal });
  }

  function handleAnswer(exercise, userAnswer) {
    const isCorrect = Exercises.checkAnswer(exercise, userAnswer);

    if (isCorrect) sessionStats.correct++;
    else {
      sessionStats.wrong++;
      if (!isRefuerzoRound) failedExercises.push(exercise);
    }

    UI.showFeedback(isCorrect, exercise);

    // SRS tracking — fire-and-forget; match_pairs tracked per-pair in setupMatchPairs
    if (exercise.type !== 'match_pairs') {
      const itemId = exercise._itemId ||
        (currentUnit ? `${currentUnit.id}_${currentLessonId}_${exercise.id}` : null);
      if (itemId) {
        FB.getSRSItem(itemId).then(existing => {
          const parts = itemId.split('_');
          const topicId = `${parts[0]}_${parts[1]}`;
          const item = existing || SRS.defaultItem(topicId, parts[2]);
          FB.setSRSItem(itemId, SRS.update(item, isCorrect));
        });
      }
    }
  }

  async function endSession() {
    const newStreak = await FB.updateStreak();
    streakDays = newStreak;

    // Mark lesson as completed (skip for review sessions)
    if (currentUnit && currentLessonId !== 'review') {
      const key = `${currentUnit.id}_${currentLessonId}`;
      await FB.setProgress(key, { completed: true });
      lessonProgressMap[key] = { completed: true };
    }

    UI.renderSummary(sessionStats.correct, sessionStats.wrong, newStreak, currentLessonId === 'review');
    UI.show('screen-summary');
  }

  // ---- Global event bindings ----

  function bindGlobalEvents() {
    // Compress the exercise layout while the on-screen keyboard is up
    const sessionScreen = document.getElementById('screen-session');
    const answerArea = document.getElementById('answer-area');
    answerArea.addEventListener('focusin', e => {
      if (e.target.classList.contains('answer-input')) sessionScreen.classList.add('kb-open');
    });
    answerArea.addEventListener('focusout', e => {
      if (e.target.classList.contains('answer-input')) sessionScreen.classList.remove('kb-open');
    });

    // Lesson slides
    document.getElementById('btn-lesson-next').addEventListener('click', nextSlide);
    document.getElementById('btn-lesson-skip').addEventListener('click', startSession);
    document.getElementById('btn-lesson-back').addEventListener('click', () => {
      if (!currentUnit) { showHome(); return; }
      UI.renderLessonList(currentUnit, lessonProgressMap, onLessonClick);
      UI.show('screen-unit');
    });

    // Session
    document.getElementById('btn-next').addEventListener('click', () => {
      exerciseIndex++;
      renderCurrentExercise();
    });
    document.getElementById('btn-back').addEventListener('click', () => {
      if (!currentUnit) { showHome(); return; }
      UI.renderLessonList(currentUnit, lessonProgressMap, onLessonClick);
      UI.show('screen-unit');
    });

    // Summary
    document.getElementById('btn-continue-unit').addEventListener('click', () => {
      if (currentUnit) {
        UI.renderLessonList(currentUnit, lessonProgressMap, onLessonClick);
        UI.show('screen-unit');
      } else {
        showHome();
      }
    });
    document.getElementById('btn-home').addEventListener('click', showHome);

    // Unit screen
    document.getElementById('btn-unit-back').addEventListener('click', showHome);
  }

  return {
    start() {
      bindGlobalEvents();
      init();
    }
  };
})();

document.addEventListener('DOMContentLoaded', () => App.start());
