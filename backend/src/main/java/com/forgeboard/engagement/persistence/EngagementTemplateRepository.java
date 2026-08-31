package com.forgeboard.engagement.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;
import com.forgeboard.engagement.domain.EngagementTemplate;

public interface EngagementTemplateRepository extends JpaRepository<EngagementTemplate, UUID> {
    boolean existsByFirmIdAndName(UUID firmId, String name);

    List<EngagementTemplate> findAllByFirmIdOrderByNameAsc(UUID firmId);
    Optional<EngagementTemplate> findByIdAndFirmId(UUID id, UUID firmId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select template from EngagementTemplate template where template.id = :id and template.firmId = :firmId")
    Optional<EngagementTemplate> findByIdAndFirmIdForUpdate(UUID id, UUID firmId);
}
