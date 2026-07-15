/**
 * State Manager — Simple pub/sub state management for the app.
 * 
 * WHY not React/Redux/etc.?
 * - Hackathon requirement: pure vanilla JS, explainable line-by-line
 * - A simple pub/sub pattern is more than enough for this app's complexity
 * - localStorage for persistence, in-memory for runtime state
 * 
 * PATTERN:
 * - State is a plain JS object
 * - Components subscribe to specific state keys
 * - When state changes, all subscribers for that key are notified
 * - Certain state keys are auto-persisted to localStorage
 */

// Keys that should be persisted to localStorage across sessions
const PERSISTED_KEYS = ['history', 'theme', 'sidebarCollapsed', 'activeEnvironmentId'];

// Initial state
const initialState = {
  // Active request being built
  activeRequest: {
    method: 'GET',
    url: '',
    headers: [],
    params: [],
    body: { type: 'none', content: '' },
    auth: { type: 'none' },
  },

  // Collections loaded from backend
  collections: [],

  // Environments loaded from backend
  environments: [],

  // Active environment ID
  activeEnvironmentId: null,

  // Request history (persisted in localStorage)
  history: [],

  // Open tabs (in-memory only)
  openTabs: [],
  activeTabId: null,

  // Response from last request
  response: null,

  // Loading state
  isLoading: false,

  // UI state
  theme: 'dark',
  sidebarCollapsed: false,
  sidebarActiveTab: 'collections', // 'collections' | 'history' | 'environments'
};

// The actual state object
let state = { ...initialState };

// Subscriber map: key → Set of callback functions
const subscribers = new Map();

/**
 * Initialize state — load persisted values from localStorage.
 */
export function initState() {
  for (const key of PERSISTED_KEYS) {
    try {
      const stored = localStorage.getItem(`postman-lite-${key}`);
      if (stored !== null) {
        state[key] = JSON.parse(stored);
      }
    } catch (err) {
      console.warn(`[State] Failed to load ${key} from localStorage:`, err.message);
    }
  }

  // Apply theme immediately
  document.documentElement.setAttribute('data-theme', state.theme);
}

/**
 * Get the current value of a state key.
 * @param {string} key - State key to read
 * @returns {*} The current value
 */
export function getState(key) {
  return state[key];
}

/**
 * Get the entire state object (read-only snapshot).
 * @returns {Object} Shallow copy of the state
 */
export function getAllState() {
  return { ...state };
}

/**
 * Update a state key and notify subscribers.
 * @param {string} key - State key to update
 * @param {*} value - New value
 */
export function setState(key, value) {
  const oldValue = state[key];
  state[key] = value;

  // Persist to localStorage if this key is in the persisted list
  if (PERSISTED_KEYS.includes(key)) {
    try {
      localStorage.setItem(`postman-lite-${key}`, JSON.stringify(value));
    } catch (err) {
      console.warn(`[State] Failed to persist ${key} to localStorage:`, err.message);
    }
  }

  // Notify subscribers
  const keySubscribers = subscribers.get(key);
  if (keySubscribers) {
    for (const callback of keySubscribers) {
      try {
        callback(value, oldValue);
      } catch (err) {
        console.error(`[State] Subscriber error for key "${key}":`, err);
      }
    }
  }
}

/**
 * Subscribe to changes on a specific state key.
 * @param {string} key - State key to watch
 * @param {Function} callback - Called with (newValue, oldValue) when the key changes
 * @returns {Function} Unsubscribe function
 */
export function subscribe(key, callback) {
  if (!subscribers.has(key)) {
    subscribers.set(key, new Set());
  }
  subscribers.get(key).add(callback);

  // Return an unsubscribe function
  return () => {
    subscribers.get(key)?.delete(callback);
  };
}

/**
 * Add a request to history (max 50 items, most recent first).
 * @param {Object} entry - { method, url, status, timeMs, timestamp }
 */
export function addToHistory(entry) {
  const history = getState('history') || [];
  history.unshift({
    ...entry,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
  });

  // Keep only the last 50 entries to prevent localStorage from growing unbounded
  if (history.length > 50) {
    history.length = 50;
  }

  setState('history', history);
}

/**
 * Clear all history.
 */
export function clearHistory() {
  setState('history', []);
}

/**
 * Toggle theme between dark and light.
 */
export function toggleTheme() {
  const newTheme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  setState('theme', newTheme);
}
