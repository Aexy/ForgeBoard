package com.forgeboard.engagement.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.engagement.domain.EngagementTemplate;

public interface EngagementTemplateRepository extends JpaRepository<EngagementTemplate, UUID> {
    List<EngagementTemplate> findAllByFirmIdOrderByNameAsc(UUID firmId);
    Optional<EngagementTemplate> findByIdAndFirmId(UUID id, UUID firmId);
}
