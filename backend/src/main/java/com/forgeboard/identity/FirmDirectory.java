package com.forgeboard.identity;

import java.util.UUID;

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
}
