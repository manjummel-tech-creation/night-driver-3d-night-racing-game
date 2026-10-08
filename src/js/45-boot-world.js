// ---------- build everything static, in order: pads first (rails, lamps and sidewalks open around them), then roads
function buildWorld(){
  const T0 = performance.now(), times = {};
  const mark = k => { times[k] = Math.round(performance.now() - T0); };
  placeStations(); mark('stations');
  placeTowns();
  for (const c of CITIES) buildCityPlaces(c); mark('cities');
  placeCrossovers();
  for (const e of EDGES) if (e.stations) e.nearStation = s => e.stations.some(st => Math.abs(st.sm - s) < 300);
  placeLamps(); mark('lamps');
  buildRoads(); mark('roads');
  buildRails(); mark('rails');
  buildCrossovers();
  buildPillars(); buildLamps(); mark('pillars+lamps');
  for (const st of STATIONS) if (st.kind === 'gas') buildGas(st); mark('gas');
  for (const t of TOWNS) buildTown(t); mark('towns');
  for (const L of LANDMARKS) buildLandmark(L); for (const S of SUBURBS) buildSuburb(S); buildSecrets(); buildEasterEggs(); buildLore(); buildJunctionSigns(); buildHeist(); buildJukai(); mark('landmarks');
  buildBeacons();
  jpFonts.then(() => buildSigns());
  buildCountryside(); mark('countryside');
  return times;
}
