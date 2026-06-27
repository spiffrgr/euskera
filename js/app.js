const App = (() => {
  let topics = [];
  let progressMap = {};
  let currentSession = [];
  let currentIndex = 0;
  let sessionCorrect = 0;
  let sessionWrong = 0;
  let currentTopic = null;
  let srsMap = {};

  async function init() {
    UI.show('screen-loading');

    const hasConfig = !!FB.getStoredConfig();
    if (!hasConfig) {
      setupFirebaseScreen();
      return;
    }

    const ok = await FB.init();
    if (!ok) {
      setupFirebaseScreen();
      return;
    }

    await loadHome();
  }

  function setupFirebaseScreen() {
    UI.show('screen-firebase-setup');

    document.getElementById('btn-save-firebase').addEventListener('click', async () => {
      const raw = document.getElementById('firebase-config-input').value.trim();
      let cfg;
      try {
        cfg = JSON.parse(raw);
      } catch {
        alert('El JSON no es válido. Comprueba que has copiado la configuración completa.');
        return;
      }
      FB.saveConfig(cfg);
      UI.show('screen-loading');
      const ok = await FB.init();
      if (!ok) {
        alert('No se pudo conectar a Firebase. Revisa la configuración.');
        UI.show('screen-firebase-setup');
        return;
      }
      await loadHome();
    });
  }

  async function loadHome() {
    topics = await Exercises.loadTopics();

    const allProgress = await Promise.all(
      topics.map(t => FB.getProgress(t.id).then(p => [t.id, p]))
    );
    progressMap = Object.fromEntries(allProgress);

    applyUnlockLogic();

    const streak = await FB.getStreak();
    UI.setStreak(streak.days);

    UI.renderTopics(topics, progressMap, onTopicClick);
    UI.show('screen-home');
  }

  function applyUnlockLogic() {
    topics[0].unlocked = true;
    for (let i = 1; i < topics.length; i++) {
      const prev = topics[i - 1];
      const prevProg = progressMap[prev.id] || { completed: 0, total: 31 };
      const prevDone = prevProg.completed >= Math.min(8, prevProg.total || 8);
      topics[i].unlocked = prevDone;
    }
  }

  let lessonSlides = [];
  let lessonIndex = 0;

  async function onTopicClick(topic) {
    if (!topic.unlocked) return;
    currentTopic = topic;

    srsMap = await FB.getAllSRSForTopic(topic.id);
    currentSession = await Exercises.buildSession(topic.id, srsMap, 8);
    currentIndex = 0;
    sessionCorrect = 0;
    sessionWrong = 0;

    await startLesson();
  }

  async function startLesson() {
    const allItems = await Exercises.loadTopic(currentTopic.id);
    const sorted = SRS.sortByPriority(allItems, srsMap);
    lessonSlides = sorted.slice(0, 3);
    lessonIndex = 0;

    UI.renderLessonSlide(lessonSlides[0], 0, lessonSlides.length, currentTopic.title);
    UI.show('screen-lesson');
  }

  function renderCurrentExercise() {
    if (currentIndex >= currentSession.length) {
      endSession();
      return;
    }
    const exercise = currentSession[currentIndex];
    UI.renderExercise(exercise, currentIndex, currentSession.length);
    bindAnswerEvents(exercise);
  }

  function bindAnswerEvents(exercise) {
    const answerArea = document.getElementById('answer-area');

    if (exercise.inputMode === 'choice') {
      answerArea.querySelectorAll('.choice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          handleAnswer(exercise, btn.dataset.value);
        });
      });
    } else {
      const submitBtn = answerArea.querySelector('.btn-submit');
      const input = answerArea.querySelector('.answer-input');
      if (submitBtn) {
        submitBtn.addEventListener('click', () => {
          const val = input ? input.value : '';
          handleAnswer(exercise, val);
        });
      }
    }
  }

  async function handleAnswer(exercise, userAnswer) {
    const isCorrect = Exercises.checkAnswer(exercise, userAnswer);

    if (isCorrect) sessionCorrect++;
    else sessionWrong++;

    UI.showFeedback(isCorrect, exercise);

    const itemId = `${currentTopic.id}_${exercise.itemId}`;
    const existing = srsMap[itemId] || SRS.defaultItem(currentTopic.id, exercise.itemId);
    const updated = SRS.update(existing, isCorrect);
    srsMap[itemId] = updated;
    FB.setSRSItem(itemId, updated);
  }

  async function endSession() {
    const newStreak = await FB.updateStreak();

    const topicItems = await Exercises.loadTopic(currentTopic.id);
    await FB.setProgress(currentTopic.id, {
      completed: Math.min(topicItems.length, (progressMap[currentTopic.id]?.completed || 0) + sessionCorrect),
      total: topicItems.length,
    });

    UI.renderSummary(sessionCorrect, sessionWrong, newStreak);
    UI.show('screen-summary');
  }

  function startSession() {
    UI.setSessionTitle(currentTopic.title);
    UI.show('screen-session');
    renderCurrentExercise();
  }

  function bindGlobalEvents() {
    // lesson navigation
    document.getElementById('btn-lesson-next').addEventListener('click', () => {
      lessonIndex++;
      if (lessonIndex >= lessonSlides.length) {
        startSession();
      } else {
        UI.renderLessonSlide(lessonSlides[lessonIndex], lessonIndex, lessonSlides.length, currentTopic.title);
      }
    });

    document.getElementById('btn-lesson-skip').addEventListener('click', () => {
      startSession();
    });

    document.getElementById('btn-lesson-back').addEventListener('click', () => {
      loadHome();
    });

    // session navigation
    document.getElementById('btn-next').addEventListener('click', () => {
      currentIndex++;
      renderCurrentExercise();
    });

    document.getElementById('btn-back').addEventListener('click', () => {
      if (confirm('¿Salir de la sesión? Se perderá el progreso de esta sesión.')) {
        UI.show('screen-home');
      }
    });

    document.getElementById('btn-home').addEventListener('click', async () => {
      await loadHome();
    });
  }

  return {
    start() {
      bindGlobalEvents();
      init();
    }
  };
})();

document.addEventListener('DOMContentLoaded', () => App.start());
