package com.forgeboard.identity.persistence;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.identity.domain.Firm;

public interface FirmRepository extends JpaRepository<Firm, UUID> {
    boolean existsBySlug(String slug);
}

