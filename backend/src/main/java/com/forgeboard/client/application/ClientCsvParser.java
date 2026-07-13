package com.forgeboard.client.application;

import java.util.ArrayList;
import java.util.List;

/** Small RFC 4180-compatible parser for the limited client import format. */
final class ClientCsvParser {
    private ClientCsvParser() {}

    static List<List<String>> parse(String csv) {
        if (csv == null || csv.isBlank()) throw new ClientImportValidationException("CSV content is required");
        List<List<String>> records = new ArrayList<>();
        List<String> record = new ArrayList<>();
        StringBuilder value = new StringBuilder();
        boolean quoted = false;

        for (int i = 0; i < csv.length(); i++) {
            char character = csv.charAt(i);
            if (quoted) {
                if (character == '"') {
                    if (i + 1 < csv.length() && csv.charAt(i + 1) == '"') { value.append('"'); i++; }
                    else quoted = false;
                } else value.append(character);
                continue;
            }
            if (character == '"') {
                if (value.length() != 0) throw new ClientImportValidationException("Unexpected quote in CSV field");
                quoted = true;
            } else if (character == ',') {
                record.add(value.toString()); value.setLength(0);
            } else if (character == '\n' || character == '\r') {
                if (character == '\r' && i + 1 < csv.length() && csv.charAt(i + 1) == '\n') i++;
                record.add(value.toString()); value.setLength(0);
                records.add(record); record = new ArrayList<>();
            } else value.append(character);
        }
        if (quoted) throw new ClientImportValidationException("Unclosed quoted CSV field");
        if (value.length() > 0 || !record.isEmpty()) { record.add(value.toString()); records.add(record); }
        return records;
    }
}
