package com.forgeboard.engagement.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.engagement.domain.EngagementTemplateVersionChecklistItem;

public interface EngagementTemplateVersionChecklistItemRepository
        extends JpaRepository<EngagementTemplateVersionChecklistItem, UUID> {
    List<EngagementTemplateVersionChecklistItem> findAllByFirmIdAndTemplateIdAndDefinitionVersionOrderByPositionAsc(
            UUID firmId, UUID templateId, int definitionVersion);
}
