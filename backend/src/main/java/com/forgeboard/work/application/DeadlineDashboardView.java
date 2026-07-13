package com.forgeboard.work.application;

import java.time.LocalDate;
import java.util.List;

public record DeadlineDashboardView(LocalDate asOf, long overdueCount, long dueSoonCount,
        long blockedCount, long awaitingReviewCount, List<DeadlineWorkItemView> attentionItems) {}
