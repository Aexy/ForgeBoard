package com.forgeboard.engagement.persistence;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.engagement.domain.EngagementTemplateVersion;

public interface EngagementTemplateVersionRepository extends JpaRepository<EngagementTemplateVersion, UUID> {}
