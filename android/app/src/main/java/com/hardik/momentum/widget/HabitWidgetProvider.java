package com.hardik.momentum.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import com.hardik.momentum.MainActivity;
import com.hardik.momentum.R;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

public class HabitWidgetProvider extends AppWidgetProvider {

  public static void refresh(Context context) {
    if (context == null) return;
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    ComponentName component = new ComponentName(context, HabitWidgetProvider.class);
    for (int id : manager.getAppWidgetIds(component)) {
      updateWidget(context, manager, id);
    }
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    for (int appWidgetId : appWidgetIds) {
      updateWidget(context, appWidgetManager, appWidgetId);
    }
  }

  private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_habits);

    // Read snapshot to get real habits
    SharedPreferences prefs = context.getSharedPreferences(WidgetBridgePlugin.PREFERENCES, Context.MODE_PRIVATE);
    String raw = prefs.getString(WidgetBridgePlugin.SNAPSHOT, "");

    List<TodayWidgetProvider.HabitItem> list = new ArrayList<>();
    if (raw != null && !raw.isEmpty()) {
      try {
        JSONObject snapshot = new JSONObject(raw);
        JSONArray habits = snapshot.optJSONArray("habits");
        if (habits != null) {
          for (int i = 0; i < habits.length(); i++) {
            JSONObject h = habits.optJSONObject(i);
            if (h == null) continue;
            TodayWidgetProvider.HabitItem item = new TodayWidgetProvider.HabitItem();
            item.id = h.optString("id", String.valueOf(i));
            item.title = h.optString("title", "").trim();
            if (item.title.isEmpty()) continue;
            item.isDone = h.optBoolean("isDone", false);
            item.streakCount = h.optInt("streakCount", 0);
            list.add(item);
          }
        }
      } catch (Exception ignored) {}
    }

    // Sort: uncompleted first, then by streak descending
    Collections.sort(list, new Comparator<TodayWidgetProvider.HabitItem>() {
      @Override
      public int compare(TodayWidgetProvider.HabitItem a, TodayWidgetProvider.HabitItem b) {
        if (a.isDone != b.isDone) return a.isDone ? 1 : -1;
        return Integer.compare(b.streakCount, a.streakCount);
      }
    });

    int[] checkIds = { R.id.habit_check_1, R.id.habit_check_2, R.id.habit_check_3 };

    for (int i = 0; i < 3; i++) {
      if (i < list.size()) {
        TodayWidgetProvider.HabitItem h = list.get(i);
        if (h.isDone) {
          views.setInt(checkIds[i], "setBackgroundResource", R.drawable.widget_checkbox_checked);
          views.setTextViewText(checkIds[i], "✓");
        } else {
          views.setInt(checkIds[i], "setBackgroundResource", R.drawable.widget_checkbox_bg);
          views.setTextViewText(checkIds[i], "");
        }

        // Tap checkbox toggles habit via TodayWidgetProvider broadcast
        Intent checkIntent = new Intent(context, TodayWidgetProvider.class);
        checkIntent.setAction(TodayWidgetProvider.ACTION_TOGGLE_HABIT);
        checkIntent.setData(Uri.parse("momentum://habit/toggle/" + h.id));
        checkIntent.putExtra(TodayWidgetProvider.EXTRA_HABIT_ID, h.id);
        PendingIntent checkPI = PendingIntent.getBroadcast(
            context,
            i + 500,
            checkIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(checkIds[i], checkPI);
      }
    }

    // Container click opens app
    Intent intent = new Intent(context, MainActivity.class);
    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    views.setOnClickPendingIntent(R.id.widget_habits_container, pendingIntent);

    appWidgetManager.updateAppWidget(appWidgetId, views);
  }
}
