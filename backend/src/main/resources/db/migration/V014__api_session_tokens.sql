create table api_refresh_tokens (
    id uuid primary key,
    user_id uuid not null references users(id) on delete cascade,
    family_id uuid not null,
    token_hash varchar(64) not null unique,
    access_token_jti uuid not null unique,
    expires_at timestamptz not null,
    used_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    last_used_at timestamptz
);

create index api_refresh_tokens_user_id_idx on api_refresh_tokens(user_id);
create index api_refresh_tokens_family_id_idx on api_refresh_tokens(family_id);
create index api_refresh_tokens_active_expiry_idx on api_refresh_tokens(expires_at)
    where revoked_at is null;
