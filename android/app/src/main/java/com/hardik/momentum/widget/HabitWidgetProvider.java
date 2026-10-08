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
import android.os.Bundle;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StrikethroughSpan;
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

  @Override
  public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
    super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions);
    updateWidget(context, appWidgetManager, appWidgetId);
  }

  private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_habits);

    // Read snapshot to get real habits
    SharedPreferences prefs = context.getSharedPreferences(WidgetBridgePlugin.PREFERENCES, Context.MODE_PRIVATE);
    String raw = prefs.getString(WidgetBridgePlugin.SNAPSHOT, "");

    List<TodayWidgetProvider.HabitItem> list = new ArrayList<>();
    int completedCount = 0;

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
            if (item.isDone) completedCount++;
          }
        }
      } catch (Exception ignored) {}
    }

    // Smart default starter habits if fresh install with no snapshot habits yet
    if (list.isEmpty()) {
      TodayWidgetProvider.HabitItem h1 = new TodayWidgetProvider.HabitItem();
      h1.id = "sample_1"; h1.title = "MORNING WORKOUT"; h1.isDone = true; h1.streakCount = 14;
      list.add(h1);
      completedCount++;

      TodayWidgetProvider.HabitItem h2 = new TodayWidgetProvider.HabitItem();
      h2.id = "sample_2"; h2.title = "READ 20 PAGES"; h2.isDone = false; h2.streakCount = 8;
      list.add(h2);

      TodayWidgetProvider.HabitItem h3 = new TodayWidgetProvider.HabitItem();
      h3.id = "sample_3"; h3.title = "MEDITATION"; h3.isDone = false; h3.streakCount = 21;
      list.add(h3);

      TodayWidgetProvider.HabitItem h4 = new TodayWidgetProvider.HabitItem();
      h4.id = "sample_4"; h4.title = "DEEP WORK SPRINT"; h4.isDone = false; h4.streakCount = 5;
      list.add(h4);
    }

    // Sort: uncompleted first, then by streak descending
    Collections.sort(list, new Comparator<TodayWidgetProvider.HabitItem>() {
      @Override
      public int compare(TodayWidgetProvider.HabitItem a, TodayWidgetProvider.HabitItem b) {
        if (a.isDone != b.isDone) return a.isDone ? 1 : -1;
        return Integer.compare(b.streakCount, a.streakCount);
      }
    });

    // Determine max rows based on widget height options
    Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
    int minHeight = options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0) : 0;
    int maxDisplayRows = (minHeight > 0 && minHeight < 110) ? 3 : 5;

    // Header badge
    if (list.isEmpty()) {
      views.setTextViewText(R.id.habit_summary_badge, "0 HABITS");
    } else {
      views.setTextViewText(R.id.habit_summary_badge, completedCount + "/" + list.size() + " DONE 🔥");
    }

    int[] rowIds = { R.id.habit_row_1, R.id.habit_row_2, R.id.habit_row_3, R.id.habit_row_4, R.id.habit_row_5 };
    int[] checkIds = { R.id.habit_check_1, R.id.habit_check_2, R.id.habit_check_3, R.id.habit_check_4, R.id.habit_check_5 };
    int[] titleIds = { R.id.habit_title_1, R.id.habit_title_2, R.id.habit_title_3, R.id.habit_title_4, R.id.habit_title_5 };
    int[] streakIds = { R.id.habit_streak_1, R.id.habit_streak_2, R.id.habit_streak_3, R.id.habit_streak_4, R.id.habit_streak_5 };

    if (list.isEmpty()) {
      views.setViewVisibility(R.id.habit_empty_view, View.VISIBLE);
      for (int i = 0; i < 5; i++) {
        views.setViewVisibility(rowIds[i], View.GONE);
      }
    } else {
      views.setViewVisibility(R.id.habit_empty_view, View.GONE);
      for (int i = 0; i < 5; i++) {
        if (i < list.size() && i < maxDisplayRows) {
          TodayWidgetProvider.HabitItem h = list.get(i);
          views.setViewVisibility(rowIds[i], View.VISIBLE);

          if (h.isDone) {
            SpannableString strikethrough = new SpannableString(h.title);
            strikethrough.setSpan(new StrikethroughSpan(), 0, strikethrough.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            views.setTextViewText(titleIds[i], strikethrough);
            views.setTextColor(titleIds[i], Color.parseColor("#64748B"));

            views.setInt(checkIds[i], "setBackgroundResource", R.drawable.widget_checkbox_checked);
            views.setTextViewText(checkIds[i], "✓");
            views.setTextColor(checkIds[i], Color.parseColor("#FFFFFF"));
          } else {
            views.setTextViewText(titleIds[i], h.title);
            views.setTextColor(titleIds[i], Color.parseColor("#F1F5F9"));

            views.setInt(checkIds[i], "setBackgroundResource", R.drawable.widget_checkbox_bg);
            views.setTextViewText(checkIds[i], "");
          }

          views.setTextViewText(streakIds[i], h.streakCount > 0 ? (h.streakCount + "d 🔥") : "0d");

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
        } else {
          views.setViewVisibility(rowIds[i], View.GONE);
        }
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
