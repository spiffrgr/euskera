const SRS = (() => {
  const MIN_EASE = 1.3;
  const DEFAULT_EASE = 2.5;

  function defaultItem(topicId, itemId) {
    return {
      topicId,
      itemId,
      interval: 0,
      ease: DEFAULT_EASE,
      nextReview: 0,
      correct: 0,
      wrong: 0,
    };
  }

  function update(item, wasCorrect) {
    const now = Date.now();
    const updated = { ...item };

    if (wasCorrect) {
      updated.correct += 1;
      if (updated.interval === 0) {
        updated.interval = 1;
      } else if (updated.interval === 1) {
        updated.interval = 6;
      } else {
        updated.interval = Math.round(updated.interval * updated.ease);
      }
      updated.ease = Math.max(MIN_EASE, updated.ease + 0.1);
    } else {
      updated.wrong += 1;
      updated.interval = 1;
      updated.ease = Math.max(MIN_EASE, updated.ease - 0.2);
    }

    updated.nextReview = now + updated.interval * 24 * 3600 * 1000;
    return updated;
  }

  function isDue(item) {
    return !item || item.nextReview <= Date.now();
  }

  function sortByPriority(items, srsMap) {
    return [...items].sort((a, b) => {
      const sa = srsMap[a.id];
      const sb = srsMap[b.id];
      const dueA = !sa || sa.nextReview <= Date.now();
      const dueB = !sb || sb.nextReview <= Date.now();
      if (dueA && !dueB) return -1;
      if (!dueA && dueB) return 1;
      const nrA = sa ? sa.nextReview : 0;
      const nrB = sb ? sb.nextReview : 0;
      return nrA - nrB;
    });
  }

  return { defaultItem, update, isDue, sortByPriority };
})();
