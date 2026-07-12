package com.forgeboard.identity.application;

import java.util.UUID;
import com.forgeboard.identity.domain.MembershipRole;

public record FirmAccessView(UUID id, String name, String slug, MembershipRole role) {}

