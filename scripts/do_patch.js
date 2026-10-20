const fs=require('fs');
const p='supabase/functions/trios-admin/index.ts';
let s=fs.readFileSync(p,'utf8');
if(s.indexOf('\"/coupons\"')!==-1){process.exit(0);}
const a='    if (path === \"/settings\" && req.method === \"POST\") {';
const i=s.indexOf(a);
if(i===-1)process.exit(1);
const b = 
    // coupons
    const readContent = async function(){ const r = await supabase.from('store_settings').select('content').maybeSingle(); const d = r && r.data ? r.data.content : null; if(d && typeof d === 'object' && !Array.isArray(d)) return d; return {}; };
    const writeCoupons = async function(c){ const doc = await readContent(); await supabase.from('store_settings').update({ content: Object.assign({}, doc, { coupons: c }), updated_by: session.email, updated_at: new Date().toISOString() }).eq('id', 1); };
    const cc = function(c){ return (c && typeof c === 'object') ? String(c.code||'').toUpperCase().trim() : ''; };
    if (path === '/coupons' && req.method === 'GET'){ const doc = await readContent(); const raw = Array.isArray(doc.coupons)?doc.coupons:[]; return json({coupons:raw}); }
    if (path === '/coupons' && req.method === 'POST'){ const body = await req.json().catch(function(){return{};}); const code = String(body.code||'').toUpperCase().trim(); const type = body.type === 'flat' ? 'flat' : 'pct'; const val = Number(body.value); const min = Number(body.min)||0; const active = body.active !== false; if(!code || !/^[A-Z0-9_-]+$/.test(code) || code.length>24 || !isFinite(val) || val<=0 || (type==='pct' && val>100)) return json({error:'Invalid'},400); const doc = await readContent(); const list = Array.isArray(doc.coupons)?doc.coupons.slice():[]; const idx = list.findIndex(function(x){return cc(x)===code;}); const e = {code:type==='flat'?code:code, type:type, value:val, min:min, active:active}; if(idx<0) list.push(e); else list[idx] = Object.assign({}, list[idx], e); await writeCoupons(list); return json({ok:true, coupon:e}); }
    if (path === '/coupons-delete' && req.method === 'POST'){ const body = await req.json().catch(function(){return{};}); const code = String(body.code||'').toUpperCase().trim(); if(!code) return json({error:'code'},400); const doc = await readContent(); const list = Array.isArray(doc.coupons)?doc.coupons:[]; const next = list.filter(function(x){return cc(x)!==code;}); if(next.length===list.length) return json({error:'No such'},404); await writeCoupons(next); return json({ok:true}); }

;
s = s.substr(0,i) + b + s.substr(i);
fs.writeFileSync(p, s);