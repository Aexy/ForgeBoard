package com.forgeboard.identity;

import java.util.UUID;
import java.util.List;

import org.springframework.stereotype.Service;

import com.forgeboard.identity.persistence.FirmRepository;

/** Public identity-module contract for serializing firm-scoped allocations. */
@Service
public class FirmDirectory {
    private final FirmRepository firms;

    public FirmDirectory(FirmRepository firms) {
        this.firms = firms;
    }

    /**
     * Obtains a transaction-held write lock for an existing firm. Callers must already
     * be inside the mutation transaction whose firm-scoped allocation they serialize.
     */
    public boolean lockExisting(UUID firmId) {
        return firms.findByIdForUpdate(firmId).isPresent();
    }

    /** Confirms a selected firm still exists without exposing persistence to another module. */
    public boolean exists(UUID firmId) { return firms.existsById(firmId); }

    /** Returns active firm identifiers for scheduled firm-scoped work. */
    public List<UUID> activeFirmIds() {
        return firms.findAllByStatus(com.forgeboard.identity.domain.FirmStatus.ACTIVE).stream().map(firm -> firm.id()).toList();
    }
}
