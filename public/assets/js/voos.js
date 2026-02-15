/**
 * BENETRIP VOOS v3.1 — Busca de voos com filtros completos
 *
 * Fixes from v3.0:
 * - CRITICAL: Re-render cards on every poll with new data (not just first time)
 * - Increased minimum results threshold from 3 to 5 before showing
 * - Added "search in progress" visual indicator while polling continues
 * - Live result count update during search
 * - Smoother transition from loading to results
 */

const BenetripVoos = {

    state: {
        cidadesData: null,
        params: {},
        searchId: null,
        currencyRates: {},
        proposals: [],
        searchComplete: false,
        pollTimer: null,
        pollCount: 0,
        maxPolls: 40,
        displayedCount: 0,
        perPage: 10,
        sortBy: 'cheapest',
        resultsShown: false,
        tipInterval: null,
        previousBestPrice: Infinity, // Track price changes for visual feedback
        filters: {
            stops: 'all',
            airlines: 'all',
            depGoMin: 0, depGoMax: 1439,
            arrGoMin: 0, arrGoMax: 1439,
            depRetMin: 0, depRetMax: 1439,
            arrRetMin: 0, arrRetMax: 1439,
            priceMax: Infinity,
            durationMax: Infinity,
        },
        allAirlines: {},
        priceBounds: { min: 0, max: 10000 },
        durationBounds: { min: 60, max: 2880 },
        activePanel: null,
    },

    CURRENCY: {
        'BRL': { sym: 'R$', name: 'Real', locale: 'pt-BR' },
        'USD': { sym: 'US$', name: 'Dólar', locale: 'en-US' },
        'EUR': { sym: '€', name: 'Euro', locale: 'de-DE' },
    },

    // ================================================================
    // INIT
    // ================================================================
    async init() {
        console.log('✈️ BenetripVoos v3.1');
        await this.loadCities();
        this.setupSearchForm();
        this.setupSortTabs();
        this.setupFilterChips();
        this.setupFilterPanels();

        const urlParams = this.parseUrlParams();
        if (urlParams.origin && urlParams.destination && urlParams.departure_date) {
            this.prefillForm(urlParams);
            setTimeout(() => this.submitSearch(), 300);
        }
    },

    // ================================================================
    // CIDADES
    // ================================================================
    async loadCities() {
        try {
            const r = await fetch('data/cidades_global_iata_v5.json');
            if (!r.ok) throw new Error('Err');
            const data = await r.json();
            this.state.cidadesData = data.filter(c => c.iata);
        } catch (e) {
            this.state.cidadesData = [
                {cidade:'São Paulo',sigla_estado:'SP',pais:'Brasil',codigo_pais:'BR',iata:'GRU',aeroporto:'Guarulhos'},
                {cidade:'São Paulo',sigla_estado:'SP',pais:'Brasil',codigo_pais:'BR',iata:'CGH',aeroporto:'Congonhas'},
                {cidade:'Rio de Janeiro',sigla_estado:'RJ',pais:'Brasil',codigo_pais:'BR',iata:'GIG',aeroporto:'Galeão'},
                {cidade:'Salvador',sigla_estado:'BA',pais:'Brasil',codigo_pais:'BR',iata:'SSA'},
                {cidade:'Brasília',sigla_estado:'DF',pais:'Brasil',codigo_pais:'BR',iata:'BSB'},
            ];
        }
    },

    normalize(t) { return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); },

    searchCities(term) {
        if (!this.state.cidadesData || term.length < 2) return [];
        const n = this.normalize(term);
        return this.state.cidadesData
            .filter(c => this.normalize(c.cidade).includes(n) || c.iata.toLowerCase().includes(n) || (c.aeroporto && this.normalize(c.aeroporto).includes(n)))
            .slice(0, 8)
            .map(c => ({code:c.iata,name:c.cidade,state:c.sigla_estado,country:c.pais,airport:c.aeroporto||null}));
    },

    parseUrlParams() {
        const p = new URL(window.location.href).searchParams;
        return {
            origin:(p.get('origin')||'').toUpperCase(), destination:(p.get('destination')||'').toUpperCase(),
            departure_date:p.get('departure_date')||'', return_date:p.get('return_date')||'',
            adults:parseInt(p.get('adults')||'1'), children:parseInt(p.get('children')||'0'), infants:parseInt(p.get('infants')||'0'),
            currency:(p.get('currency')||'BRL').toUpperCase(),
            origin_name:p.get('origin_name')||'', destination_name:p.get('destination_name')||'',
        };
    },

    prefillForm(p) {
        document.getElementById('sf-input-origin').value = p.origin_name ? `${p.origin_name} (${p.origin})` : p.origin;
        document.getElementById('sf-origin-code').value = p.origin;
        document.getElementById('sf-origin-name').value = p.origin_name || p.origin;
        document.getElementById('sf-input-dest').value = p.destination_name ? `${p.destination_name} (${p.destination})` : p.destination;
        document.getElementById('sf-dest-code').value = p.destination;
        document.getElementById('sf-dest-name').value = p.destination_name || p.destination;
        if (p.departure_date) {
            document.getElementById('sf-departure').value = p.departure_date;
            document.getElementById('sf-return').value = p.return_date;
            const fmt = d => d ? new Date(d+'T12:00:00').toLocaleDateString('pt-BR') : '';
            document.getElementById('sf-input-dates').value = p.return_date ? `${fmt(p.departure_date)} — ${fmt(p.return_date)}` : fmt(p.departure_date);
        }
        document.getElementById('pax-adults').value = p.adults;
        document.getElementById('pax-children').value = p.children;
        document.getElementById('pax-infants').value = p.infants;
        this.updatePaxSummary();
        document.getElementById('sf-currency').value = p.currency;
    },

    // ================================================================
    // SETUP SEARCH FORM
    // ================================================================
    setupSearchForm() {
        this.setupAutocomplete('sf-input-origin','sf-dropdown-origin','sf-origin-code','sf-origin-name');
        this.setupAutocomplete('sf-input-dest','sf-dropdown-dest','sf-dest-code','sf-dest-name');
        document.getElementById('sf-swap').addEventListener('click', () => {
            const ids = [['sf-input-origin','sf-input-dest'],['sf-origin-code','sf-dest-code'],['sf-origin-name','sf-dest-name']];
            ids.forEach(([a,b]) => { const ea=document.getElementById(a),eb=document.getElementById(b); [ea.value,eb.value]=[eb.value,ea.value]; });
        });
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
        flatpickr('#sf-input-dates', {
            mode:'range', minDate:tomorrow, dateFormat:'Y-m-d', locale:'pt',
            onChange: sel => {
                if (sel.length===2) {
                    document.getElementById('sf-departure').value = this.isoDate(sel[0]);
                    document.getElementById('sf-return').value = this.isoDate(sel[1]);
                    document.getElementById('sf-input-dates').value = `${this.brDate(sel[0])} — ${this.brDate(sel[1])}`;
                } else if (sel.length===1) {
                    document.getElementById('sf-departure').value = this.isoDate(sel[0]);
                    document.getElementById('sf-return').value = '';
                }
            }
        });
        const trigger=document.getElementById('sf-pax-trigger'), dd=document.getElementById('sf-pax-dropdown');
        trigger.addEventListener('click', e => { e.stopPropagation(); dd.classList.toggle('open'); });
        document.getElementById('sf-pax-done').addEventListener('click', () => dd.classList.remove('open'));
        document.addEventListener('click', e => { if(!dd.contains(e.target)&&e.target!==trigger) dd.classList.remove('open'); });
        document.querySelectorAll('.pax-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const inp=document.getElementById(btn.dataset.t), v=parseInt(inp.value), mn=parseInt(inp.min), mx=parseInt(inp.max);
                if(btn.dataset.a==='inc'&&v<mx) inp.value=v+1;
                if(btn.dataset.a==='dec'&&v>mn) inp.value=v-1;
                const a=parseInt(document.getElementById('pax-adults').value), i=parseInt(document.getElementById('pax-infants').value);
                if(i>a) document.getElementById('pax-infants').value=a;
                this.updatePaxSummary();
            });
        });
        document.getElementById('search-form').addEventListener('submit', e => { e.preventDefault(); this.submitSearch(); });
        document.getElementById('route-edit').addEventListener('click', () => this.showSearchForm());
    },

    setupAutocomplete(inputId, dropdownId, codeId, nameId) {
        const input=document.getElementById(inputId), dd=document.getElementById(dropdownId);
        const hCode=document.getElementById(codeId), hName=document.getElementById(nameId);
        let timer;
        input.addEventListener('input', () => {
            clearTimeout(timer);
            const term=input.value.trim();
            if(term.length<2){dd.classList.remove('open');hCode.value='';return;}
            timer=setTimeout(()=>{
                const res=this.searchCities(term);
                dd.innerHTML = res.length===0 ? '<div style="padding:12px;color:#999;font-size:13px">Nenhum resultado</div>'
                    : res.map(c=>`<div class="sf-dd-item" data-code="${c.code}" data-name="${c.name}" data-full="${c.name}${c.airport?' — '+c.airport:''} (${c.code})"><span class="sf-dd-code">${c.code}</span><div class="sf-dd-info"><div class="sf-dd-name">${c.name}${c.state?', '+c.state:''}${c.airport?' — '+c.airport:''}</div><div class="sf-dd-sub">${c.country}</div></div></div>`).join('');
                dd.classList.add('open');
                dd.querySelectorAll('.sf-dd-item').forEach(item => {
                    item.addEventListener('click', () => { input.value=item.dataset.full; hCode.value=item.dataset.code; hName.value=item.dataset.name; dd.classList.remove('open'); });
                });
            },250);
        });
        input.addEventListener('focus', () => { if(dd.children.length>0&&input.value.length>=2) dd.classList.add('open'); });
        document.addEventListener('click', e => { if(!input.contains(e.target)&&!dd.contains(e.target)) dd.classList.remove('open'); });
    },

    updatePaxSummary() {
        const a=parseInt(document.getElementById('pax-adults').value), c=parseInt(document.getElementById('pax-children').value), i=parseInt(document.getElementById('pax-infants').value);
        const parts=[`${a} adulto${a>1?'s':''}`];
        if(c>0)parts.push(`${c} criança${c>1?'s':''}`)
        if(i>0)parts.push(`${i} bebê${i>1?'s':''}`);
        document.getElementById('sf-pax-summary').textContent=parts.join(', ');
    },

    isoDate(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`},
    brDate(d){return d.toLocaleDateString('pt-BR')},

    // ================================================================
    // SUBMIT SEARCH
    // ================================================================
    submitSearch() {
        const oc=document.getElementById('sf-origin-code').value, dc=document.getElementById('sf-dest-code').value;
        const dep=document.getElementById('sf-departure').value, ret=document.getElementById('sf-return').value;
        if(!oc){alert('Selecione a cidade de origem');return;}
        if(!dc){alert('Selecione o destino');return;}
        if(!dep){alert('Selecione as datas');return;}
        this.state.params = {origin:oc,destination:dc,departure_date:dep,return_date:ret,
            adults:parseInt(document.getElementById('pax-adults').value),
            children:parseInt(document.getElementById('pax-children').value),
            infants:parseInt(document.getElementById('pax-infants').value),
            currency:document.getElementById('sf-currency').value,
            origin_name:document.getElementById('sf-origin-name').value||oc,
            destination_name:document.getElementById('sf-dest-name').value||dc};
        history.replaceState(null,'',`?${new URLSearchParams(this.state.params)}`);
        this.updateRouteBar(); this.hideSearchForm(); this.showPanel('loading');
        this.resetSearchState(); this.resetFilters(); this.startSearch();
    },

    // ================================================================
    // UI
    // ================================================================
    showSearchForm(){document.getElementById('search-section').style.display='block';document.getElementById('search-section').classList.remove('compact');document.getElementById('route-bar').style.display='none';this.hideAllPanels();window.scrollTo({top:0,behavior:'smooth'})},
    hideSearchForm(){document.getElementById('search-section').style.display='none';document.getElementById('route-bar').style.display='block'},
    showPanel(n){this.hideAllPanels();const el=document.getElementById(`state-${n}`);if(el)el.style.display='block'},
    hideAllPanels(){['loading','error','empty','results'].forEach(n=>{const el=document.getElementById(`state-${n}`);if(el)el.style.display='none'})},
    updateRouteBar(){
        const p=this.state.params;
        document.getElementById('rb-origin').textContent=p.origin_name||p.origin;
        document.getElementById('rb-dest').textContent=p.destination_name||p.destination;
        const fmt=iso=>iso?new Date(iso+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):''
        document.getElementById('rb-dates').textContent=p.return_date?`${fmt(p.departure_date)} → ${fmt(p.return_date)}`:`${fmt(p.departure_date)} (só ida)`;
        const parts=[];if(p.adults)parts.push(`${p.adults} ad`);if(p.children)parts.push(`${p.children} cri`);if(p.infants)parts.push(`${p.infants} bb`);
        document.getElementById('rb-pax').textContent=parts.join(', ');
        document.getElementById('rb-currency').textContent=p.currency;
    },

    // ================================================================
    // SEARCH FLOW
    // ================================================================
    resetSearchState(){this.state.searchId=null;this.state.proposals=[];this.state.searchComplete=false;this.state.resultsShown=false;this.state.displayedCount=0;this.state.pollCount=0;this.state.allAirlines={};this.state.currencyRates={};this.state.previousBestPrice=Infinity;if(this.state.pollTimer)clearTimeout(this.state.pollTimer);if(this.state.tipInterval)clearInterval(this.state.tipInterval)},

    async startSearch(){
        this.setProgress(10,'Iniciando busca...');this.startTips();
        try{
            const r=await fetch('/api/flight-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(this.state.params)});
            if(!r.ok){const err=await r.json().catch(()=>({}));throw new Error(err.error||err.message||err.detail||`Erro ${r.status}`);}
            const data=await r.json();
            if(!data.search_id)throw new Error('Sem search_id');
            this.state.searchId=data.search_id;
            // Store currency_rates from initial search to forward to results endpoint
            if(data.currency_rates) {
                this.state.currencyRates=data.currency_rates;
                console.log('💱 Initial currency_rates received:', Object.keys(data.currency_rates).join(', '));
            }
            this.setProgress(20,'Consultando companhias...');
            this.poll();
        }catch(err){console.error('❌',err);this.showError(err.message);}
    },

    async poll(){
        if(this.state.searchComplete||this.state.pollCount>=this.state.maxPolls){this.finishSearch();return;}
        this.state.pollCount++;
        try{
            // Build URL with currency_rates forwarding
            let url = `/api/flight-results?uuid=${this.state.searchId}&currency=${this.state.params.currency}`;
            if (Object.keys(this.state.currencyRates).length > 0) {
                url += `&rates=${encodeURIComponent(JSON.stringify(this.state.currencyRates))}`;
            }
            const r=await fetch(url);
            if(!r.ok)throw new Error(`HTTP ${r.status}`);
            const data=await r.json();

            // Update currency_rates if returned from backend
            if (data.currency_rates) {
                this.state.currencyRates = { ...this.state.currencyRates, ...data.currency_rates };
            }

            const pct=Math.min(90,20+(this.state.pollCount/this.state.maxPolls)*70);
            this.setProgress(pct,data.total>0?`${data.total} ofertas encontradas...`:'Consultando agências...');

            if(data.proposals?.length>0){
                const prevCount = this.state.proposals.length;
                this.state.proposals=data.proposals;
                this.updateFilterBounds();

                if(data.total >= 5 && !this.state.resultsShown){
                    // ——————————————————————————————————————————————
                    // FIRST RENDER: show results panel with search-in-progress banner
                    // ——————————————————————————————————————————————
                    this.state.resultsShown=true;
                    this.showResults();
                    this.showSearchingBanner(true);
                    console.log(`📋 [Poll ${this.state.pollCount}] First render with ${data.total} results`);
                } else if(this.state.resultsShown) {
                    // ——————————————————————————————————————————————
                    // SUBSEQUENT POLLS: re-render cards with updated data
                    // Only re-render if we actually got new/different proposals
                    // ——————————————————————————————————————————————
                    if (data.proposals.length !== prevCount) {
                        this.renderCards();
                        this.checkForBetterPrice(data.proposals);
                        console.log(`📋 [Poll ${this.state.pollCount}] Re-rendered: ${prevCount} → ${data.total} results`);
                    }
                }
            }
            if(data.completed){this.state.searchComplete=true;this.finishSearch();return;}
            this.state.pollTimer=setTimeout(()=>this.poll(),this.state.pollCount<5?2000:1500);
        }catch(e){console.warn('Poll:',e.message);this.state.pollTimer=setTimeout(()=>this.poll(),2000);}
    },

    finishSearch(){
        if(this.state.pollTimer)clearTimeout(this.state.pollTimer);
        if(this.state.tipInterval)clearInterval(this.state.tipInterval);
        this.setProgress(100,'Busca concluída!');
        if(this.state.proposals.length===0){this.showPanel('empty');return;}
        this.updateFilterBounds();this.populateAirlinesFilter();
        // Hide the "still searching" banner
        this.showSearchingBanner(false);
        if(!this.state.resultsShown) this.showResults();
        else this.renderCards();
    },

    /**
     * Show/hide a banner indicating that more results are still being loaded.
     * This reassures users that cheaper options may still appear.
     */
    showSearchingBanner(show) {
        let banner = document.getElementById('searching-banner');
        if (show) {
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'searching-banner';
                banner.className = 'searching-banner';
                banner.innerHTML = `
                    <div class="searching-banner-inner">
                        <div class="searching-banner-pulse"></div>
                        <span>🔍 Ainda buscando ofertas melhores...</span>
                    </div>
                `;
                // Insert before results list
                const resultsInfo = document.querySelector('.results-info');
                if (resultsInfo) {
                    resultsInfo.parentNode.insertBefore(banner, resultsInfo);
                }
            }
            banner.style.display = 'block';
        } else {
            if (banner) {
                // Fade out nicely
                banner.style.transition = 'opacity 0.5s ease';
                banner.style.opacity = '0';
                setTimeout(() => {
                    if (banner.parentNode) banner.parentNode.removeChild(banner);
                }, 500);
            }
        }
    },

    /**
     * Check if a new best price appeared and briefly highlight it
     */
    checkForBetterPrice(proposals) {
        if (!proposals.length) return;
        const sorted = [...proposals].sort((a, b) => a.price - b.price);
        const currentBest = this.pricePerPerson(sorted[0].price);

        if (currentBest < this.state.previousBestPrice && this.state.previousBestPrice !== Infinity) {
            console.log(`💰 Better price found: ${this.fmtPrice(this.state.previousBestPrice)} → ${this.fmtPrice(currentBest)}`);
            // Flash the cheapest sort tab to draw attention
            const cheapTab = document.querySelector('.sort-tab[data-sort="cheapest"] .sort-val');
            if (cheapTab) {
                cheapTab.classList.add('price-improved');
                setTimeout(() => cheapTab.classList.remove('price-improved'), 2000);
            }
            // Flash the first card
            const firstCard = document.querySelector('.flight-card');
            if (firstCard) {
                firstCard.classList.add('card-new-best');
                setTimeout(() => firstCard.classList.remove('card-new-best'), 2500);
            }
        }
        this.state.previousBestPrice = currentBest;
    },

    retrySearch(){this.resetSearchState();this.showPanel('loading');this.startSearch()},
    showError(msg){document.getElementById('error-msg').textContent=msg;this.showPanel('error')},
    showResults(){this.showPanel('results');this.populateAirlinesFilter();this.updateTimeReturnVisibility();this.renderCards();window.scrollTo({top:0,behavior:'smooth'})},
    setProgress(pct,msg){const b=document.getElementById('progress-fill');if(b)b.style.width=`${pct}%`;const m=document.getElementById('loading-msg');if(m)m.textContent=msg},
    startTips(){const tips=['💡 Preços por pessoa, ida e volta','✈️ Comparando dezenas de companhias','🔍 Buscando as melhores tarifas','💰 Preços na moeda escolhida','🐕 A Tripinha farejando ofertas!','⏰ Busca leva até 60 segundos'];let i=0;this.state.tipInterval=setInterval(()=>{i=(i+1)%tips.length;const el=document.getElementById('loading-tip');if(el)el.textContent=tips[i]},4000)},

    // ================================================================
    // FORMAT HELPERS
    // ================================================================
    fmtPrice(v){const c=this.CURRENCY[this.state.params.currency]||this.CURRENCY.BRL;return`${c.sym} ${Math.round(v).toLocaleString('pt-BR')}`},
    fmtDuration(min){if(!min||min<=0)return'--';const h=Math.floor(min/60),m=min%60;return h===0?`${m}min`:m===0?`${h}h`:`${h}h${String(m).padStart(2,'0')}`},
    fmtTime(t){return(t||'--:--').substring(0,5)},
    fmtMinToTime(m){return`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`},
    timeToMin(t){if(!t)return 0;const[h,m]=t.substring(0,5).split(':').map(Number);return(h||0)*60+(m||0)},
    stopsClass(s){return s===0?'s0':s===1?'s1':'s2'},
    stopsText(s){return s===0?'Direto':s===1?'1 parada':`${s} paradas`},
    airlineLogo(iata){return iata?`https://pics.avs.io/60/60/${iata}.png`:''},
    pricePerPerson(total){const{adults,children}=this.state.params;const p=(adults||1)+(children||0);return p>0?Math.round(total/p):total},

    // ================================================================
    // FILTER BOUNDS
    // ================================================================
    updateFilterBounds(){
        const pp=this.state.proposals;if(!pp.length)return;
        const prices=pp.map(p=>this.pricePerPerson(p.price)).filter(v=>v>0&&isFinite(v));
        if(prices.length){this.state.priceBounds={min:Math.min(...prices),max:Math.max(...prices)};}
        const durs=pp.map(p=>p.segments?.[0]?.total_duration||p.total_duration).filter(v=>v>0);
        if(durs.length){this.state.durationBounds={min:Math.min(...durs),max:Math.max(...durs)};}
        const airlines={};
        for(const p of pp){const ppp=this.pricePerPerson(p.price);for(const seg of(p.segments||[]))for(const f of(seg.flights||[])){const c=f.airline;if(c&&(!airlines[c]||ppp<airlines[c].minPrice))airlines[c]={name:f.airline_name||c,minPrice:ppp};}}
        this.state.allAirlines=airlines;
        // Update slider ranges
        const ps=document.getElementById('fr-price-max');
        if(ps){ps.min=Math.floor(this.state.priceBounds.min);ps.max=Math.ceil(this.state.priceBounds.max);if(this.state.filters.priceMax===Infinity)ps.value=ps.max;document.getElementById('fv-price-min').textContent=this.fmtPrice(this.state.priceBounds.min);document.getElementById('fv-price-max').textContent=this.fmtPrice(this.state.filters.priceMax===Infinity?this.state.priceBounds.max:this.state.filters.priceMax);}
        const ds=document.getElementById('fr-duration-max');
        if(ds){ds.min=Math.floor(this.state.durationBounds.min);ds.max=Math.ceil(this.state.durationBounds.max);if(this.state.filters.durationMax===Infinity)ds.value=ds.max;document.getElementById('fv-dur-val').textContent=this.fmtDuration(this.state.filters.durationMax===Infinity?this.state.durationBounds.max:this.state.filters.durationMax);}
    },

    updateTimeReturnVisibility(){
        const has=!!this.state.params.return_date;
        document.querySelectorAll('#fp-times-return,#fp-times-return-arr').forEach(el=>{if(el)el.style.display=has?'block':'none'});
    },

    // ================================================================
    // AIRLINES FILTER
    // ================================================================
    populateAirlinesFilter(){
        const list=document.getElementById('fp-airline-list');
        const entries=Object.entries(this.state.allAirlines).sort((a,b)=>a[1].minPrice-b[1].minPrice);
        if(!entries.length){list.innerHTML='<p class="fp-empty">Nenhuma companhia</p>';return;}
        list.innerHTML=entries.map(([code,info])=>`<label class="fp-opt"><input type="checkbox" name="airline" value="${code}" checked><img class="fp-airline-logo" src="${this.airlineLogo(code)}" alt="${code}" onerror="this.style.display='none'"><span class="fp-airline-name">${info.name}</span><span class="fp-airline-price">a partir de ${this.fmtPrice(info.minPrice)}</span></label>`).join('');
        list.querySelectorAll('input[name="airline"]').forEach(cb=>cb.addEventListener('change',()=>this.onAirlineChange()));
    },

    onAirlineChange(){
        const checked=[...document.querySelectorAll('#fp-airline-list input:checked')].map(i=>i.value);
        const total=document.querySelectorAll('#fp-airline-list input').length;
        this.state.filters.airlines=checked.length===total?'all':new Set(checked);
        this.applyFilters();
    },

    // ================================================================
    // SETUP SORT + FILTER UI
    // ================================================================
    setupSortTabs(){
        document.querySelectorAll('.sort-tab').forEach(tab=>{
            tab.addEventListener('click',()=>{
                document.querySelectorAll('.sort-tab').forEach(t=>t.classList.remove('active'));
                tab.classList.add('active');this.state.sortBy=tab.dataset.sort;this.state.displayedCount=0;this.renderCards();
            });
        });
    },

    setupFilterChips(){
        const map={'fc-stops':'fp-stops','fc-airlines':'fp-airlines','fc-times':'fp-times','fc-price':'fp-price','fc-duration':'fp-duration'};
        for(const[cid,pid]of Object.entries(map)){
            const el = document.getElementById(cid);
            if(el) el.addEventListener('click',e=>{e.stopPropagation();this.togglePanel(pid);});
        }
        document.getElementById('fc-clear')?.addEventListener('click',()=>{this.resetFilters();this.populateAirlinesFilter();this.applyFilters();});
        document.addEventListener('click',e=>{if(this.state.activePanel){const p=document.getElementById(this.state.activePanel);if(p&&!p.contains(e.target)&&!e.target.closest('.filter-chip'))this.closePanel();}});
        document.getElementById('filter-overlay')?.addEventListener('click',()=>this.closePanel());
    },

    setupFilterPanels(){
        document.querySelectorAll('.fp-close').forEach(b=>b.addEventListener('click',()=>this.closePanel()));
        // Stops
        document.querySelectorAll('#fp-stops input[name="stops"]').forEach(cb=>{
            cb.addEventListener('change',()=>{
                if(cb.value==='all'){document.querySelectorAll('#fp-stops input').forEach(i=>i.checked=cb.checked);this.state.filters.stops='all';}
                else{document.querySelector('#fp-stops input[value="all"]').checked=false;const c=[...document.querySelectorAll('#fp-stops input:checked:not([value="all"])')].map(i=>parseInt(i.value));this.state.filters.stops=c.length===0||c.length===3?'all':c;if(this.state.filters.stops==='all')document.querySelector('#fp-stops input[value="all"]').checked=true;}
                this.applyFilters();
            });
        });
        // Airlines actions
        document.getElementById('fp-airlines-all')?.addEventListener('click',()=>{document.querySelectorAll('#fp-airline-list input').forEach(i=>i.checked=true);this.state.filters.airlines='all';this.applyFilters();});
        document.getElementById('fp-airlines-none')?.addEventListener('click',()=>{document.querySelectorAll('#fp-airline-list input').forEach(i=>i.checked=false);this.state.filters.airlines=new Set();this.applyFilters();});
        // Time sliders — 4 sections: depGo, arrGo, depRet, arrRet
        const ts=[
            ['fr-dep-go-min','fr-dep-go-max','fv-dep-go-min','fv-dep-go-max','depGoMin','depGoMax'],
            ['fr-arr-go-min','fr-arr-go-max','fv-arr-go-min','fv-arr-go-max','arrGoMin','arrGoMax'],
            ['fr-dep-ret-min','fr-dep-ret-max','fv-dep-ret-min','fv-dep-ret-max','depRetMin','depRetMax'],
            ['fr-arr-ret-min','fr-arr-ret-max','fv-arr-ret-min','fv-arr-ret-max','arrRetMin','arrRetMax']
        ];
        for(const[minId,maxId,minL,maxL,minK,maxK]of ts){
            const mn=document.getElementById(minId),mx=document.getElementById(maxId);if(!mn||!mx)continue;
            const upd=()=>{
                const mnEl=document.getElementById(minL), mxEl=document.getElementById(maxL);
                if(mnEl) mnEl.textContent=this.fmtMinToTime(parseInt(mn.value));
                if(mxEl) mxEl.textContent=this.fmtMinToTime(parseInt(mx.value));
            };
            mn.addEventListener('input',()=>{if(parseInt(mn.value)>parseInt(mx.value))mn.value=mx.value;this.state.filters[minK]=parseInt(mn.value);upd();});
            mx.addEventListener('input',()=>{if(parseInt(mx.value)<parseInt(mn.value))mx.value=mn.value;this.state.filters[maxK]=parseInt(mx.value);upd();});
            mn.addEventListener('change',()=>this.applyFilters());
            mx.addEventListener('change',()=>this.applyFilters());
        }
        // Price slider
        const ps=document.getElementById('fr-price-max');
        if(ps){ps.addEventListener('input',()=>{this.state.filters.priceMax=parseInt(ps.value);document.getElementById('fv-price-max').textContent=this.fmtPrice(parseInt(ps.value));});ps.addEventListener('change',()=>this.applyFilters());}
        // Duration slider
        const ds=document.getElementById('fr-duration-max');
        if(ds){ds.addEventListener('input',()=>{this.state.filters.durationMax=parseInt(ds.value);document.getElementById('fv-dur-val').textContent=this.fmtDuration(parseInt(ds.value));});ds.addEventListener('change',()=>this.applyFilters());}
        // Load more
        document.getElementById('btn-load-more')?.addEventListener('click',()=>{this.state.displayedCount+=this.state.perPage;this.renderCards(true);});
    },

    togglePanel(pid){
        if(this.state.activePanel===pid){this.closePanel();return;}
        this.closePanel();
        const p=document.getElementById(pid);
        if(p){p.style.display='block';this.state.activePanel=pid;document.getElementById('filter-overlay').classList.add('open');
        const cm={'fp-stops':'fc-stops','fp-airlines':'fc-airlines','fp-times':'fc-times','fp-price':'fc-price','fp-duration':'fc-duration'};
        document.getElementById(cm[pid])?.classList.add('active');}
    },

    closePanel(){
        if(this.state.activePanel){const el=document.getElementById(this.state.activePanel);if(el)el.style.display='none';}
        document.querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('active'));
        this.updateChipStates();this.state.activePanel=null;
        document.getElementById('filter-overlay').classList.remove('open');
    },

    // ================================================================
    // FILTERS
    // ================================================================
    resetFilters(){
        this.state.filters={stops:'all',airlines:'all',depGoMin:0,depGoMax:1439,arrGoMin:0,arrGoMax:1439,depRetMin:0,depRetMax:1439,arrRetMin:0,arrRetMax:1439,priceMax:Infinity,durationMax:Infinity};
        document.querySelectorAll('#fp-stops input').forEach(i=>i.checked=true);
        document.querySelectorAll('#fp-airline-list input').forEach(i=>i.checked=true);
        // Reset all time sliders
        ['fr-dep-go-min','fr-arr-go-min','fr-dep-ret-min','fr-arr-ret-min'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=0;});
        ['fr-dep-go-max','fr-arr-go-max','fr-dep-ret-max','fr-arr-ret-max'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=1439;});
        ['fv-dep-go-min','fv-arr-go-min','fv-dep-ret-min','fv-arr-ret-min'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='00:00';});
        ['fv-dep-go-max','fv-arr-go-max','fv-dep-ret-max','fv-arr-ret-max'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='23:59';});
        const ps=document.getElementById('fr-price-max');if(ps)ps.value=ps.max;
        const ds=document.getElementById('fr-duration-max');if(ds)ds.value=ds.max;
        this.updateChipStates();
        document.getElementById('active-filters').style.display='none';
        const fcClear = document.getElementById('fc-clear');
        if(fcClear) fcClear.style.display='none';
    },

    applyFilters(){this.state.displayedCount=0;this.updateChipStates();this.updateActiveTags();this.renderCards();},

    updateChipStates(){
        const f=this.state.filters;
        const s=(id,c)=>{const el=document.getElementById(id);if(el)el.classList.toggle('has-filter',c);};
        s('fc-stops',f.stops!=='all');
        s('fc-airlines',f.airlines!=='all');
        s('fc-times',f.depGoMin>0||f.depGoMax<1439||f.arrGoMin>0||f.arrGoMax<1439||f.depRetMin>0||f.depRetMax<1439||f.arrRetMin>0||f.arrRetMax<1439);
        s('fc-price',f.priceMax!==Infinity&&f.priceMax<this.state.priceBounds.max);
        s('fc-duration',f.durationMax!==Infinity&&f.durationMax<this.state.durationBounds.max);
        const fcClear = document.getElementById('fc-clear');
        if(fcClear) fcClear.style.display=document.querySelector('.filter-chip.has-filter')?'inline-flex':'none';
    },

    updateActiveTags(){
        const f=this.state.filters, tags=[];
        if(f.stops!=='all')tags.push({label:`Paradas: ${f.stops.map(s=>s===0?'Direto':s===1?'1':'+2').join(', ')}`,clear:()=>{f.stops='all';document.querySelectorAll('#fp-stops input').forEach(i=>i.checked=true);}});
        if(f.airlines!=='all'){const n=f.airlines.size,t=Object.keys(this.state.allAirlines).length;tags.push({label:`${n}/${t} cias`,clear:()=>{f.airlines='all';document.querySelectorAll('#fp-airline-list input').forEach(i=>i.checked=true);}});}
        if(f.priceMax!==Infinity&&f.priceMax<this.state.priceBounds.max)tags.push({label:`Até ${this.fmtPrice(f.priceMax)}`,clear:()=>{f.priceMax=Infinity;const s=document.getElementById('fr-price-max');if(s)s.value=s.max;}});
        if(f.durationMax!==Infinity&&f.durationMax<this.state.durationBounds.max)tags.push({label:`Até ${this.fmtDuration(f.durationMax)}`,clear:()=>{f.durationMax=Infinity;const s=document.getElementById('fr-duration-max');if(s)s.value=s.max;}});
        // Time filters
        if(f.depGoMin>0||f.depGoMax<1439)tags.push({label:`Partida ida: ${this.fmtMinToTime(f.depGoMin)}–${this.fmtMinToTime(f.depGoMax)}`,clear:()=>{f.depGoMin=0;f.depGoMax=1439;const mn=document.getElementById('fr-dep-go-min'),mx=document.getElementById('fr-dep-go-max');if(mn)mn.value=0;if(mx)mx.value=1439;}});
        if(f.arrGoMin>0||f.arrGoMax<1439)tags.push({label:`Chegada ida: ${this.fmtMinToTime(f.arrGoMin)}–${this.fmtMinToTime(f.arrGoMax)}`,clear:()=>{f.arrGoMin=0;f.arrGoMax=1439;const mn=document.getElementById('fr-arr-go-min'),mx=document.getElementById('fr-arr-go-max');if(mn)mn.value=0;if(mx)mx.value=1439;}});
        const c=document.getElementById('active-filters'),l=document.getElementById('active-filters-list');
        if(!tags.length){c.style.display='none';return;}
        c.style.display='block';
        l.innerHTML=tags.map((t,i)=>`<span class="af-tag">${t.label}<button data-i="${i}">✕</button></span>`).join('');
        l.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{tags[parseInt(b.dataset.i)].clear();this.applyFilters();}));
    },

    // ================================================================
    // GET FILTERED + SORTED
    // ================================================================
    getFiltered(){
        const f=this.state.filters;
        let list=[...this.state.proposals];
        if(f.stops!=='all'){const a=f.stops.map(Number);list=list.filter(p=>{const ms=p.max_stops||Math.max(...(p.segments||[]).map(s=>s.stops));return a.some(v=>v===2?ms>=2:ms===v);});}
        if(f.airlines!=='all'&&f.airlines.size>0)list=list.filter(p=>(p.carriers||[]).some(c=>f.airlines.has(c)));
        else if(f.airlines!=='all'&&f.airlines.size===0)list=[];
        list=list.filter(p=>{
            const segs=p.segments||[];const ida=segs[0],volta=segs[1];
            if(ida){const d=this.timeToMin(ida.departure_time),a=this.timeToMin(ida.arrival_time);if(d<f.depGoMin||d>f.depGoMax||a<f.arrGoMin||a>f.arrGoMax)return false;}
            if(volta){const d=this.timeToMin(volta.departure_time),a=this.timeToMin(volta.arrival_time);if(d<f.depRetMin||d>f.depRetMax||a<f.arrRetMin||a>f.arrRetMax)return false;}
            return true;
        });
        if(f.priceMax!==Infinity)list=list.filter(p=>this.pricePerPerson(p.price)<=f.priceMax);
        if(f.durationMax!==Infinity)list=list.filter(p=>{const d=p.segments?.[0]?.total_duration||p.total_duration;return d<=f.durationMax;});
        switch(this.state.sortBy){
            case'cheapest':list.sort((a,b)=>a.price-b.price);break;
            case'fastest':list.sort((a,b)=>(a.total_duration||Infinity)-(b.total_duration||Infinity));break;
            case'best':list.sort((a,b)=>(a.price/1000+(a.total_duration||0)/60)-(b.price/1000+(b.total_duration||0)/60));break;
        }
        return list;
    },

    // ================================================================
    // RENDER
    // ================================================================
    renderCards(append=false){
        const sorted=this.getFiltered();
        if(sorted.length>0){
            const ch=[...sorted].sort((a,b)=>a.price-b.price)[0];
            const fa=[...sorted].sort((a,b)=>(a.total_duration||Infinity)-(b.total_duration||Infinity))[0];
            const be=[...sorted].sort((a,b)=>(a.price/1000+(a.total_duration||0)/60)-(b.price/1000+(b.total_duration||0)/60))[0];
            document.getElementById('sv-cheap').textContent=this.fmtPrice(this.pricePerPerson(ch.price));
            document.getElementById('sv-fast').textContent=this.fmtDuration(fa.total_duration);
            document.getElementById('sv-best').textContent=this.fmtPrice(this.pricePerPerson(be.price));
        }
        document.getElementById('r-count').textContent=`${sorted.length} resultado${sorted.length!==1?'s':''}`;
        const cur=this.CURRENCY[this.state.params.currency]||this.CURRENCY.BRL;
        document.getElementById('r-currency').textContent=`Preços por pessoa em ${cur.name} (${this.state.params.currency})`;
        const container=document.getElementById('results-list');
        if(!append){this.state.displayedCount=Math.min(this.state.perPage,sorted.length);container.innerHTML=sorted.slice(0,this.state.displayedCount).map(p=>this.cardHtml(p)).join('');}
        else{this.state.displayedCount=Math.min(this.state.displayedCount,sorted.length);container.insertAdjacentHTML('beforeend',sorted.slice(container.children.length,this.state.displayedCount).map(p=>this.cardHtml(p)).join(''));}
        const lm=document.getElementById('load-more-wrap');if(lm)lm.style.display=this.state.displayedCount<sorted.length?'block':'none';
    },

    cardHtml(p){
        const pp=this.pricePerPerson(p.price);
        const isRet=p.segments?.length>1;
        const operatorCount = (p.all_terms || []).length;
        const segs=(p.segments||[]).map(seg=>{
            const al=seg.flights[0]?.airline||'',aln=seg.flights[0]?.airline_name||al;
            const via=seg.flights.length>1?seg.flights.slice(0,-1).map(f=>f.arrival_airport).join(', '):'';
            return`<div class="fc-seg"><div class="fc-seg-time"><div class="fc-time">${this.fmtTime(seg.departure_time)}</div><div class="fc-airport">${seg.departure_airport}</div></div><div class="fc-line"><span class="fc-dur">${this.fmtDuration(seg.total_duration)}</span><div class="fc-line-bar"></div><span class="fc-stops ${this.stopsClass(seg.stops)}">${this.stopsText(seg.stops)}</span>${via?`<span class="fc-stop-via">${via}</span>`:''}</div><div class="fc-seg-time"><div class="fc-time">${this.fmtTime(seg.arrival_time)}</div><div class="fc-airport">${seg.arrival_airport}</div></div><div class="fc-airline"><img class="fc-al-logo" src="${this.airlineLogo(al)}" alt="${aln}" onerror="this.style.display='none'"><span class="fc-al-name">${aln}</span></div></div>`;
        }).join('');
        const others=(p.all_terms||[]).slice(1,8);
        const more=others.length>0?`<div class="fc-more-toggle"><button class="fc-more-btn" onclick="BenetripVoos.toggleMore(this)">+${others.length} oferta${others.length>1?'s':''} de outr${others.length>1?'as agências':'a agência'}</button></div><div class="fc-more-list">${others.map(t=>`<div class="fc-mo-row"><span class="fc-mo-gate">${t.gate_name}</span><span class="fc-mo-price">${this.fmtPrice(this.pricePerPerson(t.price))}</span><button class="fc-mo-book" onclick="BenetripVoos.book('${this.state.searchId}','${t.url}',this)">Reservar</button></div>`).join('')}</div>`:'';
        return`<div class="flight-card"><div class="fc-main"><div class="fc-segments">${segs}</div><div class="fc-price-panel"><div><div class="fc-price">${this.fmtPrice(pp)}</div><div class="fc-price-lbl">por pessoa · ${isRet?'ida e volta':'só ida'}</div><div class="fc-gate">${p.gate_name}${operatorCount>1?` <span class="fc-gate-more">+${operatorCount-1}</span>`:''}</div></div><button class="fc-book" onclick="BenetripVoos.book('${this.state.searchId}','${p.terms_url}',this)">Reservar →</button></div></div>${more}</div>`;
    },

    toggleMore(btn){const l=btn.closest('.flight-card').querySelector('.fc-more-list');if(l){l.classList.toggle('open');btn.textContent=l.classList.contains('open')?'Menos ofertas':btn.textContent;}},

    // ================================================================
    // BOOKING
    // ================================================================
    async book(searchId,termsUrl,btn){
        if(!searchId||!termsUrl){alert('Dados indisponíveis. Busque novamente.');return;}
        const orig=btn.textContent;btn.textContent='Abrindo...';btn.classList.add('loading');
        try{
            const r=await fetch('/api/flight-click',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({search_id:searchId,terms_url:termsUrl})});
            if(!r.ok)throw new Error(`Erro ${r.status}`);
            const data=await r.json();
            if(data.method==='POST'&&data.params&&Object.keys(data.params).length>0)this.postRedirect(data.url,data.params);
            else window.open(data.url,'_blank');
        }catch(e){console.error('❌',e);alert('Link indisponível. Resultados expiram em 15 min.');}
        finally{btn.textContent=orig;btn.classList.remove('loading');}
    },

    postRedirect(url,params){
        const form=document.getElementById('redirect-form');form.action=url;form.target='_blank';form.innerHTML='';
        for(const[k,v]of Object.entries(params)){const i=document.createElement('input');i.type='hidden';i.name=k;i.value=v;form.appendChild(i);}
        form.submit();
    },
};

document.addEventListener('DOMContentLoaded',()=>BenetripVoos.init());