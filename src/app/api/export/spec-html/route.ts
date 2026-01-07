import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const { projectId } = await req.json();
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      rooms: { 
        include: { 
          selections: { 
            include: { 
              product: { 
                include: { 
                  vendor: true 
                } 
              } 
            } 
          } 
        } 
      },
      selections: { 
        include: { 
          product: { 
            include: { 
              vendor: true 
            } 
          } 
        } 
      }, // if you also allow project-level selections
      owner: true,
    },
  });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Spec — ${escapeHtml(project.title || project.id)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: #111; }
  .wrap { max-width: 960px; margin: 40px auto; padding: 24px; }
  .hdr { display:flex; justify-content:space-between; align-items:flex-end; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 24px; }
  h1 { font-size: 28px; margin: 0; }
  .meta { font-size: 12px; color:#555; }
  .room { margin-top: 24px; }
  .room h2 { font-size: 18px; margin: 0 0 8px; border-left: 4px solid #000; padding-left: 8px; }
  table { width:100%; border-collapse: collapse; }
  th, td { border:1px solid #ddd; padding:10px; text-align:left; vertical-align: top; font-size: 13px; }
  th { background:#fafafa; }
  img { max-width: 120px; height:auto; border:1px solid #eee; }
  @media print {
    .wrap { margin:0; }
    .hdr { page-break-after: avoid; }
    .room { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <div>
        <h1>${escapeHtml(project.title || 'Project')} — Specification</h1>
        <div class="meta">
          Designer: ${escapeHtml(project.owner?.name || '')}<br/>
          Generated: ${new Date().toLocaleString()}
        </div>
      </div>
      <div class="meta">Folio</div>
    </div>

    ${renderRooms(project.rooms)}
    ${renderLoose(project.selections)}
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function escapeHtml(s?: string | null) {
  return (s || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
}

function renderRooms(rooms: any[] = []) {
  if (!rooms.length) return '';
  return rooms.map((r) => `
    <section class="room">
      <h2>${escapeHtml(r.name || 'Room')}</h2>
      ${renderTable(r.selections)}
    </section>
  `).join('');
}

function renderLoose(selections: any[] = []) {
  if (!selections.length) return '';
  return `
    <section class="room">
      <h2>Unassigned</h2>
      ${renderTable(selections)}
    </section>
  `;
}

function renderTable(selections: any[] = []) {
  if (!selections.length) return '<p>No selections.</p>';
  return `
    <table>
      <thead>
        <tr>
          <th>Image</th><th>Product</th><th>Vendor</th><th>Price</th><th>Source</th>
        </tr>
      </thead>
      <tbody>
        ${selections.map((s) => renderRow(s)).join('')}
      </tbody>
    </table>
  `;
}

function money(price?: number | null) {
  if (price == null) return '';
  return `$${price.toFixed(2)}`;
}

function renderRow(s: any) {
  const p = s.product || {};
  const v = p.vendor || {};
  const sourceBits = [s.sourceEventId && `Event #${s.sourceEventId}`, s.sourceSubEventId && `SubEvent #${s.sourceSubEventId}`].filter(Boolean).join(' • ');
  const img = p.imageUrl ? `<img src="${escapeHtml(p.imageUrl)}" />` : '';
  return `
    <tr>
      <td>${img}</td>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(v.name || v.companyName || '')}</td>
      <td>${money(p.price)}</td>
      <td>${escapeHtml(sourceBits)}</td>
    </tr>`;
}
