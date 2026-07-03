# Vocalis — Advanced Voice Cloning & Acoustic Studio

An elite, client-side web application for physical and acoustic audio analysis, custom voice cloning profiles, and offline voice synthesis. Styled with highly refined typography, a sleek dark interface, and robust data visualization graphs.

---

## 🚀 Key Features / תכונות מפתח

### 🔊 1. Client-Side Speech & Audio Analyzer / ניתוח קול ואקוסטי מקומי
- **100% Offline Analysis**: Decodes and inspects physical signal properties directly in the browser via the Web Audio API.
- **Physical Signal Extractor**: Analyzes fundamental frequency (Pitch) using an autocorrelation pitch detector, extracts peak loudness (dB), RMS average power, dynamic range, and silent intervals.
- **Dynamic Waveform Visualizer**: Draws the raw signals dynamically on a high-refresh canvas with custom indigo gradients.

### 🎛️ 2. Synthesis Studio & Voice Cloner / אולפן סינתזה ושיבוט קולי
- **Voice Profiler**: Custom voice matching profiles.
- **High-Fidelity Audio Generation**: Simulated voice synthesis queue backed up by IndexedDB.
- **Real-Time Progress Notifications**: Integrated Service Worker sends push notifications when audio generation task is completed.

### 💾 3. Intelligent Storage Management / ניהול אחסון חכם
- **IndexedDB Inspector**: Real-time DB usage counter via the browser's Storage Estimate API.
- **Data Pruning**: Lets the user selectively purge old audio drafts or generated voice profiles to clean local storage space.
- **Direct WAV Export**: High-quality `.wav` audio downloader directly from the recordings gallery.

---

## 🛠️ Technology Stack / טכנולוגיות מפתח

- **Framework**: React 18 with TypeScript & Vite
- **Styling**: Tailwind CSS utility classes
- **Charts**: Recharts (with high-performance SVG renders)
- **Database**: IndexedDB via Dexie.js for extreme reliability and persistent offline memory
- **Audio Processing**: Native browser Web Audio API & HTML5 Canvas
- **Background Processes**: Local Service Worker for background audio tasks and native push notifications

---

## 📄 License

This software is developed by Google AI Studio Build and is subject to the MIT License.
