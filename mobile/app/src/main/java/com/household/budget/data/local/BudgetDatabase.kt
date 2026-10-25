package com.household.budget.data.local

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

/** Calendar dates and months are stored as ISO strings; timestamps as UTC ISO strings; money as CAD cents. */
@Entity(tableName = "household")
data class HouseholdEntity(
    @PrimaryKey val id: String,
    val currency: String,
    val timeZone: String,
    val reminderTime: String,
    val openingSpendableCents: Long,
    val openingSavingsCents: Long,
    val openingDate: String,
    val monthlySavingsTargetCents: Long?,
    val revision: Long,
)

@Entity(tableName = "categories")
data class CategoryEntity(
    @PrimaryKey val id: String,
    val name: String,
    val active: Boolean,
    val revision: Long,
    val deletedAt: String?,
)

@Entity(tableName = "ledger_entries", indices = [Index("entryDate"), Index("categoryId")])
data class LedgerEntryEntity(
    @PrimaryKey val id: String,
    val kind: String,
    val entryDate: String,
    val amountCents: Long,
    val categoryId: String?,
    val account: String?,
    val note: String?,
    val occurrenceId: String?,
    val revision: Long,
    val deletedAt: String?,
)

@Entity(tableName = "monthly_estimates", indices = [Index("month"), Index(value = ["month", "categoryId"], unique = true)])
data class MonthlyEstimateEntity(
    @PrimaryKey val id: String,
    val categoryId: String,
    val month: String,
    val amountCents: Long,
    val revision: Long,
    val deletedAt: String?,
)

@Entity(tableName = "monthly_plans", indices = [Index(value = ["month"], unique = true)])
data class MonthlyPlanEntity(
    @PrimaryKey val id: String,
    val month: String,
    val savingsTargetCents: Long?,
    val revision: Long,
    val deletedAt: String?,
)

@Entity(tableName = "recurring_rules", indices = [Index("startsOn")])
data class RecurringRuleEntity(
    @PrimaryKey val id: String,
    val kind: String,
    val name: String,
    val categoryId: String?,
    val amountCents: Long,
    val frequency: String,
    val interval: Int,
    val startsOn: String,
    val endsOn: String?,
    /** JSON representation of scheduleDetails, including null when absent. */
    val scheduleDetailsJson: String?,
    val active: Boolean,
    val revision: Long,
    val deletedAt: String?,
)

@Entity(tableName = "occurrences", indices = [Index("expectedDate"), Index("ruleId")])
data class OccurrenceEntity(
    @PrimaryKey val id: String,
    val ruleId: String,
    val ruleName: String,
    val ruleKind: String,
    val expectedDate: String,
    val expectedAmountCents: Long,
    val status: String,
    val actualDate: String?,
    val actualAmountCents: Long?,
    val confirmationMethod: String?,
    val needsReview: Boolean,
    val revision: Long,
    val deletedAt: String?,
)

@Entity(tableName = "devices")
data class DeviceEntity(
    @PrimaryKey val id: String,
    val label: String,
    val pairedAt: String,
    val revokedAt: String?,
)

/** Cached server-computed month figures, kept separately from user-editable records. */
@Entity(tableName = "month_snapshots")
data class MonthSnapshotEntity(
    @PrimaryKey val month: String,
    val asOf: String,
    val planJson: String,
    val actualsJson: String,
    val balancesJson: String,
)

/** Cursor is opaque even when the current server encodes it as a decimal string. */
@Entity(tableName = "sync_state")
data class SyncStateEntity(
    @PrimaryKey val householdId: String,
    val cursor: String,
)

/** `valueJson` is the typed operation value from the API; operationId is never regenerated on retry. */
@Entity(tableName = "pending_operations", indices = [Index("createdAt")])
data class PendingOperationEntity(
    @PrimaryKey val operationId: String,
    val entityId: String,
    val entityType: String,
    val action: String,
    val baseRevision: Long,
    val valueJson: String?,
    val createdAt: String,
    val state: String = "pending",
    val errorCode: String? = null,
)

/** Server and proposed payloads are preserved verbatim so a user can inspect and resolve the conflict. */
@Entity(tableName = "sync_conflicts", indices = [Index("entityId")])
data class SyncConflictEntity(
    @PrimaryKey val id: String,
    val entityType: String,
    val entityId: String,
    val serverValueJson: String?,
    val proposedValueJson: String,
    val createdAt: String,
)

@Entity(tableName = "cache_documents")
data class CacheDocumentEntity(@PrimaryKey val key: String, val payloadJson: String)

