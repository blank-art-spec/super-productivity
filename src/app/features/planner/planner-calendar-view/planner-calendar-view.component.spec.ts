import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PlannerCalendarViewComponent } from './planner-calendar-view.component';
import { PlannerService } from '../planner.service';
import { DateService } from '../../../core/date/date.service';
import { DateTimeFormatService } from '../../../core/date-time-format/date-time-format.service';
import { GlobalTrackingIntervalService } from '../../../core/global-tracking-interval/global-tracking-interval.service';
import { GlobalConfigService } from '../../config/global-config.service';
import { LayoutService } from '../../../core-ui/layout/layout.service';
import { PlannerDay } from '../planner.model';

describe('Planner calendar navigation', () => {
  let component: PlannerCalendarViewComponent;
  let today: BehaviorSubject<string>;
  let isXs: ReturnType<typeof signal<boolean>>;
  let days: BehaviorSubject<PlannerDay[]>;

  beforeEach(() => {
    today = new BehaviorSubject('2026-10-09');
    isXs = signal(false);
    days = new BehaviorSubject<PlannerDay[]>(
      ['2026-10-08', '2026-10-09', '2026-10-10'].map((dayDate) => ({
        dayDate,
        timeEstimate: 0,
        timeLimit: 0,
        itemsTotal: dayDate === '2026-10-09' ? 2 : 0,
        tasks: [],
        deadlineTasks: [],
        noStartTimeRepeatProjections: [],
        allDayEvents: [],
        scheduledIItems: [],
      })),
    );
    TestBed.configureTestingModule({
      imports: [PlannerCalendarViewComponent],
      providers: [
        { provide: PlannerService, useValue: { selectCalendarDays$: () => days } },
        { provide: DateService, useValue: { todayStr: () => '2026-10-09' } },
        { provide: DateTimeFormatService, useValue: { textLocale: signal('en-US') } },
        { provide: GlobalTrackingIntervalService, useValue: { todayDateStr$: today } },
        {
          provide: GlobalConfigService,
          useValue: { localization: signal({ firstDayOfWeek: 1 }) },
        },
        { provide: LayoutService, useValue: { isXs } },
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

  it('shows the selected day on phones and restores the whole week on desktop without rewriting days', () => {
    expect(component.visibleDays().length).toBe(3);
    isXs.set(true);
    expect(component.visibleDays().map((day) => day.dayDate)).toEqual(['2026-10-09']);
    component.selectDay('2026-10-10');
    expect(component.visibleDays().map((day) => day.dayDate)).toEqual(['2026-10-10']);
    expect(days.value.length).toBe(3);
    isXs.set(false);
    expect(component.visibleDays()).toEqual(days.value);
  });

  it('uses localized date labels and live item indicators for the seven day strip', () => {
    expect(component.weekDays().map((day) => day.day)).toEqual(component.dates());
    expect(component.weekDays().length).toBe(7);
    expect(component.weekDays().find((day) => day.day === '2026-10-09')?.hasItems).toBe(
      true,
    );
    days.next([]);
    expect(component.weekDays().some((day) => day.hasItems)).toBe(false);
    component.view.set('day');
    expect(component.title()).toContain('9');
  });
});
