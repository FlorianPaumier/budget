package com.household.budget.reminders

import android.Manifest
import android.app.Application
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf

@RunWith(RobolectricTestRunner::class)
class ReminderReceiverTest {
    private lateinit var app: Application
    private lateinit var notifications: NotificationManager
    @Before fun setup() {
        app = ApplicationProvider.getApplicationContext()
        notifications = app.getSystemService(NotificationManager::class.java)
        shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
        app.getSharedPreferences("reminder_schedule", Context.MODE_PRIVATE).edit().clear().commit()
    }
    @Test fun `cached pending reminder posts named due day notification`() {
        app.getSharedPreferences("reminder_schedule", Context.MODE_PRIVATE).edit().putStringSet("keys", setOf("rent:due")).commit()
        ReminderReceiver().onReceive(app, Intent().putExtra("key", "rent:due").putExtra("name", "Rent").putExtra("dueToday", true))
        val posted = shadowOf(notifications).allNotifications
        assertEquals(1, posted.size)
        assertEquals("Rent", posted.single().extras.getCharSequence("android.title"))
        assertEquals("À régler aujourd’hui", posted.single().extras.getCharSequence("android.text"))
    }
    @Test fun `a stale cancelled alarm does not post a notification`() {
        ReminderReceiver().onReceive(app, Intent().putExtra("key", "rent:due").putExtra("name", "Rent").putExtra("dueToday", true))
        assertEquals(0, shadowOf(notifications).allNotifications.size)
    }
}
