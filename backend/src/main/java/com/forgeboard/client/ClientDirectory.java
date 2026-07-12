package com.forgeboard.client;

import java.util.UUID;
import org.springframework.stereotype.Service;
import com.forgeboard.client.persistence.ClientRepository;

@Service
public class ClientDirectory {
    private final ClientRepository clients;
    public ClientDirectory(ClientRepository clients) { this.clients = clients; }
    public boolean exists(UUID firmId, UUID clientId) { return clients.existsByIdAndFirmId(clientId, firmId); }
}

