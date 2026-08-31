package com.forgeboard.client;

import java.util.UUID;
import java.util.Optional;
import java.util.Collection;
import java.util.List;
import org.springframework.stereotype.Service;
import com.forgeboard.client.domain.ClientStatus;
import com.forgeboard.client.persistence.ClientRepository;

@Service
public class ClientDirectory {
    private final ClientRepository clients;
    public ClientDirectory(ClientRepository clients) { this.clients = clients; }
    public boolean exists(UUID firmId, UUID clientId) { return clients.existsByIdAndFirmId(clientId, firmId); }
    public boolean existsActive(UUID firmId, UUID clientId) {
        return clients.findByIdAndFirmId(clientId, firmId).filter(client -> client.status() == ClientStatus.ACTIVE).isPresent();
    }
    public Optional<String> displayName(UUID firmId, UUID clientId) {
        return clients.findByIdAndFirmId(clientId, firmId).map(client -> client.displayName());
    }
    public List<ActiveClient> findActiveByIds(UUID firmId, Collection<UUID> clientIds) {
        if (clientIds.isEmpty()) return List.of();
        return clients.findAllByFirmIdAndIdInAndStatusOrderByDisplayNameAsc(firmId, clientIds, ClientStatus.ACTIVE).stream()
                .map(client -> new ActiveClient(client.id(), client.legalName(), client.displayName(), client.primaryEmail(), client.version()))
                .toList();
    }

    /** Minimal firm-scoped client projection for modules that need active-client eligibility. */
    public record ActiveClient(UUID id, String legalName, String displayName, String primaryEmail, long version) {}
}
