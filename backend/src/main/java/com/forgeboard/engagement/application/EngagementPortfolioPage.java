package com.forgeboard.engagement.application;

import java.util.List;

public record EngagementPortfolioPage(List<EngagementPortfolioView> content, int page, int pageSize,
        long totalElements, int totalPages) {}
