package com.hardik.momentum.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import com.hardik.momentum.MainActivity;
import com.hardik.momentum.R;
import org.json.JSONArray;
import org.json.JSONObject;

public class UpcomingPillWidgetProvider extends AppWidgetProvider {

  public static void refresh(Context context) {
    if (context == null) return;
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    ComponentName component = new ComponentName(context, UpcomingPillWidgetProvider.class);
    for (int id : manager.getAppWidgetIds(component)) {
      updateWidget(context, manager, id);
    }
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    for (int id : appWidgetIds) {
      updateWidget(context, appWidgetManager, id);
    }
  }

  private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_upcoming_pill);

    // Read snapshot to get top upcoming/active task
    SharedPreferences prefs = context.getSharedPreferences(WidgetBridgePlugin.PREFERENCES, Context.MODE_PRIVATE);
    String raw = prefs.getString(WidgetBridgePlugin.SNAPSHOT, null);

    String title = "All caught up!";
    String time = "Tap to view today's schedule";
    String duration = "✓";

    if (raw != null && !raw.trim().isEmpty()) {
      try {
        JSONObject snapshot = new JSONObject(raw);
        JSONArray tasks = snapshot.optJSONArray("tasks");
        if (tasks != null) {
          for (int i = 0; i < tasks.length(); i++) {
            JSONObject t = tasks.optJSONObject(i);
            if (t != null && !t.optBoolean("completed", false)) {
              title = t.optString("title", "Next Task");
              String st = t.optString("startTime", "").trim();
              int dur = t.optInt("durationMinutes", 45);
              duration = dur + "m";
              if (!st.isEmpty()) {
                time = "At " + st + " • " + dur + "m block";
              } else {
                time = "Top pending • " + dur + "m";
              }
              break;
            }
          }
        }
      } catch (Exception ignored) {}
    }

    views.setTextViewText(R.id.widget_pill_title, title);
    views.setTextViewText(R.id.widget_pill_time, time);
    views.setTextViewText(R.id.widget_pill_duration, duration);

    // Open app on click
    Intent intent = new Intent(context, MainActivity.class);
    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent pi = PendingIntent.getActivity(
        context,
        105,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    views.setOnClickPendingIntent(R.id.widget_pill_root, pi);

    appWidgetManager.updateAppWidget(appWidgetId, views);
  }
}
