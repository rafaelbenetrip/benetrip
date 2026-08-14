/**
 * benetrip-shared-ui.js - COMPONENTES COMPARTILHADOS DA BENETRIP v1.0
 *
 * Peças que várias ferramentas precisam falar da mesma forma:
 *
 *   BenetripSafe          escapeHtml / sanitizeText / safeUrl / safeHref
 *   BenetripPrice         normalização monetária única (evita R$ 786 vs R$ 787)
 *   BenetripUI.aeroporto  destino x aeroporto x trecho aéreo x deslocamento
 *   BenetripUI.fonte      atribuição de fonte ("Ver fonte")
 *   BenetripUI.frescor    "atualizado em ..." / dado indisponível
 *   BenetripUI.tarifa     rótulos de completude da tarifa
 *   BenetripUI.viabilidade  rótulo de viabilidade de viagem curta
 *
 * Carregar ANTES dos scripts de página. Sem dependências externas.
 */
(function (global) {
    'use strict';

    // ============================================================
    // SEGURANÇA DE CONTEÚDO
    // Nada vindo de IA, fornecedor ou do próprio usuário entra em innerHTML
    // sem passar por aqui.
    // ============================================================
    var PROTOCOLOS_OK = ['https:', 'mailto:'];

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeText(text, maxLength) {
        var limite = maxLength || 600;
        var bruto = String(text === null || text === undefined ? '' : text)
            .replace(/[\u0000-\u001f\u007f]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (bruto.length > limite) bruto = bruto.slice(0, limite - 1) + '…';
        return escapeHtml(bruto);
    }

    // URL externa só vira href se for https (ou caminho interno).
    function safeUrl(url) {
        var bruto = String(url === null || url === undefined ? '' : url).trim();
        if (!bruto) return null;
        if (bruto.charAt(0) === '/' && bruto.slice(0, 2) !== '//') return bruto;
        try {
            var parsed = new URL(bruto, global.location ? global.location.origin : undefined);
            if (PROTOCOLOS_OK.indexOf(parsed.protocol) === -1) return null;
            return parsed.toString();
        } catch (e) {
            return null;
        }
    }

    function safeHref(url) {
        var limpa = safeUrl(url);
        return limpa ? escapeHtml(limpa) : '';
    }

    function dominioDe(url) {
        var limpa = safeUrl(url);
        if (!limpa) return '';
        try {
            return new URL(limpa).hostname.replace(/^www\./, '');
        } catch (e) {
            return '';
        }
    }

    // Insere texto com segurança sem passar por innerHTML
    function setText(el, texto) {
        if (el) el.textContent = texto === null || texto === undefined ? '' : String(texto);
    }

    // ============================================================
    // PREÇOS — método único de arredondamento
    // ============================================================
    var SIMBOLOS = { BRL: 'R$', USD: 'US$', EUR: '€' };

    function simbolo(moeda) {
        return SIMBOLOS[String(moeda || '').toUpperCase()] || 'R$';
    }

    function normalizarValor(valor) {
        if (valor === null || valor === undefined || valor === '') return null;
        var n = typeof valor === 'number' ? valor : Number(valor);
        if (!isFinite(n)) return null;
        return Math.round(n);
    }

    // Zero sem fonte confirmada é dado ausente, não "de graça"
    function normalizarValorOpcional(valor) {
        var n = normalizarValor(valor);
        return n === null || n <= 0 ? null : n;
    }

    // Sempre a partir do total BRUTO: nunca divide um valor já arredondado
    function porPessoa(total, pax) {
        var bruto = typeof total === 'number' ? total : Number(total);
        if (!isFinite(bruto)) return null;
        var pessoas = Math.max(1, Math.round(Number(pax) || 1));
        return Math.round(bruto / pessoas);
    }

    function formatarValor(valor) {
        var n = normalizarValor(valor);
        if (n === null) return '';
        return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    function formatarPreco(valor, moeda) {
        var txt = formatarValor(valor);
        return txt ? simbolo(moeda) + ' ' + txt : '';
    }

    function mesmoValorExibido(a, b) {
        var na = normalizarValor(a);
        var nb = normalizarValor(b);
        return na !== null && nb !== null && na === nb;
    }

    // ============================================================
    // DESTINO x AEROPORTO
    //
    // Preço de voo, aeroporto e destino turístico são coisas diferentes.
    // "Direto" qualifica o voo ATÉ O AEROPORTO, nunca a chegada ao destino.
    //
    // opts: {
    //   destino, aeroporto, paradas, duracaoVooMin,
    //   lugaresNoMesmoAeroporto,   // quantos lugares desta lista usam o aeroporto
    //   deslocamento: { distanciaKm, duracaoMin, fonte, fonteUrl } | null
    // }
    // ============================================================
    function textoTrechoAereo(opts) {
        var o = opts || {};
        var iata = String(o.aeroporto || '').toUpperCase();
        var paradas = Number(o.paradas || 0);
        if (!iata) {
            return paradas === 0 ? 'Voo direto' : paradas === 1 ? '1 parada' : paradas + ' paradas';
        }
        if (paradas === 0) return 'Voo direto até ' + iata;
        if (paradas === 1) return 'Voo com 1 parada até ' + iata;
        return 'Voo com ' + paradas + ' paradas até ' + iata;
    }

    // O texto depende da QUALIDADE do dado:
    //   'rota'       provedor de rotas devolveu distância e tempo
    //   'linha_reta' só geocodificação: distância em linha reta, sem tempo
    //   'proximo'    aeroporto praticamente no destino, nada a avisar
    // Sem dado nenhum devolve '' — a interface nunca estima tempo por conta.
    function textoDeslocamento(opts) {
        var o = opts || {};
        var desl = o.deslocamento;
        if (!desl || desl.tipo === 'proximo') return '';
        var lugar = o.destino || 'o destino';

        if (desl.tipo === 'rota' && desl.duracaoMin > 0) {
            var h = Math.floor(desl.duracaoMin / 60);
            var m = Math.round(desl.duracaoMin % 60);
            var tempo = h > 0 ? h + 'h' + (m ? String(m).padStart(2, '0') : '') : m + ' min';
            var dist = desl.distanciaKm > 0 ? Math.round(desl.distanciaKm) + ' km, ' : '';
            return 'Do aeroporto até ' + lugar + ': ' + dist + 'cerca de ' + tempo +
                ' de carro. Esse trajeto não está incluído no preço.';
        }

        if (desl.distanciaKm > 0) {
            return lugar + ' fica a cerca de ' + Math.round(desl.distanciaKm) +
                ' km em linha reta do aeroporto. O tempo de deslocamento não foi calculado e não está incluído no preço.';
        }

        return '';
    }

    function aeroportoDisclosureHtml(opts) {
        var o = opts || {};
        var iata = escapeHtml(String(o.aeroporto || '').toUpperCase());
        if (!iata) return '';

        var linhas = [];
        linhas.push('<span class="ad-trecho">' + escapeHtml(textoTrechoAereo(o)) + '</span>');

        var compartilham = Number(o.lugaresNoMesmoAeroporto || 0);
        if (compartilham > 1) {
            var outros = compartilham - 1;
            linhas.push('<span class="ad-compartilhado">Esta tarifa também aparece para ' +
                (outros === 1 ? 'outro lugar servido' : 'outros ' + outros + ' lugares servidos') +
                ' por ' + iata + '.</span>');
        }

        var desl = textoDeslocamento(o);
        if (desl) {
            var fonte = o.deslocamento && o.deslocamento.fonte
                ? ' <span class="ad-fonte">' + fonteHtml(o.deslocamento.fonte, o.deslocamento.fonteUrl) + '</span>'
                : '';
            linhas.push('<span class="ad-deslocamento">' + escapeHtml(desl) + fonte + '</span>');
        } else if (compartilham > 1) {
            linhas.push('<span class="ad-deslocamento">O destino final pode exigir deslocamento terrestre a partir do aeroporto. Esse trajeto não está incluído no preço.</span>');
        }

        return '<div class="airport-disclosure" data-aeroporto="' + iata + '">' + linhas.join('') + '</div>';
    }

    // ============================================================
    // ATRIBUIÇÃO DE FONTE — link discreto "Ver fonte"
    // ============================================================
    function fonteHtml(nome, url) {
        var href = safeHref(url);
        var rotulo = nome ? escapeHtml(nome) : dominioDe(url) || 'fonte';
        if (!href) return '<span class="source-attribution source-sem-link">Fonte: ' + rotulo + '</span>';
        return '<a class="source-attribution" href="' + href + '" target="_blank" rel="noopener nofollow" ' +
            'title="Abrir ' + rotulo + '">Ver fonte (' + rotulo + ')</a>';
    }

    // Afirmação sem fonte confiável nunca é apresentada como certeza
    function naoVerificadoHtml(texto) {
        return '<span class="info-nao-verificada" role="note">' +
            '<span class="info-nao-verificada-tag">Informação não verificada</span> ' +
            sanitizeText(texto) + '</span>';
    }

    // ============================================================
    // FRESCOR DO DADO
    // ============================================================
    function frescorHtml(isoOuData, prefixo) {
        if (!isoOuData) return '';
        var d = isoOuData instanceof Date ? isoOuData : new Date(isoOuData);
        if (isNaN(d.getTime())) return '';
        var txt = d.toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        });
        return '<span class="data-freshness">' + escapeHtml((prefixo || 'Preço atualizado em') + ' ' + txt) + '</span>';
    }

    // ============================================================
    // COMPLETUDE DA TARIFA
    // ============================================================
    var TARIFA_LABELS = {
        bookable_round_trip: { curto: 'Tarifa completa', icone: '✓', classe: 'quote-completa' },
        indicative_round_trip: { curto: 'Valor indicativo', icone: '≈', classe: 'quote-indicativa' },
        outbound_only: { curto: 'Só ida', icone: '→', classe: 'quote-so-ida' },
        unknown: { curto: 'Sem dados suficientes', icone: '?', classe: 'quote-insuficiente' },
    };

    function tarifaLabel(quoteType) {
        return TARIFA_LABELS[quoteType] || TARIFA_LABELS.unknown;
    }

    // ============================================================
    // VIABILIDADE (rótulo; a regra é calculada no servidor)
    // ============================================================
    var VIABILIDADE_LABELS = {
        boa: { texto: 'Boa para a janela', classe: 'viab-boa', icone: '✓' },
        aceitavel: { texto: 'Dá para ir, com atenção ao tempo de voo', classe: 'viab-aceitavel', icone: '!' },
        inviavel: { texto: 'Não recomendada para uma viagem tão curta', classe: 'viab-inviavel', icone: '✕' },
        desconhecida: { texto: 'Duração do voo não informada', classe: 'viab-desconhecida', icone: '?' },
    };

    function viabilidadeLabel(nivel) {
        return VIABILIDADE_LABELS[nivel] || VIABILIDADE_LABELS.desconhecida;
    }

    global.BenetripSafe = {
        escapeHtml: escapeHtml,
        sanitizeText: sanitizeText,
        safeUrl: safeUrl,
        safeHref: safeHref,
        dominioDe: dominioDe,
        setText: setText,
    };

    global.BenetripPrice = {
        simbolo: simbolo,
        normalizarValor: normalizarValor,
        normalizarValorOpcional: normalizarValorOpcional,
        porPessoa: porPessoa,
        formatarValor: formatarValor,
        formatarPreco: formatarPreco,
        mesmoValorExibido: mesmoValorExibido,
    };

    global.BenetripUI = {
        aeroportoDisclosureHtml: aeroportoDisclosureHtml,
        textoTrechoAereo: textoTrechoAereo,
        textoDeslocamento: textoDeslocamento,
        fonteHtml: fonteHtml,
        naoVerificadoHtml: naoVerificadoHtml,
        frescorHtml: frescorHtml,
        tarifaLabel: tarifaLabel,
        viabilidadeLabel: viabilidadeLabel,
    };
})(typeof window !== 'undefined' ? window : globalThis);
