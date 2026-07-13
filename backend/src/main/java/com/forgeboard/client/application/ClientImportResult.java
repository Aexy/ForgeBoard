package com.forgeboard.client.application;

import java.util.List;

/** Result used for both a non-mutating preview and a committed client import. */
public record ClientImportResult(boolean dryRun, int totalRows, int validRows, int importedRows,
        List<ClientImportRow> rows) {
    public boolean readyToCommit() { return totalRows > 0 && validRows == totalRows; }
}
