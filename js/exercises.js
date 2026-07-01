const Exercises = (() => {
  function normalize(str) {
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[.,!?¡¿;:'"]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildSpanishNumberMap() {
    const units = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve'];
    const veinti = ['veinte', 'veintiuno', 'veintidos', 'veintitres', 'veinticuatro', 'veinticinco', 'veintiseis', 'veintisiete', 'veintiocho', 'veintinueve'];
    const tens = { 30: 'treinta', 40: 'cuarenta', 50: 'cincuenta', 60: 'sesenta', 70: 'setenta', 80: 'ochenta', 90: 'noventa' };

    const map = {};
    units.forEach((w, i) => { map[w] = i; });
    teens.forEach((w, i) => { map[w] = 10 + i; });
    veinti.forEach((w, i) => { map[w] = 20 + i; });
    Object.entries(tens).forEach(([n, w]) => {
      map[w] = Number(n);
      for (let u = 1; u <= 9; u++) map[`${w} y ${units[u]}`] = Number(n) + u;
    });
    map['cien'] = 100;
    map['ciento'] = 100;
    return map;
  }

  const SPANISH_NUMBER_MAP = buildSpanishNumberMap();

  function parseNumberAnswer(normalizedStr) {
    if (/^\d+$/.test(normalizedStr)) return parseInt(normalizedStr, 10);
    return Object.prototype.hasOwnProperty.call(SPANISH_NUMBER_MAP, normalizedStr)
      ? SPANISH_NUMBER_MAP[normalizedStr]
      : null;
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
    const type = exercise.type;

    if (type === 'true_false') {
      return String(exercise.answer) === String(userAnswer);
    }

    if (type === 'match_pairs') {
      // userAnswer is array of {eu,es} — all must match exercise.pairs
      if (!Array.isArray(userAnswer) || userAnswer.length === 0) return false;
      return exercise.pairs.every(p =>
        userAnswer.some(u => u.eu === p.eu && u.es === p.es)
      );
    }

    const given = normalize(String(userAnswer));
    const accepted = Array.isArray(exercise.answer) ? exercise.answer : [exercise.answer];
    return accepted.some(a => checkSingleAnswer(a, given));
  }

  function checkSingleAnswer(correctRaw, given) {
    const correct = normalize(String(correctRaw));
    if (correct === given) return true;
    if (correct.length >= 5 && levenshtein(correct, given) <= 1) return true;
    const correctNum = parseNumberAnswer(correct);
    const givenNum = parseNumberAnswer(given);
    if (correctNum !== null && givenNum !== null && correctNum === givenNum) return true;
    return false;
  }

  return { normalize, checkAnswer };
})();
