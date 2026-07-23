package com.forgeboard.identity.persistence;

import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
import com.forgeboard.identity.domain.Firm;

public interface FirmRepository extends JpaRepository<Firm, UUID> {
    boolean existsBySlug(String slug);

    @Query(value = "select new com.forgeboard.identity.persistence.FirmRepository$PlatformFirmRow("
            + "firm.id, firm.name, firm.slug, firm.status, firm.createdAt, count(membership)) "
            + "from Firm firm left join FirmMembership membership on membership.firmId = firm.id "
            + "where lower(firm.name) like lower(concat('%', :query, '%')) "
            + "group by firm.id, firm.name, firm.slug, firm.status, firm.createdAt order by firm.name asc",
            countQuery = "select count(firm) from Firm firm where lower(firm.name) like lower(concat('%', :query, '%'))")
    Page<PlatformFirmRow> findPlatformFirms(@Param("query") String query, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select firm from Firm firm where firm.id = :firmId")
    Optional<Firm> findByIdForUpdate(UUID firmId);

    record PlatformFirmRow(UUID id, String name, String slug, com.forgeboard.identity.domain.FirmStatus status,
            java.time.Instant createdAt, long employeeCount) {}
}
