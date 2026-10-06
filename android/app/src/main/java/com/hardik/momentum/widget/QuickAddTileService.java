package com.hardik.momentum.widget;

import android.content.Intent;
import android.service.quicksettings.TileService;
import com.hardik.momentum.MainActivity;

public class QuickAddTileService extends TileService {
    @Override
    public void onClick() {
        super.onClick();
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction("com.hardik.momentum.ACTION_QUICK_ADD");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivityAndCollapse(intent);
    }
}
