import { LocalNotifications } from '@capacitor/local-notifications';

const SCHEDULE_ACTION_TYPE = 'SCHEDULE_ACTIONS';

/**
 * Request necessary notification permissions from the OS.
 */
export const requestNotificationPermissions = async () => {
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  } catch (e) {
    console.warn("LocalNotifications requestPermissions error:", e);
    return false;
  }
};

/**
 * Configure interactive action buttons on the notification tray.
 * Option Y: Advanced Actions ("Mark Done", "Snooze 10m")
 */
export const setupNotificationChannels = async () => {
  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: SCHEDULE_ACTION_TYPE,
          actions: [
            {
              id: 'mark_done',
              title: 'Mark Done'
            },
            {
              id: 'snooze',
              title: 'Snooze 10m'
            }
          ]
        },
        {
          id: 'DAILY_BRIEFING_ACTIONS',
          actions: [
            {
              id: 'open_app',
              title: 'View Day'
            }
          ]
        }
      ]
    });
  } catch (e) {
    console.warn("LocalNotifications registerActionTypes error:", e);
  }
};

/**
 * Setup listeners for when the user clicks an action button on a notification.
 */
export const setupListeners = () => {
  try {
    LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
      const { actionId, notification } = notificationAction;
      
      console.log(`Notification action invoked: ${actionId} on ${notification.id}`);
      
      if (actionId === 'mark_done') {
        console.log('Marking as done from notification');
      } else if (actionId === 'snooze') {
        console.log('Snoozing for 10 minutes');
        LocalNotifications.schedule({
          notifications: [
            {
              id: notification.id + 1000,
              title: notification.title,
              body: notification.body,
              schedule: { at: new Date(Date.now() + 10 * 60000) },
              actionTypeId: SCHEDULE_ACTION_TYPE
            }
          ]
        });
      }
    });
  } catch (e) {
    console.warn("LocalNotifications listener error:", e);
  }
};

/**
 * Sync the Daily Morning Briefing notification. (Option B)
 */
export const syncDailyBriefing = async () => {
  try {
    const briefingId = 999999;
    await LocalNotifications.cancel({ notifications: [{ id: briefingId }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: briefingId,
          title: "Good Morning",
          body: "Your daily briefing is ready. Tap to view today's schedules and tasks.",
          schedule: { on: { hour: 8, minute: 0 } },
          actionTypeId: 'DAILY_BRIEFING_ACTIONS'
        }
      ]
    });
  } catch (e) {
    console.warn("Error scheduling daily briefing:", e);
  }
};

const parseTime = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return { hour: h, minute: m };
};

const getReminderTime = (timeStr) => {
  const { hour, minute } = parseTime(timeStr);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setMinutes(date.getMinutes() - 10);
  return { hour: date.getHours(), minute: date.getMinutes() };
};

const stringToNumericId = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; 
  }
  return Math.abs(hash);
};

/**
 * Sync schedule block reminders (Option A).
 */
export const syncScheduleReminders = async (schedules) => {
  try {
    const notificationsToSchedule = [];
    
    schedules.forEach(sched => {
      if (!sched.startTime) return;
      const { hour, minute } = getReminderTime(sched.startTime);
      const baseId = stringToNumericId(sched.id.toString());
      
      const days = Array.isArray(sched.repeatDays) ? sched.repeatDays : [];
      if (days.length === 0) {
        notificationsToSchedule.push({
          id: baseId,
          title: sched.title || "Upcoming Schedule",
          body: `Starts in 10 minutes (at ${sched.startTime})`,
          schedule: { at: new Date(new Date().setHours(hour, minute, 0, 0)) },
          actionTypeId: SCHEDULE_ACTION_TYPE
        });
      } else {
        days.forEach(dayIndex => {
          const capWeekday = (dayIndex % 7) + 1; 
          notificationsToSchedule.push({
            id: baseId + capWeekday,
            title: sched.title || "Upcoming Schedule",
            body: `Starts in 10 minutes (at ${sched.startTime})`,
            schedule: { on: { weekday: capWeekday, hour, minute } },
            actionTypeId: SCHEDULE_ACTION_TYPE
          });
        });
      }
    });

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: notificationsToSchedule });
    }
  } catch (e) {
    console.warn("Error syncing schedule reminders:", e);
  }
};
