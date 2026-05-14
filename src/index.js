const INVITE_COOKIE = 'invite_session';
const ADMIN_COOKIE = 'admin_session';
const DEFAULT_MAX_GUESTS = 2;
const EVENT_DATE = 'October 12, 2026';
const EVENT_LOCATION = 'Garden Hall';

export default {
  async fetch(request, env) {
    try {
      return await routeRequest(request, env);
    } catch (error) {
      return htmlResponse(renderPage('Server Error', `<p>${escapeHtml(error.message || 'Unexpected error')}</p>`), 500);
    }
  },
};

async function routeRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (!env.DB) {
    return htmlResponse(renderPage('Configuration Error', '<p>D1 database binding (DB) is required.</p>'), 500);
  }

  if (path === '/' && method === 'GET') {
    return handlePublicLanding(request, env, url);
  }

  if (path === '/login' && method === 'POST') {
    return handlePublicLogin(request, env);
  }

  if (path === '/logout' && method === 'POST') {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
        'Set-Cookie': serializeCookie(INVITE_COOKIE, '', { path: '/', maxAge: 0 }),
      },
    });
  }

  if (path === '/rsvp' && method === 'GET') {
    return handleRsvpPage(request, env, url);
  }

  if (path === '/rsvp' && method === 'POST') {
    return handleRsvpSubmit(request, env);
  }

  if (path === '/admin' && method === 'GET') {
    return handleAdminPage(request, env, url);
  }

  if (path === '/admin/login' && method === 'POST') {
    return handleAdminLogin(request, env);
  }

  if (path === '/admin/logout' && method === 'POST') {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/admin',
        'Set-Cookie': serializeCookie(ADMIN_COOKIE, '', { path: '/admin', maxAge: 0 }),
      },
    });
  }

  if (path === '/admin/upload' && method === 'POST') {
    return handleInviteUpload(request, env);
  }

  if (path === '/admin/export' && method === 'GET') {
    return handleExport(request, env);
  }

  return htmlResponse(renderPage('Not Found', '<p>The requested page was not found.</p>'), 404);
}

async function handlePublicLanding(request, env, url) {
  const inviteCode = await getInviteCodeFromSession(request, env);
  if (inviteCode) {
    return Response.redirect(new URL('/rsvp', request.url), 302);
  }

  const message = url.searchParams.get('message');
  const messageHtml = message ? `<p class="notice">${escapeHtml(message)}</p>` : '';
  const content = `
    <div class="card">
      <h1>Celebrate with us</h1>
      <p>Please enter your invite code and password to RSVP.</p>
      ${messageHtml}
      <form action="/login" method="post" class="stack">
        <label>Invite Code<input name="invite_code" required autocomplete="off"></label>
        <label>Password<input name="password" type="password" required></label>
        <button type="submit">Continue</button>
      </form>
    </div>
  `;

  return htmlResponse(renderPage('Wedding RSVP', content));
}

async function handlePublicLogin(request, env) {
  const form = await request.formData();
  const inviteCode = (form.get('invite_code') || '').toString().trim();
  const password = (form.get('password') || '').toString();

  const invitee = await env.DB.prepare(
    'SELECT invite_code, password_hash FROM invitees WHERE invite_code = ?'
  )
    .bind(inviteCode)
    .first();

  if (!invitee || !(await verifyInvitePassword(password, invitee.password_hash))) {
    return Response.redirect(new URL('/?message=Invalid+invite+code+or+password', request.url), 302);
  }

  const token = await signSession({ type: 'invite', code: invitee.invite_code }, getSessionSecret(env));
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/rsvp',
      'Set-Cookie': serializeCookie(INVITE_COOKIE, token, { path: '/', maxAge: 60 * 60 * 24 }),
    },
  });
}

