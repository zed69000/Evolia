/* Evolia : sauvegarde en ligne par Google Play Jeux (voir ../cloud-save.js).
   Voyagent les jardins (une clé par partie) et la liste des parties ; pas les réglages de développeur,
   les journaux de débogage ni les simulations. Effacer une partie ou recommencer est volontaire : le nuage suit. */
CloudSave.setup({
  name: "evolia",
  keep: k => k === "evolia.slots" || k === "evolia.v1" || k.startsWith("evolia.v1."),
  resetKeys: k => k === "evolia.v1" || k.startsWith("evolia.v1."),
  // mètres marchés, toutes parties confondues : ils ne font que monter
  progress: get => {
    let m = 0;
    for (const k of ["evolia.v1", ...((JSON.parse(get("evolia.slots") || "null") || {}).list || []).map(x => "evolia.v1." + x.id)]) {
      const s = JSON.parse(get(k) || "null");
      if (s && s.totals) m += s.totals.distance || 0;
    }
    return Math.round(m);
  },
  describe: get => {
    const s = JSON.parse(get("evolia.v1") || "null");
    return s && s.totals ? Math.round((s.totals.distance || 0) / 100) / 10 + " km" : "";
  }
});
