package com.forgeboard.identity.application;

import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;

public final class StrictBooleanDeserializer extends ValueDeserializer<Boolean> {
    @Override
    public Boolean deserialize(JsonParser parser, DeserializationContext context) {
        if (parser.currentToken() == JsonToken.VALUE_TRUE) return true;
        if (parser.currentToken() == JsonToken.VALUE_FALSE) return false;
        return context.reportInputMismatch(Boolean.class, "Expected a JSON boolean");
    }
}
