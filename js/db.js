/* PROM AWARDS 2026 — capa de datos (Supabase). Solo usa la clave publishable; la seguridad la dan las reglas RLS. */
(() => {
  'use strict';
  const { supabaseUrl, supabaseKey } = window.PA_CONFIG;
  const sb = supabase.createClient(supabaseUrl, supabaseKey);
  const ok = ({ data, error }) => { if (error) throw error; return data; };

  const mapP = (r) => ({ id: r.id, name: r.name, alias: r.alias || '', photo: r.photo_url || null, icon: r.avatar_icon || null, userId: r.user_id, active: r.active, status: r.status, eligible: r.eligible, createdAt: r.created_at });
  const mapC = (r) => ({ id: r.id, name: r.name, desc: r.description, icon: r.icon, active: r.active, position: r.position, round: r.round, runoffOpen: r.runoff_open, runoffCandidates: r.runoff_candidates || [], sharedWin: r.shared_win });

  const blobOf = async (dataUrl) => (await fetch(dataUrl)).blob();
  const upload = async (dataUrl, folder) => {
    const path = `${folder}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.jpg`;
    const blob = await blobOf(dataUrl);
    ok(await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }));
    return sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  };

  const db = {
    sb,

    /* ---- Lectura: todo lo que la pantalla necesita, según quién eres ---- */
    async load() {
      const { data: { session } } = await sb.auth.getSession();
      const out = { authed: !!session, settings: null, categories: [], participants: [], me: null, isAdmin: false, selections: {}, runoffSel: {}, allVotes: [], allRunoff: [] };
      const uid = session && session.user.id;
      /* Todas las consultas en paralelo (una sola espera de red) */
      const [sRow, cats, parts, admin] = await Promise.all([
        sb.from('settings').select('name,event_date,noms_open').maybeSingle(),
        sb.from('categories').select('id,name,description,icon,position,active,round,runoff_open,runoff_candidates,shared_win').order('position').order('name'),
        session ? sb.from('participants').select('id,name,alias,photo_url,avatar_icon,user_id,active,status,eligible,created_at').order('name') : null,
        session ? sb.from('admins').select('user_id').eq('user_id', uid).maybeSingle() : null
      ]);
      const row = ok(sRow);
      if (row) out.settings = { name: row.name, date: row.event_date, open: row.noms_open };
      out.categories = ok(cats).map(mapC);
      if (!session) return out;

      out.participants = ok(parts).map(mapP);
      out.me = out.participants.find((p) => p.userId === uid) || null;
      out.isAdmin = !!ok(admin);
      const [noms, runs, allN, allR] = await Promise.all([
        out.me ? sb.from('nominations').select('category_id,nominee_id').eq('voter_id', out.me.id) : null,
        out.me ? sb.from('runoff_votes').select('category_id,round,nominee_id').eq('voter_id', out.me.id) : null,
        out.isAdmin ? sb.from('nominations').select('category_id,voter_id,nominee_id,created_at').order('created_at').limit(5000) : null,
        out.isAdmin ? sb.from('runoff_votes').select('category_id,round,voter_id,nominee_id').limit(5000) : null
      ]);
      if (noms) ok(noms).forEach((n) => { out.selections[n.category_id] = n.nominee_id; });
      if (runs) ok(runs).forEach((r) => {            // solo cuenta el voto de la ronda vigente de cada categoría
        const c = out.categories.find((x) => x.id === r.category_id);
        if (c && c.round === r.round) out.runoffSel[r.category_id] = r.nominee_id;
      });
      if (allN) out.allVotes = ok(allN);
      if (allR) out.allRunoff = ok(allR);
      return out;
    },

    /* ---- Cuenta ---- */
    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      return data.session;               // null si el proyecto aún exige confirmar el correo
    },
    async signIn(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); },
    async signOut() { await sb.auth.signOut(); },

    /* Perfil propio: foto opcional (si no hay, queda el icono aleatorio) */
    async createProfile({ name, alias, photo, icon }) {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error('NO_SESSION');
      const photo_url = photo ? await upload(photo, user.id) : null;
      ok(await sb.from('participants').insert({ user_id: user.id, name, alias, photo_url, avatar_icon: photo_url ? null : icon }));
    },

    /* ---- Nominaciones ---- */
    async setNomination(categoryId, voterId, nomineeId) {
      if (!nomineeId) { ok(await sb.from('nominations').delete().eq('category_id', categoryId).eq('voter_id', voterId)); return; }
      ok(await sb.from('nominations').upsert({ category_id: categoryId, voter_id: voterId, nominee_id: nomineeId }, { onConflict: 'category_id,voter_id' }));
    },
    async setRunoffVote(categoryId, round, voterId, nomineeId) {
      if (!nomineeId) { ok(await sb.from('runoff_votes').delete().eq('category_id', categoryId).eq('round', round).eq('voter_id', voterId)); return; }
      ok(await sb.from('runoff_votes').upsert({ category_id: categoryId, round, voter_id: voterId, nominee_id: nomineeId }, { onConflict: 'category_id,round,voter_id' }));
    },

    /* ---- Administración ---- */
    async savePerson({ id, name, alias, photo, icon }) {
      let photo_url = photo;
      if (photo && photo.startsWith('data:')) photo_url = await upload(photo, 'admin');
      const row = { name, alias: alias || null, photo_url: photo_url || null, avatar_icon: photo_url ? null : icon };
      if (id) ok(await sb.from('participants').update(row).eq('id', id));
      else ok(await sb.from('participants').insert({ ...row, status: 'approved' }));   // lo crea un admin: entra aprobado
    },
    async setStatus(id, status) { ok(await sb.from('participants').update({ status }).eq('id', id)); },
    async pendingCount() {
      const { count, error } = await sb.from('participants').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      if (error) throw error; return count || 0;
    },
    async deletePerson(id) { ok(await sb.from('participants').delete().eq('id', id)); },

    async saveCategory({ id, name, desc, icon, active, position }) {
      const row = { name, description: desc, icon, active };
      if (id) ok(await sb.from('categories').update(row).eq('id', id));
      else ok(await sb.from('categories').insert({ ...row, position }));
    },
    /* Estado de desempate de una categoría: { shared_win } | { round, runoff_open, runoff_candidates, shared_win } | { runoff_open } */
    async setCategoryState(id, patch) { ok(await sb.from('categories').update(patch).eq('id', id)); },
    async deleteCategory(id) { ok(await sb.from('categories').delete().eq('id', id)); },
    async setPositions(list) {                  // [{id, position}]
      for (const { id, position } of list) ok(await sb.from('categories').update({ position }).eq('id', id));
    },
    async saveSettings({ name, date, open }) {
      ok(await sb.from('settings').update({ name, event_date: date, noms_open: open }).eq('id', true));
    }
  };

  window.PA.db = db;
})();