async function handleRsvpPage(request, env, url) {
  const inviteCode = await getInviteCodeFromSession(request, env);
  if (!inviteCode) {
    return Response.redirect(new URL('/?message=Please+log+in+to+RSVP', request.url), 302);
  }

  const invitee = await env.DB.prepare(
    'SELECT id, invite_code, name, email, max_guests FROM invitees WHERE invite_code = ?'
  )
    .bind(inviteCode)
    .first();

  if (!invitee) {
    return Response.redirect(new URL('/?message=Invite+not+found', request.url), 302);
  }

  const response = await env.DB.prepare(
    'SELECT attending, guest_count, dietary_notes, message FROM responses WHERE invitee_id = ?'
  )
    .bind(invitee.id)
    .first();

  const success = url.searchParams.get('saved') === '1';
  const content = `
    <div class="card">
      <h1>Wedding RSVP</h1>
      <p>Hi ${escapeHtml(invitee.name)}! We cannot wait to celebrate together.</p>
      <p><strong>Date:</strong> ${escapeHtml(EVENT_DATE)}<br><strong>Location:</strong> ${escapeHtml(EVENT_LOCATION)}</p>
      ${success ? '<p class="success">Your RSVP was saved.</p>' : ''}
      <form action="/rsvp" method="post" class="stack">
        <label>Will you attend?
          <select name="attending" required>
            <option value="yes" ${response?.attending ? 'selected' : ''}>Yes</option>
            <option value="no" ${response && !response.attending ? 'selected' : ''}>No</option>
          </select>
        </label>
        <label>Number of guests (including you)
          <input type="number" name="guest_count" min="0" max="${invitee.max_guests}" value="${response?.guest_count ?? 1}">
        </label>
        <label>Dietary notes
          <textarea name="dietary_notes" rows="3">${escapeHtml(response?.dietary_notes || '')}</textarea>
        </label>
        <label>Message for the couple
          <textarea name="message" rows="4">${escapeHtml(response?.message || '')}</textarea>
        </label>
        <button type="submit">Save RSVP</button>
      </form>
      <form action="/logout" method="post"><button class="secondary" type="submit">Sign out</button></form>
    </div>
  `;

  return htmlResponse(renderPage('RSVP Form', content));
}

async function handleRsvpSubmit(request, env) {
  const inviteCode = await getInviteCodeFromSession(request, env);
  if (!inviteCode) {
    return Response.redirect(new URL('/?message=Session+expired', request.url), 302);
  }

  const invitee = await env.DB.prepare('SELECT id, max_guests FROM invitees WHERE invite_code = ?').bind(inviteCode).first();
  if (!invitee) {
    return Response.redirect(new URL('/?message=Invite+not+found', request.url), 302);
  }

  const form = await request.formData();
  const attending = (form.get('attending') || 'no').toString() === 'yes' ? 1 : 0;
  const parsedGuestCount = Number.parseInt((form.get('guest_count') || '0').toString(), 10);
  const guestCount = Number.isFinite(parsedGuestCount)
    ? Math.max(0, Math.min(invitee.max_guests, parsedGuestCount))
    : 0;
  const dietaryNotes = (form.get('dietary_notes') || '').toString().trim();
  const message = (form.get('message') || '').toString().trim();

  await env.DB.prepare(
    `INSERT INTO responses (invitee_id, attending, guest_count, dietary_notes, message, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(invitee_id) DO UPDATE SET
       attending = excluded.attending,
       guest_count = excluded.guest_count,
       dietary_notes = excluded.dietary_notes,
       message = excluded.message,
       updated_at = CURRENT_TIMESTAMP`
  )
    .bind(invitee.id, attending, guestCount, dietaryNotes, message)
    .run();

  return Response.redirect(new URL('/rsvp?saved=1', request.url), 302);
}

