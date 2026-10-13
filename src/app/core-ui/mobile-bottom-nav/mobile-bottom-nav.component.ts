import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { LayoutService } from '../layout/layout.service';
import { PluginBridgeService } from '../../plugins/plugin-bridge.service';
import { PluginIconComponent } from '../../plugins/ui/plugin-icon/plugin-icon.component';
import { Store } from '@ngrx/store';
import { togglePluginPanel } from '../layout/store/layout.actions';
import {
  selectActivePluginId,
  selectIsShowPluginPanel,
} from '../layout/store/layout.reducer';
import { TODAY_TAG } from '../../features/tag/tag.const';
import { T } from '../../t.const';
import { WorkContextService } from '../../features/work-context/work-context.service';
import { GlobalConfigService } from '../../features/config/global-config.service';
import { FocusModeService } from '../../features/focus-mode/focus-mode.service';
import { hideFocusOverlay } from '../../features/focus-mode/store/focus-mode.actions';

@Component({
  selector: 'mobile-bottom-nav',
  standalone: true,
  imports: [
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatMenuModule,
    TranslateModule,
    PluginIconComponent,
  ],
  templateUrl: './mobile-bottom-nav.component.html',
  styleUrls: ['./mobile-bottom-nav.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileBottomNavComponent {
  private readonly _layoutService = inject(LayoutService);
  private readonly _pluginBridge = inject(PluginBridgeService);
  private readonly _store = inject(Store);
  private readonly _workContextService = inject(WorkContextService);
  private readonly _globalConfigService = inject(GlobalConfigService);
  readonly focusModeService = inject(FocusModeService);

  readonly T = T;
  readonly notebook = input(false);
  readonly TODAY_TAG = TODAY_TAG;
  readonly todayTagId = TODAY_TAG.id;
  readonly todayRoute = `/tag/${TODAY_TAG.id}/tasks`;

  // Services for template access
  readonly layoutService = this._layoutService;

  // Output events
  toggleMobileNavEvent = output<void>();

  // Plugin-related signals
  readonly sidePanelButtons = this._pluginBridge.sidePanelButtons;
  readonly activePluginId = toSignal(this._store.select(selectActivePluginId));
  readonly isShowPluginPanel = toSignal(this._store.select(selectIsShowPluginPanel));
  readonly hasProjectBacklog = toSignal(
    this._workContextService.activeWorkContext$.pipe(map((ac) => ac.isEnableBacklog)),
  );

  // Panel state signals from layout service
  readonly isShowNotes = this._layoutService.isShowNotes;
  readonly isShowIssuePanel = this._layoutService.isShowIssuePanel;
  readonly isShowScheduleDayPanel = this._layoutService.isShowScheduleDayPanel;
  readonly isIssuesPanelEnabled = computed(
    () => this._globalConfigService.appFeatures().isIssuesPanelEnabled,
  );
  readonly isShowMobileHeader = computed(
    () => this._globalConfigService.misc()?.isShowMobileHeader ?? false,
  );
  readonly isPlannerEnabled = computed(
    () => this._globalConfigService.appFeatures().isPlannerEnabled,
  );
  readonly isFocusModeEnabled = computed(
    () => this._globalConfigService.appFeatures().isFocusModeEnabled,
  );
  readonly isFocusActive = computed(
    () =>
      this.focusModeService.isSessionRunning() ||
      this.focusModeService.isSessionPaused() ||
      this.focusModeService.isBreakActive(),
  );
  readonly isProjectNotesEnabled = computed(
    () => this._globalConfigService.appFeatures().isProjectNotesEnabled,
  );
  readonly isScheduleDayPanelEnabled = computed(
    () => this._globalConfigService.appFeatures().isScheduleDayPanelEnabled,
  );

  /**
   * Below 600px this menu is the *only* route to every right-panel toggle --
   * `desktop-panel-buttons` is not rendered there at all. So every enabled
   * panel must be listed here and must count towards showing the button:
   * schedule was in neither, and `toggleScheduleDayPanel()` has no other
   * caller and no keyboard shortcut, so the panel was simply unreachable on a
   * phone.
   */
  readonly hasSidePanelMenuItems = computed(
    () =>
      this.sidePanelButtons().length > 0 ||
      this.isScheduleDayPanelEnabled() ||
      this.isIssuesPanelEnabled() ||
      this.isProjectNotesEnabled(),
  );

  // Navigation methods
  showAddTaskBar(): void {
    this.leaveFocusOverlay();
    this._layoutService.showAddTaskBar();
  }

  leaveFocusOverlay(): void {
    if (this.focusModeService.isOverlayShown()) this._store.dispatch(hideFocusOverlay());
  }

  toggleMobileNav(): void {
    this.leaveFocusOverlay();
    this.toggleMobileNavEvent.emit();
  }

  toggleMobileHeader(): void {
    this._globalConfigService.updateSection('misc', {
      isShowMobileHeader: !this.isShowMobileHeader(),
    });
  }

  // Panel methods
  onPluginButtonClick(button: {
    pluginId: string;
    onClick?: () => void;
    label?: string;
    icon?: string;
  }): void {
    this.leaveFocusOverlay();
    this._store.dispatch(togglePluginPanel(button.pluginId));

    if (button.onClick) {
      button.onClick();
    }
  }

  toggleIssuePanel(): void {
    this.leaveFocusOverlay();
    this._layoutService.toggleAddTaskPanel();
  }

  toggleNotes(): void {
    this.leaveFocusOverlay();
    this._layoutService.toggleNotes();
  }

  toggleScheduleDayPanel(): void {
    this.leaveFocusOverlay();
    this._layoutService.toggleScheduleDayPanel();
  }
}
