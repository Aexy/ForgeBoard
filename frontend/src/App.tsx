import { FormEvent, useEffect, useState } from 'react';
import { archiveClient, Client, createClient, listClients } from './api/clients';
import { createFirm, currentSession, listAccessibleFirms, login, logout, SessionIdentity } from './api/session';
import { WorkflowView } from './WorkflowView';
import { EngagementsView } from './EngagementsView';
import { EmployeesView } from './EmployeesView';
import { MyWorkDashboard } from './MyWorkDashboard';
import { AuditTrailView } from './AuditTrailView';
import { MembershipRole } from './api/employees';
import forgeBoardLogo from './assets/forgeboard-logo.svg';
import { LanguageToggle } from './i18n';
const FIRM_KEY = 'forgeboard.selectedFirmId';
function Brand({ inverse = false }: {
    inverse?: boolean;
}) {
    return <div className={`brand ${inverse ? 'brand-inverse' : ''}`}><img src={forgeBoardLogo} alt="ForgeBoard"/><LanguageToggle/></div>;
}
function Clients({ firmId }: {
    firmId: string;
}) {
    const [clients, setClients] = useState<Client[]>([]);
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(false);
    const [loading, setLoading] = useState(true);
    useEffect(() => { listClients(firmId).then(setClients).catch(() => setError('Clients could not be loaded.')).finally(() => setLoading(false)); }, [firmId]);
    async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setError(''); try {
        const created = await createClient(firmId, { legalName: String(data.get('legalName')), displayName: String(data.get('displayName')), primaryEmail: String(data.get('primaryEmail')) });
        setClients((all) => [...all, created]);
        form.reset();
        setCreating(false);
    }
    catch {
        setError('The client could not be created.');
    } }
    async function archive(client: Client) { try {
        const archived = await archiveClient(firmId, client.id);
        setClients((all) => all.map((item) => item.id === archived.id ? archived : item));
    }
    catch {
        setError('The client could not be archived.');
    } }
    return <section className="workspace clients-view"><header><div><p className="eyebrow">Firm directory</p><h1>Clients</h1><p>Keep client identities and contact details ready for every engagement.</p></div><button type="button" onClick={() => setCreating(!creating)}>{creating ? 'Cancel' : '+ New client'}</button></header>
    {creating && <form className="client-form" onSubmit={submit}><label>Legal name<input name="legalName" required maxLength={200}/></label><label>Display name<input name="displayName" required maxLength={160}/></label><label>Primary email<input name="primaryEmail" type="email" maxLength={320}/></label><button className="primary-action">Save client</button></form>}{error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <p className="empty-state">Loading clients…</p> : clients.length === 0 ? <div className="empty-state"><h2>No clients yet</h2><p>Add the first client to begin organizing their work.</p></div> : <div className="client-list" aria-label="Clients">{clients.map((client) => <article className={`client-row ${client.status === 'ARCHIVED' ? 'archived' : ''}`} key={client.id}><div><h2>{client.displayName}</h2><p>{client.legalName}{client.primaryEmail ? ` · ${client.primaryEmail}` : ''}</p></div><span className="status">{client.status.toLowerCase()}</span>{client.status === 'ACTIVE' && <button className="secondary" onClick={() => archive(client)}>Archive</button>}</article>)}</div>}
  </section>;
}
type View = 'workflow' | 'clients' | 'engagements' | 'employees' | 'my-work' | 'audit-trail';
function Shell({ identity, firmName, firmId, role, onLogout }: {
    identity: SessionIdentity;
    firmName: string;
    firmId: string | null;
    role: MembershipRole;
    onLogout: () => void;
}) {
    const [view, setView] = useState<View>('workflow');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const canManage = role === 'OWNER' || role === 'ADMINISTRATOR';
    const canViewAuditTrail = role === 'OWNER' || role === 'MANAGER';
    function selectView(nextView: View) { setView(nextView); setMobileMenuOpen(false); }
    useEffect(() => { if (role === 'MEMBER')
        setView('my-work'); }, [role]);
    return <main className="app-shell"><aside className="sidebar"><div className="mobile-sidebar-header"><Brand inverse/><button className="mobile-menu-toggle" type="button" aria-expanded={mobileMenuOpen} aria-controls="primary-navigation" onClick={() => setMobileMenuOpen((open) => !open)}>Menu</button></div><div className="workspace-label"><span>Workspace</span><strong>{firmName}</strong></div><nav id="primary-navigation" aria-label="Primary navigation" data-mobile-open={mobileMenuOpen}><button aria-label="Workflow" className={view === 'workflow' ? 'active' : ''} onClick={() => selectView('workflow')}><i>01</i>Workflow</button><button aria-label="My work" className={view === 'my-work' ? 'active' : ''} onClick={() => selectView('my-work')}><i>02</i>My work</button><button aria-label="Clients" className={view === 'clients' ? 'active' : ''} onClick={() => selectView('clients')}><i>03</i>Clients</button><button aria-label="Engagements" className={view === 'engagements' ? 'active' : ''} onClick={() => selectView('engagements')}><i>04</i>Engagements</button>{canManage && <button aria-label="Employees" className={view === 'employees' ? 'active' : ''} onClick={() => selectView('employees')}><i>05</i>Employees</button>}{canViewAuditTrail && <button aria-label="Audit trail" className={view === 'audit-trail' ? 'active' : ''} onClick={() => selectView('audit-trail')}><i>06</i>Audit trail</button>}<button className="mobile-sign-out" aria-label="Sign out on mobile" onClick={onLogout}>Sign out</button></nav><div className="sidebar-note"><span>Everything in view</span><p>Deadlines, ownership, and handoffs in one accountable workspace.</p></div><div className="firm-card desktop-only"><div className="user-avatar">{identity.email.slice(0, 1).toUpperCase()}</div><div><strong>{identity.email.split('@')[0]}</strong><span>{identity.email}</span></div><button className="sidebar-action" onClick={onLogout}>Sign out</button></div></aside>{firmId ? view === 'workflow' ? <WorkflowView firmId={firmId} role={role}/> : view === 'clients' ? <Clients firmId={firmId}/> : view === 'engagements' ? <EngagementsView firmId={firmId}/> : view === 'employees' ? <EmployeesView firmId={firmId}/> : view === 'audit-trail' ? <AuditTrailView firmId={firmId}/> : <MyWorkDashboard firmId={firmId}/> : <section className="workspace"><div className="empty-state"><h1>Select a firm</h1><p>Create a firm in this browser before managing work.</p></div></section>}</main>;
}
function Access({ onAuthenticated }: {
    onAuthenticated: (identity: SessionIdentity, firmName?: string, firmId?: string) => Promise<void>;
}) {
    const [mode, setMode] = useState<'login' | 'onboarding'>('login');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(''); const data = new FormData(event.currentTarget); const email = String(data.get('email')); const password = String(data.get('password')); if (mode === 'onboarding' && password !== String(data.get('passwordConfirmation'))) {
        setError('Passwords do not match.');
        return;
    } setBusy(true); try {
        let firmName: string | undefined;
        let firmId: string | undefined;
        if (mode === 'onboarding') {
            firmName = String(data.get('firmName'));
            const result = await createFirm({ firmName, firmSlug: String(data.get('firmSlug')), ownerName: String(data.get('ownerName')), ownerEmail: email, password });
            firmId = result.firmId;
        }
        await onAuthenticated(await login(email, password), firmName, firmId);
    }
    catch {
        setError(mode === 'login' ? 'We could not sign you in. Check your details and try again.' : 'We could not create your firm. Review the details and try again.');
    }
    finally {
        setBusy(false);
    } }
    const passwordField = (name: string, label: string, autoComplete: string) => <label>{label}<span className="password-field"><input name={name} type={showPassword ? 'text' : 'password'} autoComplete={autoComplete} required minLength={12} placeholder="12 characters minimum"/><button type="button" className="password-visibility" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>{!showPassword && <path d="m3 3 18 18"/>}</svg></button></span></label>;
    return <main className="access-shell"><section className="access-intro"><Brand inverse/><div className="hero-copy"><p className="eyebrow">The client-work operating system</p><h1>Clarity for every <em>client engagement.</em></h1><p>ForgeBoard gives accounting teams one calm, accountable place to run deadlines, handoffs, and recurring work.</p></div><div className="proof-row"><div><strong>One view</strong><span>of every active engagement</span></div><div><strong>Clear ownership</strong><span>from preparation to review</span></div><div><strong>Audit ready</strong><span>with every change recorded</span></div></div><div className="hero-frame" aria-hidden="true"><span /></div></section><section className="access-side"><div className="access-panel" aria-labelledby="access-title"><p className="access-brand">ForgeBoard</p><p className="panel-kicker">Secure firm access</p><h2 id="access-title">{mode === 'login' ? 'Welcome back' : 'Build your workspace'}</h2><p>{mode === 'login' ? 'Pick up where your team left off.' : 'Create the first owner account for your firm.'}</p><div className="mode-switch" aria-label="Account access"><button type="button" aria-pressed={mode === 'login'} onClick={() => setMode('login')}>I have an account</button><button type="button" aria-pressed={mode === 'onboarding'} onClick={() => setMode('onboarding')}>Create a firm</button></div><form onSubmit={submit}>{mode === 'onboarding' && <><label>Firm name<input name="firmName" autoComplete="organization" required maxLength={160}/></label><label>Workspace address<div className="slug-field"><span>forgeboard.app/</span><input name="firmSlug" aria-label="Workspace address" required maxLength={80} pattern="[a-z0-9-]+" placeholder="hearth-accounting"/></div></label><label>Your name<input name="ownerName" autoComplete="name" required maxLength={160}/></label></>}<label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@yourfirm.com"/></label>{passwordField('password', 'Password', mode === 'login' ? 'current-password' : 'new-password')}{mode === 'onboarding' && passwordField('passwordConfirmation', 'Confirm password', 'new-password')}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-action" disabled={busy}>{busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create firm'}</button><p className="mobile-access-prompt"><span>{mode === 'login' ? "Don't have an account?" : 'Already have an account?'}</span><button type="button" aria-label={mode === 'login' ? 'Create a firm from sign-in' : 'Sign in from firm creation'} onClick={() => setMode(mode === 'login' ? 'onboarding' : 'login')}>{mode === 'login' ? 'Create a firm' : 'Sign in'}</button></p></form><p className="security-note"><span>●</span> Tenant-isolated and audit-ready by design</p></div></section></main>;
}
export function App() {
    const [identity, setIdentity] = useState<SessionIdentity | null>(null);
    const [checking, setChecking] = useState(true);
    const [firmName, setFirmName] = useState('Your firm');
    const [firmId, setFirmId] = useState<string | null>(() => localStorage.getItem(FIRM_KEY));
    const [role, setRole] = useState<MembershipRole>('MEMBER');
    useEffect(() => { currentSession().then(async (next) => { setIdentity(next); const accessible = await listAccessibleFirms(); const selected = accessible.find((firm) => firm.id === firmId) ?? accessible[0]; if (selected) {
        setFirmName(selected.name);
        setFirmId(selected.id);
        setRole((selected.role as MembershipRole | undefined) ?? 'OWNER');
        localStorage.setItem(FIRM_KEY, selected.id);
    } }).catch(() => undefined).finally(() => setChecking(false)); }, []);
    if (checking)
        return <main className="loading-shell" aria-live="polite">Opening ForgeBoard...</main>;
    if (!identity)
        return <Access onAuthenticated={async (next, firm, selected) => { let resolvedId = selected; let resolvedName = firm; let resolvedRole: MembershipRole = 'OWNER'; if (!resolvedId) {
            const accessible = await listAccessibleFirms();
            const access = accessible[0];
            resolvedId = access?.id;
            resolvedName = access?.name;
            resolvedRole = (access?.role as MembershipRole | undefined) ?? 'OWNER';
        } setRole(resolvedRole); setIdentity(next); if (resolvedName)
            setFirmName(resolvedName); if (resolvedId) {
            localStorage.setItem(FIRM_KEY, resolvedId);
            setFirmId(resolvedId);
        } }}/>;
    return <Shell identity={identity} firmName={firmName} firmId={firmId} role={role} onLogout={async () => { await logout(); setIdentity(null); }}/>;
}
