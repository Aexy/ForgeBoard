package com.forgeboard.client.application;

public class ClientNotFoundException extends RuntimeException {
    public ClientNotFoundException() { super("Client was not found in the selected firm"); }
}

