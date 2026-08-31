package com.forgeboard.engagement.persistence;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.engagement.domain.EngagementTemplateEnrollment;

public interface EngagementTemplateEnrollmentRepository extends JpaRepository<EngagementTemplateEnrollment, UUID> {
    List<EngagementTemplateEnrollment> findAllByFirmIdAndTemplateIdAndClientIdIn(
            UUID firmId, UUID templateId, Collection<UUID> clientIds);
    List<EngagementTemplateEnrollment> findAllByFirmIdAndTemplateId(UUID firmId, UUID templateId);
    List<EngagementTemplateEnrollment> findAllByFirmIdAndTemplateIdIn(UUID firmId, Collection<UUID> templateIds);
    boolean existsByFirmIdAndTemplateIdAndClientId(UUID firmId, UUID templateId, UUID clientId);
}
