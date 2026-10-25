package com.household.budget.reminders

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

/** Replaces pending alarms from the local occurrence cache; never needs network access. */
class ReminderScheduler(private val context: Context) {
    private val alarms = context.getSystemService(AlarmManager::class.java)
    private val preferences = context.getSharedPreferences("reminder_schedule", Context.MODE_PRIVATE)

    fun restore(now: java.time.Instant): Boolean {
        val cached = org.json.JSONArray(preferences.getString("schedule", "[]"))
        val reminders = (0 until cached.length()).map { index ->
            val item = cached.getJSONObject(index)
            ScheduledReminder(item.getString("key"), java.time.Instant.parse(item.getString("at")), item.getString("name"), item.getBoolean("dueToday"))
        }.filter { it.at.isAfter(now) }
        return replace(reminders)
    }

    fun replace(reminders: List<ScheduledReminder>): Boolean {
        preferences.getStringSet("keys", emptySet()).orEmpty().forEach { key ->
            alarms.cancel(pendingIntent(key))
            context.getSystemService(android.app.NotificationManager::class.java).cancel(key, 0)
        }
        val cached = org.json.JSONArray()
        reminders.forEach { reminder -> cached.put(org.json.JSONObject().put("key", reminder.key).put("at", reminder.at.toString()).put("name", reminder.name).put("dueToday", reminder.dueToday)) }
        preferences.edit().remove("keys").putString("schedule", cached.toString()).commit()
        if (reminders.isNotEmpty() && Build.VERSION.SDK_INT >= 31 && !alarms.canScheduleExactAlarms()) return false
        reminders.forEach { reminder ->
            alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reminder.at.toEpochMilli(), pendingIntent(reminder.key, reminder))
        }
        preferences.edit().putStringSet("keys", reminders.map { it.key }.toSet()).commit()
        return true
    }

    private fun pendingIntent(key: String, reminder: ScheduledReminder? = null): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java)
            .setData(Uri.Builder().scheme("budget-reminder").authority("notification").appendPath(key).build())
            .putExtra("key", key)
        reminder?.let { intent.putExtra("name", it.name).putExtra("dueToday", it.dueToday) }
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
}
