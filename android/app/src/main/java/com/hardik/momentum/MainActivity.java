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
    if ("quick_add".equals(action) || "com.hardik.momentum.ACTION_QUICK_ADD".equals(intent.getAction())) {
      WidgetBridgePlugin.setPendingAction(this, "quick_add");
    }
  }
}
