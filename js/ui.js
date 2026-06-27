const UI = (() => {
  function show(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(screenId);
    if (el) {
      el.classList.add('active');
      window.scrollTo(0, 0);
    }
  }

  function setStreak(days) {
    const el = document.getElementById('streak-count');
    if (el) el.textContent = days;
  }

  // ---- Unit map (home) ----

  function renderUnitMap(course, unitMetaMap, lessonProgressMap, onUnitClick) {
    const container = document.getElementById('unit-map');
    container.innerHTML = '';

    course.units.forEach(unit => {
      const meta = unitMetaMap[unit.id];
      const lessons = meta ? meta.lessons : [];
      const total = lessons.length;
      const completed = lessons.filter(l => lessonProgressMap[`${unit.id}_${l.id}`]?.completed).length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      const isLocked = !unit.available;
      const isDone = total > 0 && completed === total;

      const card = document.createElement('div');
      card.className = 'topic-card' + (isLocked ? ' locked' : '') + (isDone ? ' done' : '');
      card.innerHTML = `
        <span class="topic-emoji">${unit.emoji}</span>
        <div class="topic-info">
          <div class="topic-name">${escHtml(unit.title)}</div>
          <div class="topic-desc">${isLocked ? 'Próximamente' : `${completed}/${total} lecciones`}</div>
        </div>
        <div class="topic-progress">
          <div class="topic-progress-pct">${isDone ? '✓' : pct + '%'}</div>
          <div class="topic-progress-bar"><div class="topic-progress-fill" style="width:${pct}%"></div></div>
        </div>
        ${isLocked ? '<span class="topic-lock">🔒</span>' : ''}
      `;

      if (!isLocked) {
        card.addEventListener('click', () => onUnitClick(unit));
      }
      container.appendChild(card);
    });
  }

  // ---- Lesson list (unit screen) ----

  function renderLessonList(unit, lessonProgressMap, onLessonClick) {
    document.getElementById('unit-screen-title').textContent = unit.title;
    document.getElementById('unit-screen-emoji').textContent = unit.emoji;

    const container = document.getElementById('lesson-list-container');
    container.innerHTML = '';

    unit.lessons.forEach((lesson, idx) => {
      const key = `${unit.id}_${lesson.id}`;
      const isDone = lessonProgressMap[key]?.completed === true;
      const isTest = lesson.type === 'test';

      const item = document.createElement('div');
      item.className = 'lesson-item' + (isDone ? ' completed' : '') + (isTest ? ' test-item' : '');

      const numContent = isTest ? '📝' : String(idx + 1);

      item.innerHTML = `
        <div class="lesson-num">${numContent}</div>
        <div class="lesson-item-info">
          <div class="lesson-item-title">${escHtml(lesson.title)}</div>
          <div class="lesson-item-type">${isTest ? 'Test de la unidad' : 'Lección'}</div>
        </div>
        <div class="lesson-check">${isDone ? '✓' : ''}</div>
      `;

      item.addEventListener('click', () => onLessonClick(lesson));
      container.appendChild(item);
    });
  }

  // ---- Lesson slides ----

  function renderLessonSlide(slide, index, total, lessonTitle) {
    document.getElementById('lesson-topic-title').textContent = lessonTitle;
    document.getElementById('lesson-counter').textContent = `${index + 1}/${total}`;

    const dotsEl = document.getElementById('lesson-dots');
    dotsEl.innerHTML = Array.from({ length: total }, (_, i) => {
      const cls = i < index ? 'done' : i === index ? 'active' : '';
      return `<span class="lesson-dot ${cls}"></span>`;
    }).join('');

    const wrap = document.getElementById('lesson-slide-wrap');

    if (slide.type === 'grammar') {
      wrap.innerHTML = `
        <div class="lesson-slide grammar-slide">
          <div class="grammar-badge">Nota gramatical</div>
          <h3 class="grammar-title">${escHtml(slide.title)}</h3>
          <div class="grammar-body">${renderBold(slide.body)}</div>
          ${slide.tip ? `<div class="grammar-tip">💡 ${escHtml(slide.tip)}</div>` : ''}
        </div>
      `;
    } else {
      wrap.innerHTML = `
        <div class="lesson-slide">
          <div class="lesson-slide-num">Aprende · ${index + 1} de ${total}</div>
          <div class="lesson-word-eu">${escHtml(slide.eu)}</div>
          <div class="lesson-word-es">${escHtml(slide.es)}</div>
          <div class="lesson-example">
            <div class="lesson-example-eu">${escHtml(slide.example_eu)}</div>
            <div class="lesson-example-es">${escHtml(slide.example_es)}</div>
          </div>
        </div>
      `;
    }

    const btn = document.getElementById('btn-lesson-next');
    btn.textContent = index === total - 1 ? '¡Empezar! →' : 'Siguiente →';
  }

  // ---- Exercise rendering ----

  function setSessionTitle(title) {
    const el = document.getElementById('session-topic-title');
    if (el) el.textContent = title;
  }

  function renderExercise(exercise, index, total) {
    const container = document.getElementById('exercise-container');
    const answerArea = document.getElementById('answer-area');
    const feedbackArea = document.getElementById('feedback-area');
    const counter = document.getElementById('session-counter');
    const progressBar = document.getElementById('session-progress-bar');

    feedbackArea.classList.add('hidden');
    counter.textContent = `${index + 1}/${total}`;
    progressBar.style.width = `${(index / total) * 100}%`;

    switch (exercise.type) {

      case 'multiple_choice':
        container.innerHTML = `
          <div class="exercise-type-label">${escHtml(exercise.instruction || 'Elige la respuesta correcta')}</div>
        `;
        answerArea.innerHTML = `
          <div class="choices-grid">
            ${exercise.options.map(opt => `
              <button class="choice-btn" data-value="${escAttr(opt)}">${escHtml(opt)}</button>
            `).join('')}
          </div>
        `;
        break;

      case 'grammar_select':
        container.innerHTML = `
          <div class="exercise-type-label">${escHtml(exercise.instruction || 'Elige la forma correcta')}</div>
          <div class="exercise-question">${escHtml(exercise.sentence)}</div>
          ${exercise.translation ? `<div class="exercise-context">${escHtml(exercise.translation)}</div>` : ''}
        `;
        answerArea.innerHTML = `
          <div class="choices-grid">
            ${exercise.options.map(opt => `
              <button class="choice-btn" data-value="${escAttr(opt)}">${escHtml(opt)}</button>
            `).join('')}
          </div>
        `;
        break;

      case 'translation_eu_es':
        container.innerHTML = `
          <div class="exercise-type-label">${escHtml(exercise.instruction || 'Traduce al castellano')}</div>
          <div class="exercise-question">${escHtml(exercise.eu)}</div>
        `;
        answerArea.innerHTML = renderTextInput();
        schedFocus(answerArea);
        break;

      case 'translation_es_eu':
        container.innerHTML = `
          <div class="exercise-type-label">${escHtml(exercise.instruction || 'Traduce al euskera')}</div>
          <div class="exercise-question">${escHtml(exercise.es)}</div>
        `;
        answerArea.innerHTML = renderTextInput();
        schedFocus(answerArea);
        break;

      case 'fill_blank':
        container.innerHTML = `
          <div class="exercise-type-label">${escHtml(exercise.instruction || 'Rellena el hueco')}</div>
          ${exercise.translation ? `<div class="exercise-context">${escHtml(exercise.translation)}</div>` : ''}
          <div class="exercise-question">${escHtml(exercise.sentence)}</div>
        `;
        answerArea.innerHTML = renderTextInput(exercise.hint || '');
        schedFocus(answerArea);
        break;

      case 'true_false':
        container.innerHTML = `
          <div class="exercise-type-label">${escHtml(exercise.instruction || '¿Verdadero o falso?')}</div>
          <div class="tf-card">
            <div class="tf-eu">${escHtml(exercise.eu)}</div>
            <div class="tf-arrow">→</div>
            <div class="tf-es">${escHtml(exercise.es)}</div>
          </div>
        `;
        answerArea.innerHTML = `
          <div class="tf-buttons">
            <button class="btn tf-btn tf-false" data-value="false">✗ Falso</button>
            <button class="btn tf-btn tf-true" data-value="true">✓ Verdadero</button>
          </div>
        `;
        break;

      case 'order_words': {
        const shuffled = [...exercise.words].sort(() => Math.random() - 0.5);
        container.innerHTML = `
          <div class="exercise-type-label">${escHtml(exercise.instruction || 'Ordena las palabras')}</div>
          ${exercise.translation ? `<div class="exercise-context">${escHtml(exercise.translation)}</div>` : ''}
        `;
        answerArea.innerHTML = `
          <div class="order-answer" id="order-answer"></div>
          <div class="order-bank" id="order-bank">
            ${shuffled.map(w => `<button class="word-tile" data-word="${escAttr(w)}">${escHtml(w)}</button>`).join('')}
          </div>
          <button class="btn btn-primary btn-submit" disabled>Comprobar</button>
        `;
        break;
      }

      case 'match_pairs': {
        const euWords = exercise.pairs.map(p => p.eu);
        const esWords = [...exercise.pairs.map(p => p.es)].sort(() => Math.random() - 0.5);
        container.innerHTML = `
          <div class="exercise-type-label">${escHtml(exercise.instruction || 'Une cada par')}</div>
        `;
        answerArea.innerHTML = `
          <div class="match-grid">
            <div class="match-col" id="match-left">
              ${euWords.map(w => `<button class="match-btn" data-side="eu" data-value="${escAttr(w)}">${escHtml(w)}</button>`).join('')}
            </div>
            <div class="match-col" id="match-right">
              ${esWords.map(w => `<button class="match-btn" data-side="es" data-value="${escAttr(w)}">${escHtml(w)}</button>`).join('')}
            </div>
          </div>
        `;
        break;
      }
    }
  }

  function showFeedback(isCorrect, exercise) {
    const feedbackArea = document.getElementById('feedback-area');
    const feedbackContent = document.getElementById('feedback-content');
    const answerArea = document.getElementById('answer-area');

    feedbackArea.classList.remove('hidden');

    if (isCorrect) {
      feedbackContent.className = 'feedback-content correct-fb';
      feedbackContent.innerHTML = '✓ ¡Correcto!';
    } else {
      feedbackContent.className = 'feedback-content wrong-fb';
      const correctDisplay = formatCorrectAnswer(exercise);
      const extra = exercise.explanation
        ? `<div class="feedback-explanation">${escHtml(exercise.explanation)}</div>`
        : exercise.hint
          ? `<div class="feedback-explanation">${escHtml(exercise.hint)}</div>`
          : '';
      feedbackContent.innerHTML = `
        ✗ Incorrecto
        <div class="feedback-correct-answer">Respuesta correcta: <strong>${correctDisplay}</strong></div>
        ${extra}
      `;
    }

    // Disable interactive elements
    answerArea.querySelectorAll('button').forEach(btn => { btn.disabled = true; });
    const input = answerArea.querySelector('.answer-input');
    if (input) {
      input.disabled = true;
      input.classList.add(isCorrect ? 'correct' : 'wrong');
    }

    // Highlight correct choice for multiple_choice / grammar_select
    if (exercise.type === 'multiple_choice' || exercise.type === 'grammar_select') {
      answerArea.querySelectorAll('.choice-btn').forEach(btn => {
        if (btn.dataset.value === String(exercise.answer)) btn.classList.add('correct');
      });
    }

    // Highlight correct true/false button
    if (exercise.type === 'true_false') {
      answerArea.querySelectorAll('.tf-btn').forEach(btn => {
        if (btn.dataset.value === String(exercise.answer)) btn.classList.add('correct');
      });
    }
  }

  function formatCorrectAnswer(exercise) {
    switch (exercise.type) {
      case 'true_false':
        return exercise.answer ? 'Verdadero' : 'Falso';
      case 'match_pairs':
        return exercise.pairs.map(p => `${escHtml(p.eu)} → ${escHtml(p.es)}`).join(', ');
      default:
        return escHtml(String(exercise.answer));
    }
  }

  // ---- Summary ----

  function renderSummary(correct, wrong, streak) {
    document.getElementById('stat-correct').textContent = correct;
    document.getElementById('stat-wrong').textContent = wrong;
    document.getElementById('stat-streak').textContent = streak;

    const total = correct + wrong;
    const ratio = total > 0 ? correct / total : 0;
    const icon = document.getElementById('summary-icon');
    const title = document.getElementById('summary-title');

    if (ratio === 1) { icon.textContent = '🏆'; title.textContent = '¡Perfecto!'; }
    else if (ratio >= 0.75) { icon.textContent = '🎉'; title.textContent = '¡Muy bien!'; }
    else if (ratio >= 0.5) { icon.textContent = '💪'; title.textContent = '¡Sigue practicando!'; }
    else { icon.textContent = '📚'; title.textContent = 'Hay que repasar más'; }
  }

  // ---- Private helpers ----

  function renderTextInput(hint = '') {
    return `
      <div class="answer-input-wrap">
        <input class="answer-input" type="text"
          placeholder="${hint ? escAttr(hint) : 'Escribe tu respuesta...'}"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      </div>
      <button class="btn btn-primary btn-submit">Comprobar</button>
    `;
  }

  function schedFocus(answerArea) {
    const input = answerArea.querySelector('.answer-input');
    if (input) setTimeout(() => input.focus(), 80);
  }

  function renderBold(text) {
    return escHtml(String(text)).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(str) {
    return String(str).replace(/"/g, '&quot;');
  }

  return {
    show,
    setStreak,
    renderUnitMap,
    renderLessonList,
    renderLessonSlide,
    setSessionTitle,
    renderExercise,
    showFeedback,
    renderSummary,
  };
})();
