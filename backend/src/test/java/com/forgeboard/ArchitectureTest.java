package com.forgeboard;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ArchitectureTest {
    @Test
    void applicationModulesHaveNoCycles() {
        ApplicationModules.of(ForgeBoardApplication.class).verify();
    }
}

