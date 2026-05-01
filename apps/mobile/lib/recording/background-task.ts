/**
 * Story 4.2 lays the substrate; Story 4.5 wires the actual 10-min retry
 * budget + escalation. We register a `BACKGROUND_UPLOAD` task that the
 * resumable-upload hook can hand off to when the app backgrounds.
 *
 * The task body is a placeholder — calling the queue replay logic from
 * inside a TaskManager task is Story 4.5's job. This file exists so the
 * task name is canonical across both stories.
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

export const BACKGROUND_UPLOAD_TASK = 'BACKGROUND_UPLOAD';

let registered = false;

export function registerBackgroundUploadTask(): void {
  if (registered) return;
  if (TaskManager.isTaskDefined(BACKGROUND_UPLOAD_TASK)) {
    registered = true;
    return;
  }
  TaskManager.defineTask(BACKGROUND_UPLOAD_TASK, async () => {
    // TODO(Story 4.5): drain the persisted upload queue here using the
    // 10-min retry budget + jittered backoff curve from arch-addendums § 6.
    return BackgroundFetch.BackgroundFetchResult.NoData;
  });
  registered = true;
}
