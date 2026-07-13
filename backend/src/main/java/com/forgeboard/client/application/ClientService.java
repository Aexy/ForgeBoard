package com.forgeboard.client.application;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.HashSet;
import java.util.ArrayList;
import java.util.Set;
import java.util.UUID;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.forgeboard.client.domain.ClientAccount;
import com.forgeboard.client.persistence.ClientRepository;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.SelectedTenant;

@Service
public class ClientService {
    private final ClientRepository clients;
    private final ActivityRecorder activity;
    private final Clock clock;

    public ClientService(ClientRepository clients, ActivityRecorder activity, Clock clock) {
        this.clients = clients;
        this.activity = activity;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ClientView> list(SelectedTenant tenant) {
        return clients.findAllByFirmIdOrderByDisplayNameAsc(tenant.firmId()).stream().map(this::view).toList();
    }

    @Transactional(readOnly = true)
    public ClientView get(SelectedTenant tenant, UUID clientId) { return view(requireClient(tenant, clientId)); }

    @Transactional
    public ClientView create(SelectedTenant tenant, ClientRequest request) {
        requireWrite(tenant);
        ClientAccount client = new ClientAccount(UUID.randomUUID(), tenant.firmId(), request.legalName().strip(),
                request.displayName().strip(), normalizeEmail(request.primaryEmail()), clock.instant());
        clients.save(client);
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "client.created", "client", client.id(),
                Map.of("displayName", client.displayName()));
        return view(client);
    }

    /**
     * Imports the supported {@code legalName,displayName,primaryEmail} format. A preview never
     * writes; a commit is all-or-nothing so users can correct every reported row first.
     */
    @Transactional
    public ClientImportResult importCsv(SelectedTenant tenant, String csv, boolean dryRun) {
        requireWrite(tenant);
        List<ClientImportRow> rows = validateImport(csv, tenant.firmId());
        int validRows = (int) rows.stream().filter(ClientImportRow::valid).count();
        if (dryRun || validRows != rows.size()) return new ClientImportResult(dryRun, rows.size(), validRows, 0, rows);

        Instant now = clock.instant();
        List<ClientAccount> imported = rows.stream().map(row -> new ClientAccount(UUID.randomUUID(), tenant.firmId(),
                row.legalName(), row.displayName(), row.primaryEmail(), now)).toList();
        clients.saveAll(imported);
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "client.imported", "client-import", tenant.firmId(),
                Map.of("importedCount", imported.size()));
        return new ClientImportResult(false, rows.size(), validRows, imported.size(), rows);
    }

    @Transactional
    public ClientView update(SelectedTenant tenant, UUID clientId, ClientRequest request) {
        requireWrite(tenant);
        ClientAccount client = requireClient(tenant, clientId);
        client.update(request.legalName().strip(), request.displayName().strip(),
                normalizeEmail(request.primaryEmail()), clock.instant());
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "client.updated", "client", client.id(),
                Map.of("displayName", client.displayName()));
        return view(client);
    }

    @Transactional
    public ClientView archive(SelectedTenant tenant, UUID clientId) {
        requireWrite(tenant);
        ClientAccount client = requireClient(tenant, clientId);
        client.archive(clock.instant());
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "client.archived", "client", client.id(), Map.of());
        return view(client);
    }

    private ClientAccount requireClient(SelectedTenant tenant, UUID clientId) {
        return clients.findByIdAndFirmId(clientId, tenant.firmId()).orElseThrow(ClientNotFoundException::new);
    }

    private void requireWrite(SelectedTenant tenant) {
        if (!tenant.canWrite()) throw new AccessDeniedException("Read-only members cannot change clients");
    }

    private List<ClientImportRow> validateImport(String csv, UUID firmId) {
        List<List<String>> records = ClientCsvParser.parse(csv);
        if (records.isEmpty()) throw new ClientImportValidationException("CSV header is required");
        List<String> header = records.getFirst();
        if (header.size() != 3 || !"legalName".equals(stripBom(header.get(0)))
                || !"displayName".equals(header.get(1)) || !"primaryEmail".equals(header.get(2))) {
            throw new ClientImportValidationException("CSV header must be: legalName,displayName,primaryEmail");
        }
        Set<String> existingEmails = new HashSet<>();
        Set<String> existingNames = new HashSet<>();
        clients.findAllByFirmIdOrderByDisplayNameAsc(firmId).forEach(client -> {
            if (client.primaryEmail() != null) existingEmails.add(normalizeEmail(client.primaryEmail()));
            existingNames.add(client.legalName().strip().toLowerCase(Locale.ROOT));
        });
        Set<String> importEmails = new HashSet<>();
        Set<String> importNames = new HashSet<>();
        List<ClientImportRow> result = new ArrayList<>();
        for (int recordIndex = 1; recordIndex < records.size(); recordIndex++) {
            List<String> record = records.get(recordIndex);
            List<String> errors = new ArrayList<>();
            if (record.size() != 3) {
                errors.add("Expected 3 columns");
                result.add(new ClientImportRow(recordIndex + 1, null, null, null, errors));
                continue;
            }
            String legalName = record.get(0).strip();
            String displayName = record.get(1).strip();
            String email = normalizeEmail(record.get(2));
            if (legalName.isBlank()) errors.add("legalName is required");
            else if (legalName.length() > 200) errors.add("legalName must be 200 characters or fewer");
            if (displayName.isBlank()) errors.add("displayName is required");
            else if (displayName.length() > 160) errors.add("displayName must be 160 characters or fewer");
            if (email != null && (email.length() > 320 || !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"))) errors.add("primaryEmail is invalid");
            String nameKey = legalName.toLowerCase(Locale.ROOT);
            if (!legalName.isBlank() && (!importNames.add(nameKey) || existingNames.contains(nameKey))) errors.add("Duplicate legalName");
            if (email != null && (!importEmails.add(email) || existingEmails.contains(email))) errors.add("Duplicate primaryEmail");
            result.add(new ClientImportRow(recordIndex + 1, legalName, displayName, email, List.copyOf(errors)));
        }
        return List.copyOf(result);
    }

    private String stripBom(String value) { return value.startsWith("\uFEFF") ? value.substring(1) : value; }

    private String normalizeEmail(String email) {
        return email == null || email.isBlank() ? null : email.strip().toLowerCase(Locale.ROOT);
    }

    private ClientView view(ClientAccount client) {
        return new ClientView(client.id(), client.legalName(), client.displayName(),
                client.primaryEmail(), client.status(), client.version());
    }
}
