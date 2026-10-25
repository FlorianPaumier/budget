package com.household.budget.ui

import org.json.JSONObject
import java.math.BigDecimal
import java.time.LocalDate
import java.time.format.DateTimeParseException
import java.util.UUID

enum class EntryKind(val wireValue: String, val label: String) {
    INCOME("income", "Revenu"), EXPENSE("expense", "Dépense"),
    CATEGORY_ADJUSTMENT("category_adjustment", "Ajustement de catégorie"),
    SAVINGS_TRANSFER("savings_transfer", "Transfert d’épargne"),
    BALANCE_ADJUSTMENT("balance_adjustment", "Ajustement de solde"),
}
enum class EntryAccount(val wireValue: String, val label: String) {
    SPENDABLE("spendable", "Disponible"), SAVINGS("savings", "Épargne")
}
data class EntryDraft(
    val kind: EntryKind, val entryDate: String, val amountCad: String,
    val categoryId: String? = null, val account: EntryAccount? = null, val note: String = "",
)
data class EntryValidation(val errors: Map<String, String>) {
    val isValid: Boolean get() = errors.isEmpty()
}

fun parseCadCents(raw: String): Long? {
    if (!Regex("^-?\\d+(?:[.,]\\d{1,2})?$").matches(raw.trim())) return null
    return try { BigDecimal(raw.trim().replace(',', '.')).movePointRight(2).longValueExact() }
    catch (_: ArithmeticException) { null }
    catch (_: NumberFormatException) { null }
}

fun validateEntryDraft(draft: EntryDraft): EntryValidation {
    val errors = mutableMapOf<String, String>()
    try { LocalDate.parse(draft.entryDate) }
    catch (_: DateTimeParseException) { errors["entryDate"] = "Choisissez une date valide." }
    val cents = parseCadCents(draft.amountCad)
    if (cents == null || cents !in -9007199254740991L..9007199254740991L || cents == 0L ||
        (cents < 0 && draft.kind !in setOf(EntryKind.SAVINGS_TRANSFER, EntryKind.BALANCE_ADJUSTMENT))) {
        errors["amountCad"] = "Saisissez un montant non nul, avec au plus deux décimales."
    }
    if (draft.kind in setOf(EntryKind.EXPENSE, EntryKind.CATEGORY_ADJUSTMENT) && draft.categoryId == null) {
        errors["categoryId"] = "Choisissez une catégorie."
    }
    if (draft.categoryId != null) {
        try { UUID.fromString(draft.categoryId) }
        catch (_: IllegalArgumentException) { errors["categoryId"] = "Cette catégorie n’est pas valide." }
    }
    if (draft.kind == EntryKind.SAVINGS_TRANSFER && draft.categoryId != null) {
        errors["categoryId"] = "Un transfert ne peut pas avoir de catégorie."
    }
    if (draft.kind == EntryKind.BALANCE_ADJUSTMENT && draft.account == null) {
        errors["account"] = "Choisissez un compte."
    }
    if (draft.kind != EntryKind.BALANCE_ADJUSTMENT && draft.account != null) {
        errors["account"] = "Le compte est réservé aux ajustements de solde."
    }
    if (draft.note.length > 500) errors["note"] = "Limitez la description à 500 caractères."
    return EntryValidation(errors)
}

fun entryDraftToJson(draft: EntryDraft): JSONObject {
    require(validateEntryDraft(draft).isValid) { "Invalid entry draft" }
    return JSONObject().apply {
        put("kind", draft.kind.wireValue)
        put("entryDate", draft.entryDate)
        put("amountCents", parseCadCents(draft.amountCad))
        draft.categoryId?.let { put("categoryId", it) }
        draft.account?.let { put("account", it.wireValue) }
        if (draft.note.isNotEmpty()) put("note", draft.note)
    }
}
