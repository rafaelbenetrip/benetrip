const fs = require('fs');
const path = require('path');

const root = process.cwd();
const inputPath = path.join(root, 'public/data/cidades_global_iata_v7.json');
const outputPath = path.join(root, 'public/data/cidades_aeroportos_search_v1.json');

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const normalize = (v) =>
  (v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const byAirport = new Map();
for (const row of raw) {
  const iata = (row.iata || '').trim().toUpperCase();
  if (!iata || iata.length !== 3) continue;
  if (!byAirport.has(iata)) byAirport.set(iata, []);
  byAirport.get(iata).push(row);
}

const pickMostFrequentWithConfidence = (values) => {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const winner = sorted[0]?.[0] || '';
  const winnerCount = sorted[0]?.[1] || 0;
  const total = values.length || 1;
  const confidence = winnerCount / total;
  return { value: winner, confidence, uniqueValues: counts.size };
};

const airports = [...byAirport.entries()]
  .map(([iata, rows]) => {
    const cityPick = pickMostFrequentWithConfidence(rows.map((r) => r.cidade).filter(Boolean));
    const cityOriginalPick = pickMostFrequentWithConfidence(rows.map((r) => r.cidade_original || r.cidade).filter(Boolean));
    const state = pickMostFrequentWithConfidence(rows.map((r) => r.sigla_estado || '')).value;
    const country = pickMostFrequentWithConfidence(rows.map((r) => r.pais || '')).value;
    const countryCode = pickMostFrequentWithConfidence(rows.map((r) => r.codigo_pais || '')).value;
    const continent = pickMostFrequentWithConfidence(rows.map((r) => r.continente || '')).value;

    const cityVariants = [...new Set(rows.map((r) => r.cidade).filter(Boolean))].slice(0, 20);
    const reliablePrimaryCity = cityPick.uniqueValues <= 3 || cityPick.confidence >= 0.2 ? cityPick.value : '';
    const reliableOriginalCity = cityOriginalPick.uniqueValues <= 3 || cityOriginalPick.confidence >= 0.2 ? cityOriginalPick.value : '';

    const searchTerms = [...new Set([
      iata,
      reliablePrimaryCity,
      reliableOriginalCity,
      ...cityVariants,
      ...cityVariants.map(normalize),
      normalize(reliablePrimaryCity),
      normalize(reliableOriginalCity),
      normalize(`${reliablePrimaryCity} ${country}`),
      normalize(`${reliablePrimaryCity} ${state}`),
    ].filter(Boolean))];

    return {
      iata,
      primary_city: reliablePrimaryCity,
      primary_city_original: reliableOriginalCity,
      state,
      country,
      country_code: countryCode,
      continent,
      served_city_count: cityVariants.length,
      served_cities_sample: cityVariants,
      search_terms: searchTerms,
    };
  })
  .sort((a, b) => a.iata.localeCompare(b.iata));

const airportSet = new Set(airports.map((a) => a.iata));

const metroDefinitions = [
  { code: 'SAO', name: 'São Paulo (todos aeroportos)', country_code: 'BR', airports: ['GRU', 'CGH', 'VCP'], cities: ['São Paulo', 'Campinas'], aliases: ['sao paulo', 'são paulo', 'sp'] },
  { code: 'RIO', name: 'Rio de Janeiro (todos aeroportos)', country_code: 'BR', airports: ['GIG', 'SDU'], cities: ['Rio de Janeiro'], aliases: ['rio de janeiro', 'rio'] },
  { code: 'NYC', name: 'New York (todos aeroportos)', country_code: 'US', airports: ['JFK', 'LGA', 'EWR'], cities: ['New York', 'Newark'], aliases: ['new york', 'nova york', 'ny'] },
  { code: 'LON', name: 'Londres (todos aeroportos)', country_code: 'GB', airports: ['LHR', 'LGW', 'LCY', 'LTN', 'STN', 'SEN'], cities: ['Londres'], aliases: ['londres', 'london'] },
  { code: 'PAR', name: 'Paris (todos aeroportos)', country_code: 'FR', airports: ['CDG', 'ORY', 'BVA'], cities: ['Paris'], aliases: ['paris'] },
  { code: 'TYO', name: 'Tóquio (todos aeroportos)', country_code: 'JP', airports: ['HND', 'NRT'], cities: ['Tóquio'], aliases: ['toquio', 'tóquio', 'tokyo'] },
  { code: 'OSA', name: 'Osaka (todos aeroportos)', country_code: 'JP', airports: ['KIX', 'ITM', 'UKB'], cities: ['Osaka', 'Kobe'], aliases: ['osaka'] },
  { code: 'CHI', name: 'Chicago (todos aeroportos)', country_code: 'US', airports: ['ORD', 'MDW'], cities: ['Chicago'], aliases: ['chicago'] },
  { code: 'WAS', name: 'Washington (todos aeroportos)', country_code: 'US', airports: ['IAD', 'DCA', 'BWI'], cities: ['Washington', 'Baltimore'], aliases: ['washington'] },
  { code: 'ROM', name: 'Roma (todos aeroportos)', country_code: 'IT', airports: ['FCO', 'CIA'], cities: ['Roma'], aliases: ['roma', 'rome'] },
  { code: 'MIL', name: 'Milão (todos aeroportos)', country_code: 'IT', airports: ['MXP', 'LIN', 'BGY'], cities: ['Milão', 'Bergamo'], aliases: ['milao', 'milão', 'milan'] },
  { code: 'BER', name: 'Berlim', country_code: 'DE', airports: ['BER'], cities: ['Berlim'], aliases: ['berlim', 'berlin'] },
  { code: 'BUE', name: 'Buenos Aires (todos aeroportos)', country_code: 'AR', airports: ['EZE', 'AEP'], cities: ['Buenos Aires'], aliases: ['buenos aires'] },
  { code: 'YTO', name: 'Toronto (todos aeroportos)', country_code: 'CA', airports: ['YYZ', 'YTZ', 'YHM'], cities: ['Toronto', 'Hamilton'], aliases: ['toronto'] },
  { code: 'MOW', name: 'Moscou (todos aeroportos)', country_code: 'RU', airports: ['SVO', 'DME', 'VKO', 'ZIA'], cities: ['Moscou'], aliases: ['moscou', 'moscow'] },
  { code: 'MEX', name: 'Cidade do México (todos aeroportos)', country_code: 'MX', airports: ['MEX', 'NLU', 'TLC'], cities: ['Cidade do México', 'Toluca'], aliases: ['cidade do mexico', 'cidade do méxico', 'mexico city'] }
];

const metroAggregators = metroDefinitions
  .map((m) => {
    const validAirports = m.airports.filter((a) => airportSet.has(a));
    const searchTerms = [...new Set([
      m.code,
      m.name,
      ...m.aliases,
      ...m.aliases.map(normalize),
      normalize(m.name),
      ...validAirports,
    ])];

    return {
      code: m.code,
      name: m.name,
      country_code: m.country_code,
      airports: validAirports,
      cities: m.cities,
      search_terms: searchTerms,
    };
  })
  .filter((m) => m.airports.length > 0)
  .sort((a, b) => a.code.localeCompare(b.code));

const metroByAirport = new Map();
for (const metro of metroAggregators) {
  for (const airport of metro.airports) {
    if (!metroByAirport.has(airport)) metroByAirport.set(airport, []);
    metroByAirport.get(airport).push(metro.code);
  }
}

const airportsEnriched = airports.map((airport) => ({
  ...airport,
  metro_codes: (metroByAirport.get(airport.iata) || []).sort(),
}));

const output = {
  metadata: {
    version: 1,
    description: 'Base otimizada para busca de passagens por aeroporto com suporte a agregadores metropolitanos (ex: SAO, RIO, NYC).',
    source_file: 'public/data/cidades_global_iata_v7.json',
    generated_at: new Date().toISOString(),
    total_source_rows: raw.length,
    total_airports: airportsEnriched.length,
    total_metro_aggregators: metroAggregators.length,
  },
  airports: airportsEnriched,
  metro_aggregators: metroAggregators,
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`Arquivo gerado: ${path.relative(root, outputPath)}`);
console.log(`Aeroportos únicos: ${airportsEnriched.length}`);
console.log(`Agregadores metropolitanos: ${metroAggregators.length}`);
