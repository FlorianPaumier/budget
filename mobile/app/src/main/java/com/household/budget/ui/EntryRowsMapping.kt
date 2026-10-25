package com.household.budget.ui

import com.household.budget.data.local.LedgerEntryEntity
import com.household.budget.data.local.PendingOperationEntity

fun entryRowsFromCache(
    entries: List<LedgerEntryEntity>,
    categories: List<EntryCategory>,
    pending: List<PendingOperationEntity>,
): List<EntryRow> {
    val categoryNames = categories.associate { it.id to it.name }
    val pendingIds = pending.filter { it.entityType == "ledger_entry" }
        .mapTo(mutableSetOf()) { it.entityId }
    return entries.filter { it.deletedAt == null }.mapNotNull { entry ->
        val kind = EntryKind.entries.firstOrNull { it.wireValue == entry.kind } ?: return@mapNotNull null
        val isPending = entry.id in pendingIds
        EntryRow(
            id = entry.id,
            entryDate = entry.entryDate,
            kind = kind,
            amountCents = entry.amountCents,
            categoryName = entry.categoryId?.let(categoryNames::get),
            note = entry.note,
            pending = isPending,
            canCorrect = entry.occurrenceId == null && !isPending,
        )
    }
}
