package com.forgeboard.work.application;

import java.util.List;
import java.util.UUID;

public record BoardView(UUID id, String name, List<StageView> stages) {}

