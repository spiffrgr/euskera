const Course = (() => {
  const cache = {};

  async function load() {
    if (cache._course) return cache._course;
    const res = await fetch('data/course_a1.json');
    if (!res.ok) throw new Error('Cannot load course');
    cache._course = await res.json();
    return cache._course;
  }

  async function loadUnit(unitId) {
    const key = `u_${unitId}`;
    if (cache[key]) return cache[key];
    const res = await fetch(`data/units/${unitId}/meta.json`);
    if (!res.ok) throw new Error(`Cannot load unit ${unitId}`);
    cache[key] = await res.json();
    return cache[key];
  }

  async function loadLesson(unitId, lessonId) {
    const key = `${unitId}_${lessonId}`;
    if (cache[key]) return cache[key];
    const res = await fetch(`data/units/${unitId}/${lessonId}.json`);
    if (!res.ok) throw new Error(`Cannot load ${unitId}/${lessonId}`);
    cache[key] = await res.json();
    return cache[key];
  }

  return { load, loadUnit, loadLesson };
})();
