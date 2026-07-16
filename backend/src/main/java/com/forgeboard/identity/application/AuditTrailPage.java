package com.forgeboard.identity.application;

import java.util.List;

public record AuditTrailPage(List<ActivityView> items, String nextCursor) {}
