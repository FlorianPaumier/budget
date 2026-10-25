package com.household.budget.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.time.Instant

/** Alarms do not survive reboot; restore the last locally computed schedule without HTTP. */
class ReminderRestoreReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action !in setOf(Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_TIME_CHANGED,
                Intent.ACTION_TIMEZONE_CHANGED, Intent.ACTION_MY_PACKAGE_REPLACED,
                "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED")) return
        ReminderScheduler(context).restore(Instant.now())
    }
}
