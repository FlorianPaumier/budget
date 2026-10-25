package com.household.budget.reminders

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.household.budget.MainActivity

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val key = intent.getStringExtra("key") ?: return
        val keys = context.getSharedPreferences("reminder_schedule", Context.MODE_PRIVATE).getStringSet("keys", emptySet()).orEmpty()
        if (key !in keys) return
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("budget_due", "Budget reminders", NotificationManager.IMPORTANCE_DEFAULT))
        val openApp = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = Notification.Builder(context, "budget_due")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(intent.getStringExtra("name") ?: "Budget item")
            .setContentText(if (intent.getBooleanExtra("dueToday", false)) "À régler aujourd’hui" else "Due tomorrow")
            .setContentIntent(openApp)
            .setAutoCancel(true)
            .build()
        manager.notify(key, 0, notification)
    }
}
