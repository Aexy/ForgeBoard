package com.forgeboard.client;

import java.util.UUID;
import java.util.Optional;
import org.springframework.stereotype.Service;
import com.forgeboard.client.persistence.ClientRepository;

@Service
public class ClientDirectory {
    private final ClientRepository clients;
    public ClientDirectory(ClientRepository clients) { this.clients = clients; }
    public boolean exists(UUID firmId, UUID clientId) { return clients.existsByIdAndFirmId(clientId, firmId); }
    public Optional<String> displayName(UUID firmId, UUID clientId) {
        return clients.findByIdAndFirmId(clientId, firmId).map(client -> client.displayName());
    }
}
