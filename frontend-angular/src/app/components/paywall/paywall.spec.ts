import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Paywall } from './paywall';

describe('Paywall', () => {
  let component: Paywall;
  let fixture: ComponentFixture<Paywall>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Paywall]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Paywall);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
