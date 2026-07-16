package com.forgeboard.work.application;

import java.util.List;
import java.util.UUID;

import com.forgeboard.work.domain.StageAttention;

public record StageView(UUID id, String name, StageAttention attention, int position, List<WorkItemView> items) {}
