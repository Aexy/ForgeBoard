package com.forgeboard.work.application;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
public record EmployeeDashboardView(LocalDate today, List<EmployeeWorkItemView> overdue, List<EmployeeWorkItemView> dueSoon,
        List<EmployeeWorkItemView> blocked, List<EmployeeWorkItemView> awaitingReview, List<EmployeeWorkItemView> active) {
    public static EmployeeDashboardView group(List<EmployeeWorkItemView> items, LocalDate today) {
        var overdue = new ArrayList<EmployeeWorkItemView>(); var dueSoon = new ArrayList<EmployeeWorkItemView>();
        var blocked = new ArrayList<EmployeeWorkItemView>(); var awaitingReview = new ArrayList<EmployeeWorkItemView>(); var active = new ArrayList<EmployeeWorkItemView>();
        for (var item : items) {
            String stage = item.stageName().toLowerCase(java.util.Locale.ROOT);
            if (item.dueDate() != null && item.dueDate().isBefore(today)) overdue.add(item);
            else if (stage.contains("block")) blocked.add(item);
            else if (stage.contains("review")) awaitingReview.add(item);
            else if (item.dueDate() != null && !item.dueDate().isAfter(today.plusDays(7))) dueSoon.add(item);
            else active.add(item);
        }
        return new EmployeeDashboardView(today, List.copyOf(overdue), List.copyOf(dueSoon), List.copyOf(blocked),
                List.copyOf(awaitingReview), List.copyOf(active));
    }
}
