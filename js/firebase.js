const FB = (() => {
  // Firebase config — safe to embed publicly; security comes from Firestore Rules
  const CONFIG = {
    apiKey: "AIzaSyAgWpck8hKyFDMQ66adcP_WLarcJ0vP4bs",
    authDomain: "curso-euskera.firebaseapp.com",
    projectId: "curso-euskera",
    storageBucket: "curso-euskera.firebasestorage.app",
    messagingSenderId: "482623743728",
    appId: "1:482623743728:web:9e8798aeb40e6776b14435",
  };

  let db = null;
  let uid = null;

  async function init() {
    if (!firebase.apps.length) {
      firebase.initializeApp(CONFIG);
    }
    db = firebase.firestore();

    return new Promise((resolve) => {
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          uid = user.uid;
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  async function login(email, password) {
    const result = await firebase.auth().signInWithEmailAndPassword(email, password);
    uid = result.user.uid;
  }

  async function register(email, password) {
    const result = await firebase.auth().createUserWithEmailAndPassword(email, password);
    uid = result.user.uid;
  }

  async function logout() {
    await firebase.auth().signOut();
    uid = null;
  }

  function userRef(path) {
    return db.doc(`users/${uid}/${path}`);
  }

  async function getProgress(topicId) {
    try {
      const snap = await userRef(`progress/${topicId}`).get();
      return snap.exists ? snap.data() : { completed: 0, total: 0 };
    } catch {
      return { completed: 0, total: 0 };
    }
  }

  async function setProgress(topicId, data) {
    try {
      await userRef(`progress/${topicId}`).set(data, { merge: true });
    } catch (e) {
      console.warn('FB setProgress error:', e);
    }
  }

  async function getSRSItem(itemId) {
    try {
      const snap = await userRef(`srs/${itemId}`).get();
      return snap.exists ? snap.data() : null;
    } catch {
      return null;
    }
  }

  async function setSRSItem(itemId, data) {
    try {
      await userRef(`srs/${itemId}`).set(data);
    } catch (e) {
      console.warn('FB setSRSItem error:', e);
    }
  }

  async function getAllSRSForTopic(topicId) {
    try {
      const snap = await db
        .collection(`users/${uid}/srs`)
        .where('topicId', '==', topicId)
        .get();
      const result = {};
      snap.forEach(doc => { result[doc.id] = doc.data(); });
      return result;
    } catch {
      return {};
    }
  }

  async function getAllDueSRSItems() {
    try {
      const snap = await db
        .collection(`users/${uid}/srs`)
        .where('nextReview', '<=', Date.now())
        .get();
      const result = [];
      snap.forEach(doc => result.push(doc.data()));
      return result;
    } catch {
      return [];
    }
  }

  async function getStreak() {
    try {
      const snap = await userRef('streak/current').get();
      return snap.exists ? snap.data() : { days: 0, lastDate: null };
    } catch {
      return { days: 0, lastDate: null };
    }
  }

  async function updateStreak() {
    const today = new Date().toISOString().slice(0, 10);
    const current = await getStreak();

    if (current.lastDate === today) return current.days;

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newDays = current.lastDate === yesterday ? current.days + 1 : 1;

    try {
      await userRef('streak/current').set({ days: newDays, lastDate: today });
    } catch (e) {
      console.warn('FB updateStreak error:', e);
    }
    return newDays;
  }

  return {
    init,
    login,
    register,
    logout,
    getProgress,
    setProgress,
    getSRSItem,
    setSRSItem,
    getAllSRSForTopic,
    getAllDueSRSItems,
    getStreak,
    updateStreak,
    isReady: () => db !== null && uid !== null,
  };
})();
