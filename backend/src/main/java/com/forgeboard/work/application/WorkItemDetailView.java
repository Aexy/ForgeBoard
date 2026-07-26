package com.forgeboard.work.application;

import java.util.List;

import com.forgeboard.identity.ActivitySummary;
import com.forgeboard.work.WorkItemEngagementDetail;

public record WorkItemDetailView(WorkItemView item, String clientDisplayName,
        List<DocumentRequestSummaryView> documentRequests, List<ActivitySummary> activity,
        WorkItemEngagementDetail engagement) {
}
