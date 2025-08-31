import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getFirestore, provideFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';

// NOTE: Using a placeholder config with the correct projectId.
// This is sufficient for connecting to the local emulator.
const firebaseConfig = {
  projectId: "oracle-prediction-app",
  apiKey: "DUMMY_API_KEY",
  authDomain: "oracle-prediction-app.firebaseapp.com",
  storageBucket: "oracle-prediction-app.appspot.com",
  messagingSenderId: "DUMMY_SENDER_ID",
  appId: "DUMMY_APP_ID"
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideFirestore(() => {
      const firestore = getFirestore();
      // Connect to the emulator only in a local development environment
      if (location.hostname === 'localhost') {
        connectFirestoreEmulator(firestore, 'localhost', 8080);
      }
      return firestore;
    }),
  ]
};
