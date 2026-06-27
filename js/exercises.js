const Exercises = (() => {
  const cache = {};

  async function loadTopic(topicId) {
    if (cache[topicId]) return cache[topicId];
    const res = await fetch(`data/exercises/${topicId}.json`);
    if (!res.ok) throw new Error(`Cannot load ${topicId}`);
    const data = await res.json();
    cache[topicId] = data;
    return data;
  }

  async function loadTopics() {
    const res = await fetch('data/topics.json');
    return res.json();
  }

  const TYPES = ['translation_es_eu', 'translation_eu_es', 'multiple_choice', 'fill_blank'];

  function pickType(item, forceType) {
    if (forceType) return forceType;
    return TYPES[Math.floor(Math.random() * TYPES.length)];
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function makeDistractors(item, allItems, field, count = 3) {
    const others = allItems.filter(x => x.id !== item.id);
    const shuffled = shuffle(others);
    return shuffled.slice(0, count).map(x => x[field]);
  }

  function buildExercise(item, type, allItems) {
    switch (type) {
      case 'translation_es_eu':
        return {
          type,
          label: 'Traduce al euskera',
          question: item.es,
          answer: item.eu,
          inputMode: 'text',
          hint: item.example_es,
        };

      case 'translation_eu_es':
        return {
          type,
          label: 'Traduce al castellano',
          question: item.eu,
          answer: item.es,
          inputMode: 'text',
          hint: item.example_eu,
        };

      case 'multiple_choice': {
        const questionInEs = Math.random() > 0.5;
        const question = questionInEs ? item.es : item.eu;
        const correctAnswer = questionInEs ? item.eu : item.es;
        const distractorField = questionInEs ? 'eu' : 'es';
        const distractors = makeDistractors(item, allItems, distractorField, 3);
        const options = shuffle([correctAnswer, ...distractors]);
        return {
          type,
          label: questionInEs ? 'Elige la traducción en euskera' : 'Elige la traducción en castellano',
          question,
          answer: correctAnswer,
          options,
          inputMode: 'choice',
          hint: null,
        };
      }

      case 'fill_blank': {
        // Always blank the Basque word in the Basque example sentence
        const sentence = item.example_eu;
        const target = item.eu;
        const blanked = sentence.replace(
          new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
          '___'
        );
        if (!blanked.includes('___')) {
          return buildExercise(item, 'translation_es_eu', allItems);
        }
        return {
          type,
          label: 'Rellena el hueco en euskera',
          context: item.example_es,
          question: blanked,
          answer: target,
          inputMode: 'text',
          hint: null,
        };
      }

      default:
        return buildExercise(item, 'translation_es_eu', allItems);
    }
  }

  function normalize(str) {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[.,!?¡¿;:'"]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i-1] === b[j-1]
          ? dp[i-1][j-1]
          : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      }
    }
    return dp[m][n];
  }

  function checkAnswer(exercise, userAnswer) {
    const correct = normalize(exercise.answer);
    const given = normalize(userAnswer);
    if (correct === given) return true;
    // Allow 1 typo for answers of 5+ characters
    if (correct.length >= 5 && levenshtein(correct, given) <= 1) return true;
    return false;
  }

  async function buildSession(topicId, srsMap, sessionSize = 8) {
    const allItems = await loadTopic(topicId);
    const sorted = SRS.sortByPriority(allItems, srsMap);
    const selected = sorted.slice(0, sessionSize);

    const typeCounts = {};
    return selected.map((item, i) => {
      const type = pickType(item);
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      return {
        itemId: item.id,
        ...buildExercise(item, type, allItems),
      };
    });
  }

  return { loadTopic, loadTopics, buildSession, checkAnswer, normalize };
})();
