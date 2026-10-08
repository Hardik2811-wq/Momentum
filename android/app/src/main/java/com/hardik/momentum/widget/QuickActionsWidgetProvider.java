package com.hardik.momentum.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import com.hardik.momentum.MainActivity;
import com.hardik.momentum.R;

public class QuickActionsWidgetProvider extends AppWidgetProvider {

  public static void refresh(Context context) {
    if (context == null) return;
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    ComponentName component = new ComponentName(context, QuickActionsWidgetProvider.class);
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
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_actions);

    // 1. Task / Schedule Add Intent
    Intent taskIntent = new Intent(context, MainActivity.class);
    taskIntent.setAction("com.hardik.momentum.ACTION_QUICK_ADD_TASK");
    taskIntent.putExtra("widget_action", "quick_add_task");
    taskIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent taskPI = PendingIntent.getActivity(
        context,
        101,
        taskIntent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    views.setOnClickPendingIntent(R.id.btn_quick_add_task, taskPI);

    // 2. Goal Add Intent
    Intent goalIntent = new Intent(context, MainActivity.class);
    goalIntent.setAction("com.hardik.momentum.ACTION_QUICK_ADD_GOAL");
    goalIntent.putExtra("widget_action", "quick_add_goal");
    goalIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent goalPI = PendingIntent.getActivity(
        context,
        102,
        goalIntent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    views.setOnClickPendingIntent(R.id.btn_quick_add_goal, goalPI);

    // 3. Habit Add Intent
    Intent habitIntent = new Intent(context, MainActivity.class);
    habitIntent.setAction("com.hardik.momentum.ACTION_QUICK_ADD_HABIT");
    habitIntent.putExtra("widget_action", "quick_add_habit");
    habitIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent habitPI = PendingIntent.getActivity(
        context,
        103,
        habitIntent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    views.setOnClickPendingIntent(R.id.btn_quick_add_habit, habitPI);

    appWidgetManager.updateAppWidget(appWidgetId, views);
  }
}
