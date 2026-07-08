/**
 * Secure Chat App - Database Module (db.js)
 * Wraps IndexedDB in Promise-based functions to store encrypted data and large media blobs.
 */

const DB_NAME = 'PrivacyChatDB';
const DB_VERSION = 2; // Incremented database version

let dbInstance = null;

function getDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database failed to open:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Messages store
      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
        messageStore.createIndex('chatId', 'chatId', { unique: false });
        messageStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Contacts store
      if (!db.objectStoreNames.contains('contacts')) {
        db.createObjectStore('contacts', { keyPath: 'number' });
      }

      // Status store
      if (!db.objectStoreNames.contains('statuses')) {
        const statusStore = db.createObjectStore('statuses', { keyPath: 'id' });
        statusStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Profile store
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'number' });
      }

      // Call History store
      if (!db.objectStoreNames.contains('call_history')) {
        db.createObjectStore('call_history', { keyPath: 'id' });
      }
    };
  });
}

// Generic CRUD helpers
const db = {
  // Save an item to an object store
  put: async (storeName, item) => {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Get a single item by key
  get: async (storeName, key) => {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Get all items in a store
  getAll: async (storeName) => {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Get messages for a specific chat ID (contact number)
  getMessagesForChat: async (chatId) => {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('messages', 'readonly');
      const store = database.transaction('messages', 'readonly').objectStore('messages');
      const index = store.index('chatId');
      const request = index.getAll(chatId);

      request.onsuccess = () => {
        // Sort by timestamp
        const sorted = request.result.sort((a, b) => a.timestamp - b.timestamp);
        resolve(sorted);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Delete an item by key
  delete: async (storeName, key) => {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Clear an entire store (useful on logout for high privacy)
  clearStore: async (storeName) => {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Clear all databases for complete data wipe
  wipeAllData: async () => {
    await db.clearStore('messages');
    await db.clearStore('contacts');
    await db.clearStore('statuses');
    await db.clearStore('profile');
    try {
      await db.clearStore('call_history');
    } catch(e){}
    console.log('All local database storage cleared securely.');
  }
};

window.AppDB = db;
