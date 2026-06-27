const UI = (() => {
  function show(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(screenId);
    if (el) {
      el.classList.add('active');
      window.scrollTo(0, 0);
    }
  }

  function renderTopics(topics, progressMap, onClickFn) {
    const a1Grid = document.getElementById('topics-a1');
    const a2Grid = document.getElementById('topics-a2');
    a1Grid.innerHTML = '';
    a2Grid.innerHTML = '';

    topics.forEach(topic => {
      const prog = progressMap[topic.id] || { completed: 0, total: 31 };
      const pct = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
      const isLocked = !topic.unlocked;

      const card = document.createElement('div');
      card.className = 'topic-card' + (isLocked ? ' locked' : '');
      card.innerHTML = `
        <span class="topic-emoji">${topic.emoji}</span>
        <div class="topic-info">
          <div class="topic-name">${topic.title}</div>
          <div class="topic-desc">${topic.description || ''}</div>
        </div>
        <div class="topic-progress">
          <div class="topic-progress-pct">${pct}%</div>
          <div class="topic-progress-bar"><div class="topic-progress-fill" style="width:${pct}%"></div></div>
        </div>
        ${isLocked ? '<span class="topic-lock">🔒</span>' : ''}
      `;

      if (!isLocked) {
        card.addEventListener('click', () => onClickFn(topic));
      }

      const grid = topic.level === 'A1' ? a1Grid : a2Grid;
      grid.appendChild(card);
    });
  }

  function setStreak(days) {
    const el = document.getElementById('streak-count');
    if (el) el.textContent = days;
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

    container.innerHTML = `
      <div class="exercise-type-label">${exercise.label}</div>
      ${exercise.context ? `<div class="exercise-context">${escHtml(exercise.context)}</div>` : ''}
      <div class="exercise-question">${escHtml(exercise.question)}</div>
    `;

    if (exercise.inputMode === 'choice') {
      answerArea.innerHTML = `
        <div class="choices-grid">
          ${exercise.options.map(opt => `
            <button class="choice-btn" data-value="${escAttr(opt)}">${escHtml(opt)}</button>
          `).join('')}
        </div>
      `;
    } else {
      answerArea.innerHTML = `
        <div class="answer-input-wrap">
          <input class="answer-input" type="text" placeholder="Escribe tu respuesta..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        </div>
        <button class="btn btn-primary btn-submit">Comprobar</button>
      `;
      const input = answerArea.querySelector('.answer-input');
      setTimeout(() => input.focus(), 100);

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const btn = answerArea.querySelector('.btn-submit');
          if (btn && !btn.disabled) btn.click();
        }
      });
    }
  }

  function showFeedback(isCorrect, exercise) {
    const feedbackArea = document.getElementById('feedback-area');
    const feedbackContent = document.getElementById('feedback-content');

    feedbackArea.classList.remove('hidden');

    if (isCorrect) {
      feedbackContent.className = 'feedback-content correct-fb';
      feedbackContent.innerHTML = `✓ ¡Correcto!`;
    } else {
      feedbackContent.className = 'feedback-content wrong-fb';
      feedbackContent.innerHTML = `
        ✗ Incorrecto
        <div class="feedback-correct-answer">
          Respuesta correcta: <strong>${escHtml(exercise.answer)}</strong>
        </div>
        ${exercise.hint ? `<div class="feedback-correct-answer" style="margin-top:0.3rem;color:var(--text2)">${escHtml(exercise.hint)}</div>` : ''}
      `;
    }

    const answerArea = document.getElementById('answer-area');
    const input = answerArea.querySelector('.answer-input');
    const submitBtn = answerArea.querySelector('.btn-submit');
    const choiceBtns = answerArea.querySelectorAll('.choice-btn');

    if (input) {
      input.classList.add(isCorrect ? 'correct' : 'wrong');
      input.disabled = true;
    }
    if (submitBtn) submitBtn.disabled = true;
    choiceBtns.forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.value === exercise.answer) btn.classList.add('correct');
    });
  }

  function setSessionTitle(title) {
    const el = document.getElementById('session-topic-title');
    if (el) el.textContent = title;
  }

  function renderSummary(correct, wrong, streak) {
    document.getElementById('stat-correct').textContent = correct;
    document.getElementById('stat-wrong').textContent = wrong;
    document.getElementById('stat-streak').textContent = streak;

    const total = correct + wrong;
    const ratio = total > 0 ? correct / total : 0;
    const icon = document.getElementById('summary-icon');
    const title = document.getElementById('summary-title');

    if (ratio === 1) {
      icon.textContent = '🏆';
      title.textContent = '¡Perfecto!';
    } else if (ratio >= 0.75) {
      icon.textContent = '🎉';
      title.textContent = '¡Muy bien!';
    } else if (ratio >= 0.5) {
      icon.textContent = '💪';
      title.textContent = '¡Sigue practicando!';
    } else {
      icon.textContent = '📚';
      title.textContent = 'Hay que repasar más';
    }
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
    renderTopics,
    setStreak,
    renderExercise,
    showFeedback,
    setSessionTitle,
    renderSummary,
  };
})();
