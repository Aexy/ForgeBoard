package com.forgeboard.client.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.client.domain.ClientAccount;

public interface ClientRepository extends JpaRepository<ClientAccount, UUID> {
    Optional<ClientAccount> findByIdAndFirmId(UUID id, UUID firmId);
    List<ClientAccount> findAllByFirmIdOrderByDisplayNameAsc(UUID firmId);
}

