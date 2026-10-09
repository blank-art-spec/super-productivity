import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { PlannerCalendarViewComponent } from './planner-calendar-view.component';
import { PlannerService } from '../planner.service';
import { DateService } from '../../../core/date/date.service';
import { DateTimeFormatService } from '../../../core/date-time-format/date-time-format.service';
import { GlobalTrackingIntervalService } from '../../../core/global-tracking-interval/global-tracking-interval.service';
import { GlobalConfigService } from '../../config/global-config.service';
import { LayoutService } from '../../../core-ui/layout/layout.service';

describe('Planner calendar navigation', () => {
  let component: PlannerCalendarViewComponent;
  let today: BehaviorSubject<string>;

  beforeEach(() => {
    today = new BehaviorSubject('2026-10-09');
    TestBed.configureTestingModule({
      imports: [PlannerCalendarViewComponent],
      providers: [
        { provide: PlannerService, useValue: { selectCalendarDays$: () => of([]) } },
        { provide: DateService, useValue: { todayStr: () => '2026-10-09' } },
        { provide: DateTimeFormatService, useValue: { textLocale: signal('en-US') } },
        { provide: GlobalTrackingIntervalService, useValue: { todayDateStr$: today } },
        {
          provide: GlobalConfigService,
          useValue: { localization: signal({ firstDayOfWeek: 1 }) },
        },
        { provide: LayoutService, useValue: { isXs: signal(false) } },
      ],
    }).overrideComponent(PlannerCalendarViewComponent, {
      set: { imports: [], template: '' },
    });
    component = TestBed.createComponent(PlannerCalendarViewComponent).componentInstance;
  });

  it('follows logical today until the user selects a date, and Today restores that behavior', () => {
    expect(component.anchor()).toBe('2026-10-09');
    today.next('2026-10-10');
    expect(component.anchor()).toBe('2026-10-10');
    component.selectDay('2026-10-15');
    today.next('2026-10-11');
    expect(component.anchor()).toBe('2026-10-15');
    component.goToToday();
    expect(component.anchor()).toBe('2026-10-11');
  });

  it('navigates real month/week/day windows without changing persisted planner state', () => {
    component.view.set('month');
    component.navigate(1);
    expect(component.anchor()).toBe('2026-11-09');
    expect(component.dates().length).toBe(42);
    component.view.set('week');
    component.navigate(-1);
    expect(component.anchor()).toBe('2026-11-02');
    expect(component.dates().length).toBe(7);
    component.view.set('day');
    component.navigate(1);
    expect(component.dates()).toEqual(['2026-11-03']);
  });
});