async function handleAdminPage(request, env, url) {
  const isAdmin = await isAdminAuthenticated(request, env);
  if (!isAdmin) {
    const error = url.searchParams.get('error') ? '<p class="notice">Invalid admin password.</p>' : '';
    return htmlResponse(
      renderPage(
        'Admin Login',
        `<div class="card"><h1>Admin</h1>${error}<form action="/admin/login" method="post" class="stack"><label>Password<input name="password" type="password" required></label><button type="submit">Sign in</button></form></div>`
      )
    );
  }

  const rows = await env.DB.prepare(
    `SELECT i.invite_code, i.name, i.email, i.max_guests,
            r.attending, r.guest_count, r.dietary_notes, r.message, r.updated_at
       FROM invitees i
       LEFT JOIN responses r ON r.invitee_id = i.id
      ORDER BY i.name ASC`
  ).all();

  const errorMessage = url.searchParams.get('error');
  const uploadedCount = Number.parseInt(url.searchParams.get('uploaded') || '', 10);
  const statusMessage = errorMessage
    ? `<p class="notice">${escapeHtml(errorMessage)}</p>`
    : Number.isFinite(uploadedCount)
      ? `<p class="success">Uploaded ${uploadedCount} invitee${uploadedCount === 1 ? '' : 's'}.</p>`
      : '';

  const tableRows = (rows.results || [])
    .map(
      (row) => `<tr>
      <td>${escapeHtml(row.invite_code)}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.email || '')}</td>
      <td>${row.max_guests}</td>
      <td>${row.attending === null ? '—' : row.attending ? 'Yes' : 'No'}</td>
      <td>${row.guest_count ?? '—'}</td>
      <td>${escapeHtml(row.dietary_notes || '')}</td>
      <td>${escapeHtml(row.message || '')}</td>
      <td>${escapeHtml(row.updated_at || '')}</td>
    </tr>`
    )
    .join('');

  const content = `
    <div class="admin-grid">
      <div class="card">
        <h1>Invite Admin</h1>
        <p>Upload CSV with headers: <code>invite_code,name,email,password,max_guests</code></p>
        ${statusMessage}
        <form action="/admin/upload" method="post" enctype="multipart/form-data" class="stack">
          <label>CSV file<input type="file" name="invitees_csv" accept=".csv,text/csv"></label>
          <label>Or paste CSV<textarea name="invitees_text" rows="5"></textarea></label>
          <button type="submit">Upload invitees</button>
        </form>
        <div class="actions">
          <a class="button-link" href="/admin/export">Export CSV</a>
          <form action="/admin/logout" method="post"><button class="secondary" type="submit">Sign out</button></form>
        </div>
      </div>
      <div class="card table-wrap">
        <h2>Invitees & RSVPs</h2>
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Email</th><th>Max Guests</th><th>Attending</th><th>Guests</th><th>Dietary</th><th>Message</th><th>Updated</th></tr></thead>
          <tbody>${tableRows || '<tr><td colspan="9">No invitees yet.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;

  return htmlResponse(renderPage('RSVP Admin', content));
}

async function handleAdminLogin(request, env) {
  const form = await request.formData();
  const password = (form.get('password') || '').toString();
  if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
    return Response.redirect(new URL('/admin?error=1', request.url), 302);
  }

  const token = await signSession({ type: 'admin' }, getSessionSecret(env));
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/admin',
      'Set-Cookie': serializeCookie(ADMIN_COOKIE, token, { path: '/admin', maxAge: 60 * 60 * 8 }),
    },
  });
}

async function handleInviteUpload(request, env) {
  const isAdmin = await isAdminAuthenticated(request, env);
  if (!isAdmin) {
    return Response.redirect(new URL('/admin?error=1', request.url), 302);
  }

  const form = await request.formData();
  let csv = '';
  const file = form.get('invitees_csv');
  if (file && typeof file.text === 'function') {
    csv = await file.text();
  }
  if (!csv.trim()) {
    csv = (form.get('invitees_text') || '').toString();
  }

  if (!csv.trim()) {
    return Response.redirect(new URL('/admin?error=Paste+or+upload+invitee+data+first', request.url), 302);
  }

  const rows = parseCsv(csv).filter((row) => row.invite_code && row.name && row.password);
  if (rows.length === 0) {
    return Response.redirect(new URL('/admin?error=No+valid+invitees+found.+Use+headers+invite_code%2Cname%2Cemail%2Cpassword%2Cmax_guests', request.url), 302);
  }

  for (const row of rows) {
    const maxGuestsRaw = Number.parseInt(row.max_guests || String(DEFAULT_MAX_GUESTS), 10);
    const maxGuests = Number.isFinite(maxGuestsRaw) ? Math.max(0, maxGuestsRaw) : DEFAULT_MAX_GUESTS;
    const passwordHash = await hashInvitePassword(row.password);
    await env.DB.prepare(
      `INSERT INTO invitees (invite_code, name, email, password_hash, max_guests)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(invite_code) DO UPDATE SET
         name = excluded.name,
         email = excluded.email,
         password_hash = excluded.password_hash,
         max_guests = excluded.max_guests`
    )
      .bind(row.invite_code.trim(), row.name.trim(), (row.email || '').trim(), passwordHash, maxGuests)
      .run();
  }

  return Response.redirect(new URL(`/admin?uploaded=${rows.length}`, request.url), 302);
}

async function handleExport(request, env) {
  const isAdmin = await isAdminAuthenticated(request, env);
  if (!isAdmin) {
    return Response.redirect(new URL('/admin?error=1', request.url), 302);
  }

  const rows = await env.DB.prepare(
    `SELECT i.invite_code, i.name, i.email, i.max_guests,
            r.attending, r.guest_count, r.dietary_notes, r.message, r.updated_at
       FROM invitees i
       LEFT JOIN responses r ON r.invitee_id = i.id
      ORDER BY i.name ASC`
  ).all();

  const header = ['invite_code', 'name', 'email', 'max_guests', 'attending', 'guest_count', 'dietary_notes', 'message', 'updated_at'];
  const lines = [header.join(',')];
  for (const row of rows.results || []) {
    lines.push(
      [
        row.invite_code,
        row.name,
        row.email || '',
        row.max_guests,
        row.attending === null || row.attending === undefined ? '' : row.attending ? 'yes' : 'no',
        row.guest_count ?? '',
        row.dietary_notes || '',
        row.message || '',
        row.updated_at || '',
      ]
        .map(csvCell)
        .join(',')
    );
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="invitees-and-rsvps.csv"',
    },
  });
}

async function getInviteCodeFromSession(request, env) {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const token = cookies[INVITE_COOKIE];
  if (!token) {
    return null;
  }
  const payload = await verifySession(token, getSessionSecret(env));
  if (!payload || payload.type !== 'invite') {
    return null;
  }
  return payload.code;
}

async function isAdminAuthenticated(request, env) {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const token = cookies[ADMIN_COOKIE];
  if (!token || !env.ADMIN_PASSWORD) {
    return false;
  }
  const payload = await verifySession(token, getSessionSecret(env));
  return Boolean(payload && payload.type === 'admin');
}

function getSessionSecret(env) {
  if (!env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be configured.');
  }
  return env.SESSION_SECRET;
}

function parseCookies(cookieHeader) {
  const entries = cookieHeader.split(';').map((part) => part.trim()).filter(Boolean);
  const out = {};
  for (const entry of entries) {
    const idx = entry.indexOf('=');
    if (idx > -1) {
      out[entry.slice(0, idx)] = decodeURIComponent(entry.slice(idx + 1));
    }
  }
  return out;
}

function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  if (options.path) {
    segments.push(`Path=${options.path}`);
  }
  if (typeof options.maxAge === 'number') {
    segments.push(`Max-Age=${options.maxAge}`);
  }
  segments.push('HttpOnly', 'SameSite=Lax');
  return segments.join('; ');
}

async function signSession(payload, secret) {
  const serialized = JSON.stringify(payload);
  const encoded = base64UrlEncode(serialized);
  const sig = await signValue(encoded, secret);
  return `${encoded}.${sig}`;
}

async function verifySession(token, secret) {
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) {
    return null;
  }
  const expected = await signValue(encoded, secret);
  if (sig !== expected) {
    return null;
  }
  try {
    return JSON.parse(base64UrlDecode(encoded));
  } catch {
    return null;
  }
}

async function signValue(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(signature));
}

async function hashInvitePassword(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = bytesToHex(saltBytes);
  const hashHex = await pbkdf2Hex(password, saltHex);
  return `${saltHex}:${hashHex}`;
}

async function verifyInvitePassword(password, storedHash) {
  if (!storedHash) {
    return false;
  }
  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) {
    return storedHash === password;
  }
  const derived = await pbkdf2Hex(password, saltHex);
  return derived === hashHex;
}

async function pbkdf2Hex(password, saltHex) {
  const saltBytes = hexToBytes(saltHex);
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

function base64UrlEncode(value) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return atob(padded);
}

function parseCsv(csvText) {
  const normalizedText = String(csvText ?? '').replace(/^\uFEFF/, '').trim();
  const lines = normalizedText.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) {
    return [];
  }

  const [headerLine, ...dataLines] = lines;
  const delimiter = detectDelimiter(headerLine);
  const headers = splitCsvLine(headerLine, delimiter).map(normalizeHeader);

  return dataLines.map((line) => {
    const values = splitCsvLine(line, delimiter);
    const row = {};
    for (let i = 0; i < headers.length; i += 1) {
      row[headers[i]] = (values[i] || '').trim();
    }
    return row;
  });
}

function detectDelimiter(line) {
  const commaCount = (line.match(/,/g) || []).length;
  const tabCount = (line.match(/\t/g) || []).length;
  return tabCount > commaCount ? '\t' : ',';
}

function normalizeHeader(header) {
  return String(header ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function splitCsvLine(line, delimiter = ',') {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function csvCell(value) {
  const text = String(value ?? '');
  if (/[,"\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPage(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; background: linear-gradient(140deg,#faf5ff,#ecfeff); color: #111827; }
    .card { max-width: 720px; margin: 2rem auto; background: #fff; border-radius: 18px; box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08); padding: 1.5rem; }
    .admin-grid { max-width: 1200px; margin: 1.5rem auto; display: grid; gap: 1rem; grid-template-columns: 1fr; }
    @media (min-width: 980px) { .admin-grid { grid-template-columns: 380px 1fr; } }
    h1, h2 { margin-top: 0; color: #4c1d95; }
    .stack { display: grid; gap: .85rem; }
    label { display: grid; gap: .35rem; font-size: .95rem; font-weight: 600; }
    input, textarea, select { border: 1px solid #d1d5db; border-radius: 10px; padding: .6rem .7rem; font: inherit; }
    button, .button-link { border: 0; border-radius: 999px; background: #7c3aed; color: #fff; padding: .65rem 1rem; font-weight: 700; cursor: pointer; text-decoration: none; display: inline-block; }
    button.secondary { background: #475569; margin-top: .75rem; }
    .actions { display: flex; gap: .75rem; align-items: center; margin-top: 1rem; flex-wrap: wrap; }
    .notice { background: #fef3c7; border-radius: 10px; padding: .6rem .7rem; }
    .success { background: #dcfce7; border-radius: 10px; padding: .6rem .7rem; }
    table { width: 100%; border-collapse: collapse; font-size: .85rem; }
    th, td { border-bottom: 1px solid #e5e7eb; text-align: left; vertical-align: top; padding: .45rem; }
    th { background: #f8fafc; }
    .table-wrap { overflow-x: auto; }
    code { background: #f3f4f6; padding: .15rem .35rem; border-radius: 6px; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

function htmlResponse(content, status = 200) {
  return new Response(content, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

export { parseCsv, splitCsvLine, csvCell, escapeHtml };
