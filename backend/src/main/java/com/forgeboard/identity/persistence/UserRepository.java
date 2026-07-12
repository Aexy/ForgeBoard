package com.forgeboard.identity.persistence;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.identity.domain.ForgeBoardUser;

public interface UserRepository extends JpaRepository<ForgeBoardUser, UUID> {
    Optional<ForgeBoardUser> findByEmail(String email);
    boolean existsByEmail(String email);
}

