package com.hardik.momentum;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.hardik.momentum.widget.WidgetBridgePlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(WidgetBridgePlugin.class);
    super.onCreate(savedInstanceState);
    handleWidgetIntent(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    handleWidgetIntent(intent);
  }

  private void handleWidgetIntent(Intent intent) {
    if (intent == null) return;
    String action = intent.getStringExtra("widget_action");
    if (action != null && !action.isEmpty()) {
      WidgetBridgePlugin.setPendingAction(this, action);
      return;
    }
    String intentAction = intent.getAction();
    if ("com.hardik.momentum.ACTION_QUICK_ADD_TASK".equals(intentAction)) {
      WidgetBridgePlugin.setPendingAction(this, "quick_add_task");
    } else if ("com.hardik.momentum.ACTION_QUICK_ADD_GOAL".equals(intentAction)) {
      WidgetBridgePlugin.setPendingAction(this, "quick_add_goal");
    } else if ("com.hardik.momentum.ACTION_QUICK_ADD_HABIT".equals(intentAction)) {
      WidgetBridgePlugin.setPendingAction(this, "quick_add_habit");
    } else if ("com.hardik.momentum.ACTION_QUICK_ADD".equals(intentAction)) {
      WidgetBridgePlugin.setPendingAction(this, "quick_add");
    }

    String pinWidget = intent.getStringExtra("pin_widget");
    if (pinWidget != null && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      android.appwidget.AppWidgetManager manager = getSystemService(android.appwidget.AppWidgetManager.class);
      if (manager != null && manager.isRequestPinAppWidgetSupported()) {
        android.content.ComponentName provider = null;
        if ("today".equalsIgnoreCase(pinWidget)) {
          provider = new android.content.ComponentName(this, com.hardik.momentum.widget.TodayWidgetProvider.class);
        } else if ("velocity".equalsIgnoreCase(pinWidget) || "bento".equalsIgnoreCase(pinWidget)) {
          provider = new android.content.ComponentName(this, com.hardik.momentum.widget.BentoStatsWidgetProvider.class);
        } else if ("quick".equalsIgnoreCase(pinWidget) || "capture".equalsIgnoreCase(pinWidget)) {
          provider = new android.content.ComponentName(this, com.hardik.momentum.widget.QuickActionsWidgetProvider.class);
        } else if ("routine".equalsIgnoreCase(pinWidget) || "habits".equalsIgnoreCase(pinWidget)) {
          provider = new android.content.ComponentName(this, com.hardik.momentum.widget.HabitWidgetProvider.class);
        } else if ("pill".equalsIgnoreCase(pinWidget) || "upcoming".equalsIgnoreCase(pinWidget)) {
          provider = new android.content.ComponentName(this, com.hardik.momentum.widget.UpcomingPillWidgetProvider.class);
        }
        if (provider != null) {
          manager.requestPinAppWidget(provider, null, null);
        }
      }
    }
  }
}
