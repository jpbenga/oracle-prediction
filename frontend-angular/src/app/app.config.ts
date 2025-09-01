import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './services/auth.interceptor';

// TODO: Remplacez cet objet par votre propre configuration Firebase
const firebaseConfig = {
    apiKey: "AIza...",
    authDomain: "votre-projet.firebaseapp.com",
    projectId: "votre-projet",
    storageBucket: "votre-projet.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore())
  ]
};