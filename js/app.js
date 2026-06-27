const App = (() => {
  // ---- State ----
  let course = null;
  let currentUnit = null;       // full unit meta (with .lessons array)
  let currentLessonId = null;   // lesson id from meta (e.g. 'l01', 'test')
  let currentLesson = null;     // full lesson data (slides + exercises)
  let allSlides = [];
  let slideIndex = 0;
  let currentExercises = [];
  let exerciseIndex = 0;
  let sessionStats = { correct: 0, wrong: 0 };
  let lessonProgressMap = {};
  let streakDays = 0;
  let interactiveAbort = null;  // AbortController for interactive exercise listeners

  // ---- Boot ----

  async function init() {
    UI.show('screen-loading');

    if (!FB.getStoredConfig()) { setupFirebase(); return; }

    const ok = await FB.init();
    if (!ok) { setupFirebase(); return; }

    await showHome();
  }

  function setupFirebase() {
    UI.show('screen-firebase-setup');
    document.getElementById('btn-save-firebase').addEventListener('click', async () => {
      const raw = document.getElementById('firebase-config-input').value.trim();
      let cfg;
      try { cfg = JSON.parse(raw); } catch {
        alert('El JSON no es válido.');
        return;
      }
      FB.saveConfig(cfg);
      UI.show('screen-loading');
      const ok = await FB.init();
      if (!ok) { alert('No se pudo conectar. Revisa la configuración.'); UI.show('screen-firebase-setup'); return; }
      await showHome();
    });
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
      const ex = lessonMap[item.topicId]?.exercises?.find(e => e.id === item.itemId);
      return ex ? [{ ...ex, _itemId: `${item.topicId}_${item.itemId}` }] : [];
    }).sort(() => Math.random() - 0.5);

    if (!exercises.length) return;

    currentUnit = null;
    currentLessonId = 'review';
    currentLesson = { title: 'Repaso SRS' };
    currentExercises = exercises;
    exerciseIndex = 0;
    sessionStats = { correct: 0, wrong: 0 };
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
    currentLessonId = lesson.id;
    const data = await Course.loadLesson(currentUnit.id, lesson.id);
    currentLesson = data;
    const allExercises = data.exercises || [];
    const cap = currentLessonId === 'test' ? allExercises.length : 8;
    currentExercises = allExercises.slice(0, cap);
    exerciseIndex = 0;
    sessionStats = { correct: 0, wrong: 0 };

    // Build slide list: optional grammar note + vocab slides
    allSlides = [];
    if (data.grammar_note) {
      allSlides.push({ type: 'grammar', ...data.grammar_note });
    }
    (data.slides || []).forEach(s => allSlides.push({ type: 'vocab', ...s }));

    slideIndex = 0;
    if (allSlides.length > 0) {
      UI.renderLessonSlide(allSlides[0], 0, allSlides.length, data.title);
      UI.show('screen-lesson');
    } else {
      startSession();
    }
  }

  function nextSlide() {
    slideIndex++;
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

    } else if (exercise.type === 'true_false') {
      answerArea.querySelectorAll('.tf-btn').forEach(btn => {
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
      const isPair = exercise.pairs.some(p => p.eu === euVal && p.es === esVal);

      if (isPair) {
        selectedLeftBtn.classList.remove('selected');
        selectedLeftBtn.classList.add('correct');
        selectedLeftBtn.disabled = true;
        btn.classList.add('correct');
        btn.disabled = true;
        matchedPairs.push({ eu: euVal, es: esVal });
        selectedLeftBtn = null;
        if (matchedPairs.length === totalPairs) {
          handleAnswer(exercise, matchedPairs);
        }
      } else {
        const leftRef = selectedLeftBtn;
        leftRef.classList.remove('selected');
        leftRef.classList.add('wrong-flash');
        btn.classList.add('wrong-flash');
        selectedLeftBtn = null;
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
    else sessionStats.wrong++;

    UI.showFeedback(isCorrect, exercise);

    // SRS tracking — fire-and-forget, works for both lessons and review sessions
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
    // Lesson slides
    document.getElementById('btn-lesson-next').addEventListener('click', nextSlide);
    document.getElementById('btn-lesson-skip').addEventListener('click', startSession);
    document.getElementById('btn-lesson-back').addEventListener('click', () => {
      UI.renderLessonList(currentUnit, lessonProgressMap, onLessonClick);
      UI.show('screen-unit');
    });

    // Session
    document.getElementById('btn-next').addEventListener('click', () => {
      exerciseIndex++;
      renderCurrentExercise();
    });
    document.getElementById('btn-back').addEventListener('click', () => {
      if (confirm('¿Salir de la sesión? Se perderá el progreso.')) {
        UI.renderLessonList(currentUnit, lessonProgressMap, onLessonClick);
        UI.show('screen-unit');
      }
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
