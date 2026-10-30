// NEW. GET /pay-return?ref=pi_xxx — GCash/PayMongo returns here, then we bounce into the Android app.
export async function GET(req) {
  const ref = new URL(req.url).searchParams.get('ref') || '';
  const deep = `ambersshvpn://payment-done?ref=${encodeURIComponent(ref)}`.replace(/"/g, '&quot;');
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=${deep}">
<body style="font-family:sans-serif;text-align:center;padding:40px">
<h3>Bumabalik sa app...</h3><p><a href="${deep}">Buksan ang app</a></p></body>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
