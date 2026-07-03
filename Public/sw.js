const CACHE_NAME = 'voxclone-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  // Don't intercept API or WebSockets
  if (event.request.url.includes('/api/') || event.request.url.startsWith('ws')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Cache dynamic assets on the fly
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        // Fallback for offline mode if both cache and network fail
        return new Response('Offline mode', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});

function updateSynthesisInDB(queueId, resultBlob, synthesisTimeMs) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('VoiceAppDB');
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['generationQueue'], 'readwrite');
      const store = transaction.objectStore('generationQueue');
      const getRequest = store.get(queueId);
      
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.status = 'completed';
          item.resultAudioBlob = resultBlob;
          item.synthesisTimeMs = synthesisTimeMs;
          
          store.put(item);
          const lastSuccessfulRequest = store.put({ ...item, id: 'LAST_SUCCESSFUL' });
          lastSuccessfulRequest.onsuccess = () => resolve();
          lastSuccessfulRequest.onerror = (err) => reject(err);
        } else {
          reject(new Error('Item not found'));
        }
      };
      getRequest.onerror = (err) => reject(err);
    };
    request.onerror = (err) => reject(err);
  });
}

function markSynthesisFailedInDB(queueId, errorMessage = 'שגיאת רשת או שגיאה פנימית בתהליך הסינתזה') {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('VoiceAppDB');
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['generationQueue'], 'readwrite');
      const store = transaction.objectStore('generationQueue');
      const getRequest = store.get(queueId);
      
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.status = 'failed';
          item.errorMessage = errorMessage;
          const updateRequest = store.put(item);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = (err) => reject(err);
        } else {
          reject(new Error('Item not found'));
        }
      };
      getRequest.onerror = (err) => reject(err);
    };
    request.onerror = (err) => reject(err);
  });
}

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } else if (event.data.type === 'START_BACKGROUND_SYNTHESIS') {
    const { queueId, text, profileId, params, apiKey } = event.data.payload;
    const startTime = Date.now();

    const pitch = params?.pitch || 50;
    const stability = params?.stability || 80;
    const emotionalTone = params?.emotionalTone || 'neutral';
    const rateVariability = params?.rateVariability || 50;
    const accentIntensity = params?.accentIntensity || 50;

    // Perform long running simulated synthesis in service worker background
    event.waitUntil(
      performSynthesisWithRetry(queueId, { text, profileId, params, apiKey }, 0, startTime)
    );
  }
});

function getVoiceProfileFromDB(profileId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('VoiceAppDB');
    request.onsuccess = (event) => {
      const db = event.target.result;
      try {
        const transaction = db.transaction(['voiceProfiles'], 'readonly');
        const store = transaction.objectStore('voiceProfiles');
        const getRequest = store.get(profileId);
        getRequest.onsuccess = () => {
          resolve(getRequest.result || null);
        };
        getRequest.onerror = (err) => reject(err);
      } catch (err) {
        resolve(null);
      }
    };
    request.onerror = (err) => reject(err);
  });
}

const MAX_RETRIES = 3;
async function performSynthesisWithRetry(queueId, payload, attempt, startTime) {
  const { text, profileId, params, apiKey } = payload;
  try {
    const pitch = params?.pitch || 50;
    const stability = params?.stability || 80;
    const emotionalTone = params?.emotionalTone || 'neutral';
    const rateVariability = params?.rateVariability || 50;
    const accentIntensity = params?.accentIntensity || 50;

    // Get the voice profile from IndexedDB to see if we have an ElevenLabs voice ID
    const profile = await getVoiceProfileFromDB(profileId).catch(() => null);
    
    let resultBlob = null;
    let usedRealAPI = false;

    if (profile && profile.elevenLabsVoiceId) {
      try {
        const headers = {
          'Content-Type': 'application/json'
        };
        if (apiKey) {
          headers['x-elevenlabs-key'] = apiKey;
        }

        const response = await fetch('/api/synthesize', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            voiceId: profile.elevenLabsVoiceId,
            text,
            params: {
              pitch,
              stability,
              emotionalTone,
              rateVariability,
              accentIntensity
            }
          })
        });

        if (response.ok) {
          resultBlob = await response.blob();
          usedRealAPI = true;
        } else {
          const errData = await response.json().catch(() => ({ error: 'שגיאת רשת בסינתזה' }));
          console.warn('ElevenLabs API failed, falling back to local simulation:', errData.error);
        }
      } catch (err) {
        console.warn('Network error calling ElevenLabs API, falling back to local simulation:', err);
      }
    }

    if (!usedRealAPI) {
      // Simulate synthesis logic
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let toneMultiplier = 1.0;
      if (emotionalTone === 'happy' || emotionalTone === 'excited') toneMultiplier = 1.2;
      if (emotionalTone === 'sad') toneMultiplier = 0.8;
      if (emotionalTone === 'angry') toneMultiplier = 0.9;
      
      const durationMultiplier = 1.0 + (rateVariability - 50) / 100;
      const accentMod = (accentIntensity * 0.5);
      
      const baseFreq = (220 + (pitch * 3) + (stability * 0.5) + accentMod) * toneMultiplier;
      const durationSeconds = 1.8 * durationMultiplier;
      const sampleRate = 11025;
      
      // Inline simplified playable wav generation for SW
      const numSamples = Math.floor(sampleRate * durationSeconds);
      const subchunk2Size = numSamples * 2;
      const buffer = new ArrayBuffer(44 + subchunk2Size);
      const view = new DataView(buffer);
      view.setUint32(4, 36 + subchunk2Size, true);
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      view.setUint32(40, subchunk2Size, true);
      [0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x41,0x56,0x45,0x66,0x6d,0x74,0x20].forEach((v,i) => view.setUint8(i,v));
      [0x64,0x61,0x74,0x61].forEach((v,i) => view.setUint8(36+i,v));
      
      let offset = 44;
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        let sample = Math.sin(2 * Math.PI * baseFreq * t);
        sample += 0.3 * Math.sin(2 * Math.PI * (baseFreq * 2) * t);
        sample /= 1.3;
        let env = 1.0;
        if (i < 1000) env = i / 1000;
        else if (i > numSamples - 2000) env = (numSamples - i) / 2000;
        view.setInt16(offset, Math.floor(sample * env * 30000), true);
        offset += 2;
      }
      
      resultBlob = new Blob([buffer], { type: 'audio/wav' });
    }

    const synthesisTimeMs = Date.now() - startTime;
    
    await updateSynthesisInDB(queueId, resultBlob, synthesisTimeMs);

    // Notify active windows
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNTHESIS_COMPLETED',
        payload: { queueId, text }
      });
    });

    // Trigger system notification (works even when tab is in background)
    try {
      await self.registration.showNotification('סינתזת קול הושלמה', {
        body: `הטקסט "${text.substring(0, 25)}..." מוכן להשמעה באולפן!`,
        icon: '/icon.png',
        badge: '/icon.png',
        tag: queueId,
        data: { queueId }
      });
    } catch (e) {
      console.warn('Failed to show notification, likely permission denied:', e);
    }
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const delay = Math.pow(2, attempt) * 1000;
      
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNTHESIS_RETRYING',
          payload: { queueId, attempt: attempt + 1, delay, error: err.message }
        });
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return performSynthesisWithRetry(queueId, payload, attempt + 1, startTime);
    } else {
      console.error('Background synthesis error after retries:', err);
      await markSynthesisFailedInDB(queueId, err.message || 'שגיאה פנימית בתהליך').catch(console.error);

      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNTHESIS_FAILED',
          payload: { queueId }
        });
      });
    }
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
