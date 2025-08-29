// frontend-angular/src/app/app.routes.ts
import { Routes } from '@angular/router';

// Correction : On importe 'Dashboard' et non 'DashboardComponent'
import { Dashboard } from './dashboard/dashboard'; 

export const routes: Routes = [
    {
        path: '',
        // Et on utilise 'Dashboard' ici aussi
        component: Dashboard 
    }
];