alter table access_actions
    add constraint access_actions_token_hash_sha256_check check (token_hash ~ '^[0-9a-f]{64}$');
