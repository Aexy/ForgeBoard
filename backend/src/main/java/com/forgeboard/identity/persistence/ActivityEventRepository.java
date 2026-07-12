package com.forgeboard.identity.persistence;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.identity.domain.ActivityEvent;

public interface ActivityEventRepository extends JpaRepository<ActivityEvent, UUID> {}

