import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PredictionsList } from './predictions-list';

describe('PredictionsList', () => {
  let component: PredictionsList;
  let fixture: ComponentFixture<PredictionsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PredictionsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PredictionsList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
