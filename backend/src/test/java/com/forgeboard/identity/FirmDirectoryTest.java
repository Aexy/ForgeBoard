package com.forgeboard.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.forgeboard.identity.persistence.FirmRepository;

@ExtendWith(MockitoExtension.class)
class FirmDirectoryTest {
    @Mock FirmRepository firms;

    @Test
    void obtainsTheRepositoryWriteLockForAnExistingFirm() {
        UUID firmId = UUID.randomUUID();
        when(firms.findByIdForUpdate(firmId)).thenReturn(Optional.of(org.mockito.Mockito.mock(com.forgeboard.identity.domain.Firm.class)));

        assertThat(new FirmDirectory(firms).lockExisting(firmId)).isTrue();

        verify(firms).findByIdForUpdate(firmId);
    }

    @Test
    void reportsWhenTheFirmDoesNotExistAfterTryingToObtainTheWriteLock() {
        UUID firmId = UUID.randomUUID();
        when(firms.findByIdForUpdate(firmId)).thenReturn(Optional.empty());

        assertThat(new FirmDirectory(firms).lockExisting(firmId)).isFalse();

        verify(firms).findByIdForUpdate(firmId);
    }
}
