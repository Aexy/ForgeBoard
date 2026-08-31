package com.forgeboard.engagement.application;

import java.util.UUID;

public record TemplateChecklistItemView(UUID id, String label, boolean required, int position) {}
