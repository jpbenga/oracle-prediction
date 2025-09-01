
import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard'; 
import { ProfilePage } from './pages/profile-page/profile-page';

export const routes: Routes = [
    {
        path: '',
        component: Dashboard 
    },
    {
        path: 'profile',
        component: ProfilePage
    }
];
