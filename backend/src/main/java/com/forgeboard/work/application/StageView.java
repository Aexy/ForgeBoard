package com.forgeboard.work.application;

import java.util.List;
import java.util.UUID;

public record StageView(UUID id, String name, int position, List<WorkItemView> items) {}

