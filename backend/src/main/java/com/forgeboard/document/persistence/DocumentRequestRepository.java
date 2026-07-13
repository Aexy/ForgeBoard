package com.forgeboard.document.persistence;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.document.domain.DocumentRequest;
public interface DocumentRequestRepository extends JpaRepository<DocumentRequest, UUID> { List<DocumentRequest> findAllByFirmIdOrderByDueDateAsc(UUID firmId); Optional<DocumentRequest> findByIdAndFirmId(UUID id, UUID firmId); }