@Dao
interface BudgetDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsertCache(value: CacheDocumentEntity)
    @Query("SELECT * FROM cache_documents WHERE `key` = :key") fun observeCache(key: String): Flow<CacheDocumentEntity?>
    @Query("SELECT * FROM cache_documents WHERE `key` LIKE :prefix || '%'") fun observeCaches(prefix: String): Flow<List<CacheDocumentEntity>>
    @Query("SELECT * FROM cache_documents WHERE `key` = :key") suspend fun getCache(key: String): CacheDocumentEntity?
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsertHousehold(value: HouseholdEntity)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsertCategories(values: List<CategoryEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsertEntries(values: List<LedgerEntryEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsertEstimates(values: List<MonthlyEstimateEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsertPlans(values: List<MonthlyPlanEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsertRules(values: List<RecurringRuleEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsertOccurrences(values: List<OccurrenceEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsertMonthSnapshot(value: MonthSnapshotEntity)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsertDevices(values: List<DeviceEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsertSyncState(value: SyncStateEntity)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsertPending(value: PendingOperationEntity)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsertConflicts(values: List<SyncConflictEntity>)

    @Query("SELECT * FROM household LIMIT 1") fun observeHousehold(): Flow<HouseholdEntity?>
    @Query("SELECT * FROM categories WHERE deletedAt IS NULL ORDER BY name") fun observeCategories(): Flow<List<CategoryEntity>>
    @Query("SELECT * FROM ledger_entries WHERE deletedAt IS NULL AND entryDate BETWEEN :from AND :through ORDER BY entryDate DESC, id") fun observeEntries(from: String, through: String): Flow<List<LedgerEntryEntity>>
    @Query("SELECT * FROM monthly_estimates WHERE deletedAt IS NULL AND month = :month ORDER BY categoryId") fun observeEstimates(month: String): Flow<List<MonthlyEstimateEntity>>
    @Query("SELECT * FROM monthly_plans WHERE deletedAt IS NULL AND month = :month LIMIT 1") fun observePlan(month: String): Flow<MonthlyPlanEntity?>
    @Query("SELECT * FROM pending_operations ORDER BY createdAt, operationId") fun observePendingOperations(): Flow<List<PendingOperationEntity>>
    @Query("SELECT * FROM recurring_rules WHERE deletedAt IS NULL ORDER BY startsOn, id") fun observeRules(): Flow<List<RecurringRuleEntity>>
    @Query("SELECT * FROM recurring_rules WHERE deletedAt IS NULL AND active = 1 ORDER BY startsOn, id") fun observeActiveRules(): Flow<List<RecurringRuleEntity>>
    @Query("SELECT * FROM occurrences WHERE deletedAt IS NULL AND expectedDate BETWEEN :from AND :through ORDER BY expectedDate, id") fun observeOccurrences(from: String, through: String): Flow<List<OccurrenceEntity>>
    @Query("SELECT * FROM month_snapshots WHERE month = :month") fun observeMonthSnapshot(month: String): Flow<MonthSnapshotEntity?>
    @Query("SELECT * FROM month_snapshots WHERE month = :month") suspend fun getMonthSnapshot(month: String): MonthSnapshotEntity?
    @Query("SELECT * FROM occurrences WHERE id = :id") suspend fun getOccurrence(id: String): OccurrenceEntity?
    @Query("SELECT * FROM recurring_rules WHERE id = :id") suspend fun getRule(id: String): RecurringRuleEntity?
    @Query("SELECT * FROM ledger_entries WHERE id = :id") suspend fun getEntry(id: String): LedgerEntryEntity?
    @Query("SELECT * FROM devices ORDER BY pairedAt") fun observeDevices(): Flow<List<DeviceEntity>>
    @Query("SELECT * FROM sync_conflicts ORDER BY createdAt") fun observeConflicts(): Flow<List<SyncConflictEntity>>
    @Query("SELECT COUNT(*) FROM pending_operations WHERE state = 'conflict'") suspend fun countConflictedPending(): Int
    @Query("SELECT * FROM pending_operations WHERE state = 'pending' ORDER BY createdAt, operationId LIMIT :limit") suspend fun pendingBatch(limit: Int = 100): List<PendingOperationEntity>
    @Query("SELECT * FROM categories WHERE id = :id") suspend fun getCategory(id: String): CategoryEntity?
    @Query("SELECT * FROM sync_conflicts WHERE id = :id") suspend fun getConflict(id: String): SyncConflictEntity?
    @Query("SELECT * FROM pending_operations WHERE operationId = :id") suspend fun getPending(id: String): PendingOperationEntity?
    @Query("SELECT * FROM monthly_estimates WHERE id = :id") suspend fun getEstimate(id: String): MonthlyEstimateEntity?
    @Query("SELECT * FROM monthly_plans WHERE id = :id") suspend fun getPlan(id: String): MonthlyPlanEntity?
    @Query("SELECT * FROM household WHERE id = :id") suspend fun getHousehold(id: String): HouseholdEntity?
    @Query("SELECT * FROM sync_state WHERE householdId = :householdId") suspend fun syncState(householdId: String): SyncStateEntity?
    @Query("UPDATE pending_operations SET state = 'blocked' WHERE entityId = :entityId AND state = 'pending'") suspend fun blockPendingEntity(entityId: String)
    @Query("UPDATE pending_operations SET baseRevision = :revision WHERE entityId = :entityId AND state = 'pending'") suspend fun rebasePendingEntity(entityId: String, revision: Long)
    @Query("UPDATE pending_operations SET entityId = :targetId, baseRevision = :revision, state = 'pending', errorCode = NULL WHERE entityId = :entityId AND state = 'blocked'") suspend fun releasePendingEntity(entityId: String, targetId: String, revision: Long)
    @Query("UPDATE pending_operations SET state = 'rejected', errorCode = 'ENTITY_DELETED' WHERE entityId = :entityId AND state = 'blocked'") suspend fun rejectBlockedEntity(entityId: String)
    @Query("UPDATE pending_operations SET state = 'pending', errorCode = NULL, baseRevision = CASE WHEN action = 'create' THEN 0 ELSE 9007199254740991 END WHERE state IN ('pending', 'blocked', 'conflict')") suspend fun resetPendingAfterRestore()
    @Query("UPDATE pending_operations SET state = 'pending' WHERE state = 'blocked' AND entityId IN (SELECT entityId FROM pending_operations WHERE state = 'rejected' AND errorCode = 'OPERATION_FAILED')") suspend fun retryTemporaryFailureDependents()
    @Query("UPDATE pending_operations SET state = 'pending', errorCode = NULL WHERE state = 'rejected' AND errorCode = 'OPERATION_FAILED'") suspend fun retryTemporaryFailures()
    @Query("SELECT COUNT(*) FROM pending_operations WHERE entityId = :entityId AND state = 'pending'") suspend fun countPendingForEntity(entityId: String): Int
    @Query("UPDATE pending_operations SET state = :state, errorCode = :errorCode WHERE operationId = :operationId") suspend fun setPendingState(operationId: String, state: String, errorCode: String?)
    @Query("DELETE FROM pending_operations WHERE operationId = :operationId") suspend fun deletePending(operationId: String)
    @Query("DELETE FROM sync_conflicts WHERE id = :id") suspend fun deleteConflict(id: String)

    // Tombstones are retained as rows where the wire type has a deletedAt field.
    // Occurrences, rules, and plans have no public deletedAt field but still need local tombstones.
    @Query("UPDATE categories SET deletedAt = :deletedAt, revision = :revision WHERE id = :id") suspend fun tombstoneCategory(id: String, revision: Long, deletedAt: String)
    @Query("UPDATE ledger_entries SET deletedAt = :deletedAt, revision = :revision WHERE id = :id") suspend fun tombstoneEntry(id: String, revision: Long, deletedAt: String)
    @Query("UPDATE monthly_estimates SET deletedAt = :deletedAt, revision = :revision WHERE id = :id") suspend fun tombstoneEstimate(id: String, revision: Long, deletedAt: String)
    @Query("UPDATE monthly_plans SET deletedAt = :deletedAt, revision = :revision WHERE id = :id") suspend fun tombstonePlan(id: String, revision: Long, deletedAt: String)
    @Query("UPDATE recurring_rules SET deletedAt = :deletedAt, revision = :revision WHERE id = :id") suspend fun tombstoneRule(id: String, revision: Long, deletedAt: String)
    @Query("UPDATE occurrences SET deletedAt = :deletedAt, revision = :revision WHERE id = :id") suspend fun tombstoneOccurrence(id: String, revision: Long, deletedAt: String)
}

@Database(
    entities = [HouseholdEntity::class, CategoryEntity::class, LedgerEntryEntity::class,
        MonthlyEstimateEntity::class, MonthlyPlanEntity::class, RecurringRuleEntity::class,
        OccurrenceEntity::class, DeviceEntity::class, MonthSnapshotEntity::class, SyncStateEntity::class,
        PendingOperationEntity::class, SyncConflictEntity::class, CacheDocumentEntity::class],
    version = 3,
    exportSchema = true,
)
abstract class BudgetDatabase : RoomDatabase() {
    abstract fun budgetDao(): BudgetDao
}
