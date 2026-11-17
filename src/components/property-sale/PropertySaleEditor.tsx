'use client';

import { useEffect, useRef, useState } from 'react';
import { workflowRequest } from '@/lib/client/workflowRequest';
import { emptyPropertySale, PropertySaleDetailsSchema, type PropertySaleDetails } from '@/lib/property-sale/schema';

import styles from './PropertySale.module.css';

const fieldClass = styles.input;
const buttonClass = styles.linkButton;

export function PropertySaleEditor({ projectId, canPublish = false }: { projectId: string; canPublish?: boolean }) {
  const [details, setDetails] = useState(emptyPropertySale);
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [conflict, setConflict] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const pending = useRef<{ version: number; requestId: string; details: PropertySaleDetails } | null>(null);
  const endpoint = `/api/projects/${encodeURIComponent(projectId)}/property-sale`;

  async function load(signal?: AbortSignal) {
    setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { cache: 'no-store', signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load property details.');
      setDetails(data.sale?.details ?? emptyPropertySale()); setVersion(data.sale?.version ?? 0);
      setLoaded(true); setDirty(false); setConflict(false); pending.current = null;
    } catch (failure) {
      if (!signal?.aborted) setError(failure instanceof Error ? failure.message : 'Unable to load property details.');
    } finally { if (!signal?.aborted) setBusy(false); }
  }
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [endpoint]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);

  function change(patch: Partial<PropertySaleDetails>) {
    setDetails(value => ({ ...value, ...patch })); setDirty(true); setSaved(''); pending.current = null;
  }
  async function save() {
    const parsed = PropertySaleDetailsSchema.safeParse(details);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || 'Check the details.'); return; }
    setBusy(true); setError(''); setSaved('');
    pending.current ??= { version, requestId: crypto.randomUUID(), details: parsed.data };
    try {
      const response = await workflowRequest(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending.current) });
      const data = await response.json();
      if (!response.ok) { setConflict(response.status === 409); throw new Error(data.error || 'Unable to save property details.'); }
      setDetails(data.sale.details); setVersion(data.sale.version); setDirty(false); pending.current = null;
      setSaved(data.sale.details.publicationPermission ? 'Saved. Approved details appear when the project is public.' : 'Saved privately. Sale intent will guide your interview.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save property details. Your changes are still here.'); }
    finally { setBusy(false); }
  }

  async function importListing() {
    const checked = PropertySaleDetailsSchema.safeParse({ listingUrl: details.listingUrl });
    if (!checked.success || !details.listingUrl) { setError('Add a complete listing link first.'); return; }
    setBusy(true); setError(''); setImportMessage('');
    try {
      const response = await workflowRequest(`${endpoint}/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: details.listingUrl }) }, 110_000);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The listing could not be read. You can enter the details manually.');
      const patch: Partial<PropertySaleDetails> = {};
      for (const key of ['address', 'agentName', 'brokerage', 'contactUrl'] as const) {
        if (!details[key] && typeof result.fields?.[key] === 'string') patch[key] = result.fields[key];
      }
      if (!details.askingPrice && result.fields?.askingPrice && result.fields?.currency) {
        patch.askingPrice = result.fields.askingPrice; patch.currency = result.fields.currency;
      }
      if (Object.keys(patch).length) {
        change(patch);
        setImportMessage('Listing details filled in. Review them below, then save. Your existing entries were kept.');
      } else setImportMessage('No additional details could be filled in. Keep the listing link and complete any missing fields below.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The listing could not be read. You can enter the details manually.'); }
    finally { setBusy(false); }
  }

  const textField = (label: string, key: 'listingUrl' | 'askingPrice' | 'address' | 'agentName' | 'brokerage' | 'contactUrl', placeholder?: string) =>
    <label className={styles.label}>{label}<input value={details[key]} onChange={event => change({ [key]: event.target.value })}
      type={key.endsWith('Url') ? 'url' : 'text'} inputMode={key === 'askingPrice' ? 'decimal' : undefined} placeholder={placeholder}
      maxLength={key.endsWith('Url') ? 2000 : key === 'address' ? 400 : key === 'askingPrice' ? 15 : 120} className={fieldClass} /></label>;

  return <details className={styles.editor}>
    <summary className={styles.summary}>
      <span><span className={styles.summaryTitle}>Property & sale details</span><span className={styles.summaryHint}>Give the home a story beyond the listing.</span></span>
      <span className={styles.summaryEnd}><span>{dirty ? 'Unsaved' : loaded && details.currentlyForSale ? 'For sale' : 'Optional'}</span><span className={styles.plus} aria-hidden>+</span></span>
    </summary>
    <div className={styles.body}>
    <p className={styles.intro}>Selling this property? Let that guide your interview, then choose which details to share. Save before starting or resuming your interview.</p>
    {!loaded ? <p className={styles.message}>{busy ? 'Loading property details…' : 'Property details are unavailable.'}</p> :
      <fieldset disabled={busy || conflict || (details.publicationPermission && !canPublish)} className={styles.form}>
        <label className={styles.toggle}><input type="checkbox" checked={details.currentlyForSale} onChange={event => change({ currentlyForSale: event.target.checked })} />This property is currently for sale</label>
        <p className={styles.help}>Your room interview will explore what a future owner should understand about the home. The story stays when the sale ends.</p>
        <div className={styles.fields}>
        {details.currentlyForSale && <>
          <div>{textField('Listing link', 'listingUrl', 'Paste the property’s listing URL')}
          <p className={styles.fine}>Required to show this home for sale on Folio. Import details, review them, then approve what appears.</p>
          <button type="button" className={buttonClass} disabled={!details.listingUrl.trim()} onClick={() => void importListing()}>{busy ? 'Working…' : 'Fill from listing'}</button>
          {importMessage && <p role="status" className={styles.message}>{importMessage}</p>}</div>
          <div className={styles.row}>{textField('Asking price (optional)', 'askingPrice', 'e.g. 41000000')}
            <label className={styles.label}>Currency<select value={details.currency} onChange={event => change({ currency: event.target.value as PropertySaleDetails['currency'] })} className={fieldClass}>{['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'MXN', 'AED'].map(currency => <option key={currency}>{currency}</option>)}</select></label>
          </div>
        </>}
        {textField('Property address (optional)', 'address')}
        </div>
        {details.currentlyForSale && <details className={styles.optional}>
          <summary>Agent & brokerage <span className="text-folio-text-secondary">· Optional</span></summary>
          <div className={styles.optionalContent}><div className={styles.pair}>{textField('Agent (optional)', 'agentName')}{textField('Brokerage (optional)', 'brokerage')}</div>
          {textField('Agent contact page (optional)', 'contactUrl', 'https://…')}</div>
        </details>}
        <details className={styles.optional}>
          <summary>Press & project links{details.pressLinks.length ? ` · ${details.pressLinks.length}` : ' · Optional'}</summary>
          <div className={styles.optionalContent}>
          <p className={styles.intro}>Add coverage you’ve reviewed. These links stay with the project after the sale.</p>
          {details.pressLinks.map((link, index) => <div key={index} className="space-y-3">
            <label className={styles.label}>Link {index + 1} title<input className={fieldClass} value={link.title} maxLength={160} onChange={event => change({ pressLinks: details.pressLinks.map((item, i) => i === index ? { ...item, title: event.target.value } : item) })} /></label>
            <label className={styles.label}>Link {index + 1} URL<input type="url" className={fieldClass} value={link.url} maxLength={2000} placeholder="https://…" onChange={event => change({ pressLinks: details.pressLinks.map((item, i) => i === index ? { ...item, url: event.target.value } : item) })} /></label>
            <button type="button" className={buttonClass} onClick={() => change({ pressLinks: details.pressLinks.filter((_, i) => i !== index) })}>Remove link {index + 1}</button>
          </div>)}
          {details.pressLinks.length < 6 && <button type="button" className={buttonClass} onClick={() => change({ pressLinks: [...details.pressLinks, { title: '', url: '' }] })}>Add press or project link</button>}
          </div>
        </details>
        <div className={styles.permissions}>
        <p className={styles.eyebrow}>Your publishing choices</p>
        <label className={styles.permission}><input type="checkbox" disabled={!canPublish} checked={details.publicationPermission} onChange={event => change({ publicationPermission: event.target.checked, ...(!event.target.checked ? { publishAddress: false } : {}) })} />I have permission to publish these property details and links on the project’s public Folio page.</label>
        <label className={styles.permission}><input type="checkbox" disabled={!canPublish || !details.publicationPermission || !details.address.trim()} checked={details.publishAddress} onChange={event => change({ publishAddress: event.target.checked })} />I also have permission to show the property’s address.</label>
        {!canPublish && <p className={styles.intro}>A firm member with publishing permission can approve public property details.</p>}
        {details.currentlyForSale && details.publicationPermission && <p className={styles.fine}>Saving confirms that the listing is current. Reconfirm within 30 days to keep the price visible. Linked websites may display the address.</p>}
        </div>
        <div className={styles.saveRow}><button type="button" onClick={() => void save()} disabled={!dirty && !(details.currentlyForSale && details.publicationPermission)} className={styles.primary}>{busy ? 'Saving…' : !dirty && details.currentlyForSale && details.publicationPermission ? 'Confirm listing is still current' : 'Save property details'}<span aria-hidden>↗</span></button>{dirty && <span className={styles.fine}>Changes haven’t been saved.</span>}</div>
      </fieldset>}
    {error && <p role="alert" className={styles.message}>{error}</p>}
    {(!loaded && !busy || conflict) && <button type="button" className={buttonClass} onClick={() => { if (!dirty || window.confirm('Replace your unsaved edits with the latest saved property details?')) void load(); }}>{conflict ? 'Reload saved details' : 'Retry loading'}</button>}
    {saved && <p role="status" className={styles.message}>{saved}</p>}
    </div>
  </details>;
}
