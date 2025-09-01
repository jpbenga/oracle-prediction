
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { ProfilePage } from './pages/profile-page/profile-page';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Dashboard],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('frontend-angular');
  isPremium = false;

  onActivate(component: any) {
    if (component instanceof Dashboard || component instanceof ProfilePage) {
      component.isPremium = this.isPremium;
      
      if (component instanceof Dashboard) {
        component.togglePremium = () => {
          this.isPremium = !this.isPremium;
          component.isPremium = this.isPremium;
        };
      }
    }
  }
}
