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

    const correct = normalize(String(exercise.answer));
    const given = normalize(String(userAnswer));
    if (correct === given) return true;
    if (correct.length >= 5 && levenshtein(correct, given) <= 1) return true;
    return false;
  }

  return { normalize, checkAnswer };
})();
