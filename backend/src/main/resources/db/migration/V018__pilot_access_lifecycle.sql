alter table firm_memberships
    alter column user_id drop not null,
    drop constraint firm_memberships_status_check,
    add constraint firm_memberships_status_check check (status in ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED')),
    add constraint firm_memberships_user_required_for_non_invited_check
        check (status = 'INVITED' or user_id is not null),
    add constraint firm_memberships_firm_id_id_unique unique (firm_id, id);

create table access_actions (
    id uuid primary key,
    firm_id uuid references firms(id) on delete cascade,
    membership_id uuid,
    user_id uuid references users(id) on delete cascade,
    action_type varchar(32) not null,
    target_email varchar(320) not null,
    token_hash varchar(64) not null unique,
    created_by_user_id uuid references users(id) on delete set null,
    created_at timestamptz not null,
    expires_at timestamptz not null,
    consumed_at timestamptz,
    revoked_at timestamptz,
    constraint access_actions_type_check check (action_type in ('INVITATION', 'PASSWORD_RESET')),
    constraint access_actions_token_hash_sha256_check check (token_hash ~ '^[0-9a-f]{64}$'),
    constraint access_actions_expiry_after_creation_check check (expires_at > created_at),
    constraint access_actions_invitation_scope_check check (
        action_type <> 'INVITATION' or (firm_id is not null and membership_id is not null)
    ),
    constraint access_actions_membership_firm_fk foreign key (firm_id, membership_id)
        references firm_memberships (firm_id, id) on delete cascade
);

create index access_actions_redeemable_token_hash_idx on access_actions(token_hash)
    where consumed_at is null and revoked_at is null;
