package com.forgeboard.client.application;

import java.util.List;

/** One CSV data row together with any validation errors found before persistence. */
public record ClientImportRow(int rowNumber, String legalName, String displayName,
        String primaryEmail, List<String> errors) {
    public boolean valid() { return errors.isEmpty(); }
}
