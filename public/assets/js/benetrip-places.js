/**
 * BENETRIP PLACES v1.0 — Autocomplete compartilhado de aeroportos e cidades
 *
 * Fonte primária: API Travelpayouts places2 (locale pt) — a mesma base da busca
 * de voos, então todo código retornado é pesquisável: inclui aeroportos
 * regionais (ex: JJG Jaguaruna) e códigos agregadores de cidade (SAO, RIO).
 * Fallback: base estática /data/cidades_global_iata_v7.json, baixada apenas
 * se a API falhar.
 *
 * Resultado unificado:
 *   { code, type: 'airport'|'city', isAggregate, name, label, sub,
 *     airportName, state, country, countryCode }
 *
 * Para telas legadas (comparar-voos, voos-baratos, todos-destinos) use
 * toLegacy(place), que devolve o shape antigo {code, displayCode, isCityCode,
 * aeroportosIncluidos, ...} — convertendo agregadores para kgmid quando o
 * backend é Google Flights/SearchAPI.
 */
(function (global) {
    'use strict';

    const BenetripPlaces = {

        API_URL: 'https://autocomplete.travelpayouts.com/places2?locale=pt&types%5B%5D=airport&types%5B%5D=city&term=',
        FALLBACK_JSON: '/data/cidades_global_iata_v7.json',

        // Cidades multi-aeroporto com kgmid do Google Flights (SearchAPI).
        // Mantém o comportamento v2.2 do comparar-voos/voos-baratos, cujos
        // backends recebem kgmid para códigos agregadores.
        CITY_GROUPS: {
            SAO: { kgmid: '/m/022pfm',  airports: ['GRU', 'CGH', 'VCP'] },
            RIO: { kgmid: '/m/06gmr',   airports: ['GIG', 'SDU'] },
            BHZ: { kgmid: '/m/01hhpg',  airports: ['CNF', 'PLU'] },
            NYC: { kgmid: '/m/02_286',  airports: ['JFK', 'EWR', 'LGA'] },
            WAS: { kgmid: '/m/0rh6k',   airports: ['IAD', 'DCA', 'BWI'] },
            CHI: { kgmid: '/m/01_d4',   airports: ['ORD', 'MDW'] },
            QSF: { kgmid: '/m/0d6lp',   airports: ['SFO', 'OAK', 'SJC'] },
            QLA: { kgmid: '/m/030qb3t', airports: ['LAX', 'BUR', 'LGB', 'SNA'] },
            DFW: { kgmid: '/m/0f2rq',   airports: ['DFW', 'DAL'] },
            HOU: { kgmid: '/m/03l2n',   airports: ['IAH', 'HOU'] },
            MIA: { kgmid: '/m/0f2v0',   airports: ['MIA', 'FLL'] },
            LON: { kgmid: '/m/04jpl',   airports: ['LHR', 'LGW', 'STN', 'LTN', 'LCY'] },
            PAR: { kgmid: '/m/05qtj',   airports: ['CDG', 'ORY'] },
            MOW: { kgmid: '/m/04swd',   airports: ['SVO', 'DME', 'VKO'] },
            STO: { kgmid: '/m/06mxs',   airports: ['ARN', 'BMA'] },
            MIL: { kgmid: '/m/0947l',   airports: ['MXP', 'LIN', 'BGY'] },
            ROM: { kgmid: '/m/06c62',   airports: ['FCO', 'CIA'] },
            BUE: { kgmid: '/m/01ly5m',  airports: ['EZE', 'AEP'] },
            TYO: { kgmid: '/m/07dfk',   airports: ['NRT', 'HND'] },
            OSA: { kgmid: '/m/0dj5q',   airports: ['KIX', 'ITM'] },
            SEL: { kgmid: '/m/0hsqf',   airports: ['ICN', 'GMP'] },
            BKK: { kgmid: '/m/0195pd',  airports: ['BKK', 'DMK'] },
            JKT: { kgmid: '/m/04f_d',   airports: ['CGK', 'HLP'] },
            BJS: { kgmid: '/m/01914',   airports: ['PEK', 'PKX'] },
            SHA: { kgmid: '/m/06wjf',   airports: ['PVG', 'SHA'] },
            IST: { kgmid: '/m/09949m',  airports: ['IST', 'SAW'] },
            DXB: { kgmid: '/m/0162v',   airports: ['DXB', 'DWC'] },
        },

        _cache: new Map(),
        _fallbackData: null,
        _fallbackError: false,

        normalize(t) { return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); },
        escAttr(t) { return String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); },

        // ================================================================
        // BUSCA — API places2 com cache + timeout; fallback estático
        // ================================================================
        async searchApi(term) {
            const key = this.normalize(term);
            if (this._cache.has(key)) return this._cache.get(key);

            const ctrl = new AbortController();
            const timeout = setTimeout(() => ctrl.abort(), 5000);
            try {
                const r = await fetch(this.API_URL + encodeURIComponent(term), { signal: ctrl.signal });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const data = await r.json();
                const results = (Array.isArray(data) ? data : [])
                    .filter(p => p.code && /^[A-Z]{3}$/.test(p.code) && (p.type === 'airport' || p.type === 'city'))
                    .slice(0, 8)
                    .map(p => this.mapPlace(p));
                if (this._cache.size > 80) this._cache.clear();
                this._cache.set(key, results);
                return results;
            } finally {
                clearTimeout(timeout);
            }
        },

        mapPlace(p) {
            if (p.type === 'airport') {
                const city = p.city_name || '';
                const airport = p.name || p.code;
                return {
                    code: p.code, type: 'airport', isAggregate: false,
                    name: city || airport,
                    label: city && this.normalize(airport).indexOf(this.normalize(city)) === -1 ? `${city} — ${airport}` : airport,
                    sub: p.country_name || '',
                    airportName: airport,
                    state: p.state_code || null,
                    country: p.country_name || '',
                    countryCode: p.country_code || '',
                };
            }
            // city: com main_airport_name = cidade de aeroporto único (código serve
            // como aeroporto); sem = código agregador que busca em todos os aeroportos
            const isAggregate = !p.main_airport_name;
            return {
                code: p.code, type: 'city', isAggregate,
                name: p.name,
                label: isAggregate ? `${p.name} — Todos os aeroportos` : `${p.name} — ${p.main_airport_name}`,
                sub: p.country_name || '',
                airportName: p.main_airport_name || null,
                state: p.state_code || null,
                country: p.country_name || '',
                countryCode: p.country_code || '',
            };
        },

        async ensureFallback() {
            if (this._fallbackData) return;
            try {
                const r = await fetch(this.FALLBACK_JSON);
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const data = await r.json();
                this._fallbackData = data.filter(c => c.iata);
                this._fallbackError = false;
                console.log(`📍 [BenetripPlaces] Fallback: ${this._fallbackData.length} cidades carregadas`);
            } catch (e) {
                this._fallbackError = true;
                this._fallbackData = [
                    { cidade: 'São Paulo', sigla_estado: 'SP', pais: 'Brasil', codigo_pais: 'BR', iata: 'GRU', aeroporto: 'Guarulhos' },
                    { cidade: 'São Paulo', sigla_estado: 'SP', pais: 'Brasil', codigo_pais: 'BR', iata: 'CGH', aeroporto: 'Congonhas' },
                    { cidade: 'São Paulo', sigla_estado: 'SP', pais: 'Brasil', codigo_pais: 'BR', iata: 'SAO', aeroporto: 'Todos os aeroportos' },
                    { cidade: 'Rio de Janeiro', sigla_estado: 'RJ', pais: 'Brasil', codigo_pais: 'BR', iata: 'GIG', aeroporto: 'Galeão' },
                    { cidade: 'Rio de Janeiro', sigla_estado: 'RJ', pais: 'Brasil', codigo_pais: 'BR', iata: 'SDU', aeroporto: 'Santos Dumont' },
                    { cidade: 'Rio de Janeiro', sigla_estado: 'RJ', pais: 'Brasil', codigo_pais: 'BR', iata: 'RIO', aeroporto: 'Todos os aeroportos' },
                    { cidade: 'Salvador', sigla_estado: 'BA', pais: 'Brasil', codigo_pais: 'BR', iata: 'SSA' },
                    { cidade: 'Brasília', sigla_estado: 'DF', pais: 'Brasil', codigo_pais: 'BR', iata: 'BSB' },
                    { cidade: 'Recife', sigla_estado: 'PE', pais: 'Brasil', codigo_pais: 'BR', iata: 'REC' },
                    { cidade: 'Fortaleza', sigla_estado: 'CE', pais: 'Brasil', codigo_pais: 'BR', iata: 'FOR' },
                    { cidade: 'Belo Horizonte', sigla_estado: 'MG', pais: 'Brasil', codigo_pais: 'BR', iata: 'CNF', aeroporto: 'Confins' },
                    { cidade: 'Curitiba', sigla_estado: 'PR', pais: 'Brasil', codigo_pais: 'BR', iata: 'CWB' },
                    { cidade: 'Porto Alegre', sigla_estado: 'RS', pais: 'Brasil', codigo_pais: 'BR', iata: 'POA' },
                    { cidade: 'Florianópolis', sigla_estado: 'SC', pais: 'Brasil', codigo_pais: 'BR', iata: 'FLN' },
                    { cidade: 'Buenos Aires', sigla_estado: '', pais: 'Argentina', codigo_pais: 'AR', iata: 'BUE', aeroporto: 'Todos os aeroportos' },
                    { cidade: 'Lisboa', sigla_estado: '', pais: 'Portugal', codigo_pais: 'PT', iata: 'LIS' },
                    { cidade: 'Miami', sigla_estado: 'FL', pais: 'EUA', codigo_pais: 'US', iata: 'MIA' },
                ];
            }
        },

        searchFallback(term) {
            if (!this._fallbackData || term.length < 2) return [];
            const n = this.normalize(term);
            return this._fallbackData
                .filter(c => this.normalize(c.cidade).includes(n) || c.iata.toLowerCase().includes(n) || (c.aeroporto && this.normalize(c.aeroporto).includes(n)))
                .slice(0, 8)
                .map(c => ({
                    code: c.iata,
                    type: c.aeroporto ? 'airport' : 'city',
                    isAggregate: !!(c.aeroporto && this.normalize(c.aeroporto).startsWith('todos')),
                    name: c.cidade,
                    label: `${c.cidade}${c.sigla_estado ? ', ' + c.sigla_estado : ''}${c.aeroporto ? ' — ' + c.aeroporto : ''}`,
                    sub: c.pais || '',
                    airportName: c.aeroporto || null,
                    state: c.sigla_estado || null,
                    country: c.pais || '',
                    countryCode: c.codigo_pais || '',
                }));
        },

        /**
         * Busca unificada: tenta a API, cai para a base local se falhar.
         * @returns {Promise<{results: Array, apiError: boolean}>}
         *          apiError=true somente quando nem API nem base local funcionaram.
         */
        async search(term) {
            try {
                return { results: await this.searchApi(term), apiError: false };
            } catch (e) {
                console.warn('⚠️ [BenetripPlaces] API places2 falhou, usando fallback local:', e.message);
                await this.ensureFallback();
                return { results: this.searchFallback(term), apiError: this._fallbackError };
            }
        },

        /**
         * Converte o resultado unificado para o shape legado usado por
         * comparar-voos, voos-baratos e todos-destinos. Agregadores conhecidos
         * viram kgmid (backend Google Flights); demais mantêm o código IATA.
         */
        toLegacy(p) {
            if (p.isAggregate) {
                const grp = this.CITY_GROUPS[p.code] || null;
                return {
                    code: grp ? grp.kgmid : p.code,
                    displayCode: p.code,
                    name: p.name,
                    state: p.state || null,
                    country: p.country || '',
                    countryCode: p.countryCode || '',
                    airport: 'Todos os aeroportos' + (grp ? ` (${grp.airports.join(', ')})` : ''),
                    isCityCode: true,
                    aeroportosIncluidos: grp ? grp.airports : null,
                };
            }
            return {
                code: p.code,
                displayCode: p.code,
                name: p.name,
                state: p.state || null,
                country: p.country || '',
                countryCode: p.countryCode || '',
                airport: p.airportName || null,
                isCityCode: false,
                aeroportosIncluidos: null,
            };
        },

        /**
         * Liga o autocomplete em um par input+dropdown.
         * opts: { input, dropdown, onSelect(place), onClear(), minChars=2,
         *         debounceMs=300, renderItem(place)=default .autocomplete-item }
         * O dropdown usa style.display (padrão das telas legadas).
         */
        attach(opts) {
            const { input, dropdown, onSelect } = opts;
            const minChars = opts.minChars || 2;
            const debounceMs = opts.debounceMs || 300;
            const renderItem = opts.renderItem || (p => this.defaultItemHtml(p));
            let timer, seq = 0, lastResults = [];

            input.addEventListener('input', () => {
                clearTimeout(timer);
                const term = input.value.trim();
                if (term.length < minChars) {
                    dropdown.style.display = 'none'; dropdown.innerHTML = '';
                    if (opts.onClear) opts.onClear();
                    return;
                }
                timer = setTimeout(async () => {
                    const mySeq = ++seq;
                    const { results, apiError } = await this.search(term);
                    if (mySeq !== seq || this.normalize(input.value.trim()) !== this.normalize(term)) return;
                    lastResults = results;
                    if (!results.length) {
                        dropdown.innerHTML = apiError
                            ? '<div style="padding:12px;color:#DC2626;font-size:13px;">⚠️ Busca de aeroportos indisponível. Digite o código IATA (ex: GRU)</div>'
                            : '<div style="padding:12px;color:#666;font-size:13px;">Nenhum resultado</div>';
                        dropdown.style.display = 'block';
                        return;
                    }
                    dropdown.innerHTML = results.map((p, i) => `<div data-place-idx="${i}">${renderItem(p)}</div>`).join('');
                    dropdown.style.display = 'block';
                    dropdown.querySelectorAll('[data-place-idx]').forEach(el => {
                        el.addEventListener('click', () => {
                            const place = lastResults[parseInt(el.dataset.placeIdx, 10)];
                            dropdown.style.display = 'none';
                            input.value = `${place.label} (${place.code})`;
                            onSelect(place);
                        });
                    });
                }, debounceMs);
            });

            document.addEventListener('click', (e) => {
                if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none';
            });
        },

        defaultItemHtml(p) {
            const icon = p.isAggregate ? '🏙️' : '';
            return `<div class="autocomplete-item${p.isAggregate ? ' autocomplete-city-group' : ''}">
                <div class="item-code">${icon}${p.code}</div>
                <div class="item-details">
                    <div class="item-name">${this.escAttr(p.label)}</div>
                    <div class="item-country">${this.escAttr(p.sub)}</div>
                </div>
            </div>`;
        },
    };

    global.BenetripPlaces = BenetripPlaces;
})(window);
