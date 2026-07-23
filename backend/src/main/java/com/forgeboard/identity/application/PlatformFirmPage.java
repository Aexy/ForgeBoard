package com.forgeboard.identity.application;

import java.util.List;

public record PlatformFirmPage(List<PlatformFirmView> firms, String nextCursor) {}
