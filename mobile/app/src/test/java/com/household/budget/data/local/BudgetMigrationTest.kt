package com.household.budget.data.local

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class BudgetMigrationTest {
    @Test fun originalVersionOneDataSurvivesAddingMonthSnapshots() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val name = "old-budget.db"
        context.deleteDatabase(name)
        val old = context.openOrCreateDatabase(name, Context.MODE_PRIVATE, null)
        val statements = javaClass.classLoader!!.getResourceAsStream("original-v1-schema.sql")!!
            .bufferedReader().use { it.readLines() }
        statements.filter { it.isNotBlank() }.forEach(old::execSQL)
        old.execSQL("INSERT INTO categories (id, name, active, revision, deletedAt) VALUES ('cat-1', 'Food', 1, 1, NULL)")
        old.version = 1
        old.close()

        val migrated = Room.databaseBuilder(context, BudgetDatabase::class.java, name)
            .addMigrations(MIGRATION_1_2, MIGRATION_2_3).build()
        try {
            assertEquals("Food", migrated.budgetDao().getCategory("cat-1")?.name)
            migrated.budgetDao().upsertMonthSnapshot(MonthSnapshotEntity("2026-10", "2026-10-05", "{}", "{}", "{}"))
            assertNotNull(migrated.budgetDao().getMonthSnapshot("2026-10"))
            migrated.budgetDao().upsertCache(CacheDocumentEntity("history:entry", "{\"data\":[]}"))
            assertEquals("{\"data\":[]}", migrated.budgetDao().getCache("history:entry")?.payloadJson)
        } finally {
            migrated.close()
            context.deleteDatabase(name)
        }
    }
}
