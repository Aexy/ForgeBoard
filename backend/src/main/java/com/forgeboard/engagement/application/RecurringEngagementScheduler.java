package com.forgeboard.engagement.application;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
class RecurringEngagementScheduler {
    private final RecurringEngagementService recurrence;
    private final RecurrenceFailureService failures;
    RecurringEngagementScheduler(RecurringEngagementService recurrence, RecurrenceFailureService failures) {
        this.recurrence = recurrence; this.failures = failures;
    }
    @Scheduled(cron = "0 5 1 * * *", zone = "Europe/Vienna")
    void runDaily() { recurrence.runDaily(); }

    @Scheduled(fixedDelay = 60000)
    void retryFailures() { failures.retryEligibleAutomatically(); }
}
