package com.household.budget.data.local

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/** Add cached month figures without discarding pre-upgrade edits or records. */
val MIGRATION_1_2: Migration = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("""CREATE TABLE IF NOT EXISTS `month_snapshots` (`month` TEXT NOT NULL, `asOf` TEXT NOT NULL, `planJson` TEXT NOT NULL, `actualsJson` TEXT NOT NULL, `balancesJson` TEXT NOT NULL, PRIMARY KEY(`month`))""")
    }
}

val MIGRATION_2_3: Migration = object : Migration(2, 3) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("CREATE TABLE IF NOT EXISTS `cache_documents` (`key` TEXT NOT NULL, `payloadJson` TEXT NOT NULL, PRIMARY KEY(`key`))")
    }
}
