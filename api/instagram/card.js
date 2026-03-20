// api/instagram/card.js - Gerador de Cards Branded para Instagram (Node.js)
// Gera imagens 1080x1080 PNG com layout branded da Benetrip
//
// ENDPOINT: GET /api/instagram/card?f=FORMAT&PARAMS...
// Retorna: image/png (ou image/svg+xml como fallback)
//
// FORMATOS:
//   descobridor - Card com pedido da persona → resultado da Tripinha
//   top5        - Top 5 destinos mais baratos
//   economia    - Comparação de preço (caiu!)
//   origens     - Mesmo destino, diferentes origens
//   roteiro     - Roteiro dia-a-dia
//   ranking     - Ranking semanal de destinos

// Imports dinâmicos para capturar erros de módulo
let _satori = null;
let _sharp = null;

async function getSatori() {
    if (!_satori) {
        const mod = await import('satori');
        _satori = mod.default;
    }
    return _satori;
}

async function getSharp() {
    if (!_sharp) {
        const mod = await import('sharp');
        _sharp = mod.default;
    }
    return _sharp;
}

export const maxDuration = 30;

// Cache da fonte para não baixar toda vez
let fontCache = null;

async function loadFont() {
    if (fontCache) return fontCache;

    // Satori só aceita .ttf ou .woff (NÃO woff2)
    const fontUrls = [
        'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf',
        'https://cdn.jsdelivr.net/gh/rsms/inter@v4.0/docs/font-files/Inter-Regular.woff',
        'https://raw.githubusercontent.com/rsms/inter/v4.0/docs/font-files/Inter-Regular.woff',
    ];

    for (const url of fontUrls) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                fontCache = await res.arrayBuffer();
                console.log(`Fonte carregada: ${url} (${fontCache.byteLength} bytes)`);
                return fontCache;
            }
        } catch (err) {
            console.warn(`Fonte ${url}: ${err.message}`);
        }
    }

    // Último fallback: Google Fonts CSS pedindo TTF
    try {
        const cssRes = await fetch(
            'https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap',
            // User-Agent antigo força Google a retornar TTF em vez de woff2
            { headers: { 'User-Agent': 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)' } }
        );
        const css = await cssRes.text();
        const urlMatch = css.match(/src:\s*url\(([^)]+)\)\s*format\('truetype'\)/);
        if (urlMatch) {
            const fontRes = await fetch(urlMatch[1]);
            fontCache = await fontRes.arrayBuffer();
            return fontCache;
        }
    } catch (err) {
        console.error('Falha total ao carregar fonte:', err.message);
    }

    throw new Error('Não conseguiu carregar nenhuma fonte');
}

// Helper para criar elementos sem JSX
function h(type, props, ...children) {
    const flatChildren = children.flat().filter(c => c != null);
    return {
        type,
        props: {
            ...props,
            children: flatChildren.length === 0 ? undefined :
                flatChildren.length === 1 ? flatChildren[0] : flatChildren,
        },
    };
}

// ============================================================
// CORES E ESTILOS POR FORMATO
// ============================================================
const TEMAS = {
    descobridor: {
        bg: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0d9488 100%)',
        accent: '#f97316',
        badge: '🐾 TRIPINHA DESCOBRIU!',
        badgeBg: '#f97316',
    },
    top5: {
        bg: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%)',
        accent: '#fbbf24',
        badge: '🔥 TOP 5 MAIS BARATOS',
        badgeBg: '#dc2626',
    },
    economia: {
        bg: 'linear-gradient(135deg, #065f46 0%, #047857 50%, #059669 100%)',
        accent: '#34d399',
        badge: '📉 PREÇO CAIU!',
        badgeBg: '#059669',
    },
    origens: {
        bg: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 50%, #3b82f6 100%)',
        accent: '#93c5fd',
        badge: '✈️ DE ONDE SAI MAIS BARATO?',
        badgeBg: '#2563eb',
    },
    roteiro: {
        bg: 'linear-gradient(135deg, #92400e 0%, #b45309 50%, #d97706 100%)',
        accent: '#fde68a',
        badge: '📋 ROTEIRO COMPLETO',
        badgeBg: '#b45309',
    },
    ranking: {
        bg: 'linear-gradient(135deg, #581c87 0%, #7c3aed 50%, #8b5cf6 100%)',
        accent: '#c4b5fd',
        badge: '🏆 RANKING DA SEMANA',
        badgeBg: '#7c3aed',
    },
};

// ============================================================
// LAYOUT: DESCOBRIDOR (Dom/Sab)
// ============================================================
function cardDescobridor(params) {
    const tema = TEMAS.descobridor;
    const pedido = decodeURIComponent(params.get('q') || 'Quero viajar a dois com praia');
    const destino = decodeURIComponent(params.get('dn') || 'Destino');
    const pais = decodeURIComponent(params.get('dp') || '');
    const preco = params.get('pr') || '0';
    const checks = [];
    for (let i = 1; i <= 4; i++) {
        const c = params.get(`c${i}`);
        if (c) checks.push(decodeURIComponent(c));
    }
    const persona = decodeURIComponent(params.get('pn') || '');

    return h('div', {
        style: {
            display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
            background: tema.bg, padding: '60px', fontFamily: 'sans-serif', color: 'white',
        },
    },
        // Header
        h('div', {
            style: {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '40px',
            },
        },
            h('div', {
                style: {
                    display: 'flex', background: tema.badgeBg, padding: '12px 28px',
                    borderRadius: '50px', fontSize: '28px', fontWeight: 'bold',
                },
            }, tema.badge),
            h('div', {
                style: { display: 'flex', fontSize: '24px', opacity: '0.8' },
            }, 'benetrip.com.br'),
        ),
        // Persona quote
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column',
                background: 'rgba(255,255,255,0.1)', borderRadius: '24px',
                padding: '36px', marginBottom: '36px', border: '2px solid rgba(255,255,255,0.2)',
            },
        },
            persona ? h('div', {
                style: { display: 'flex', fontSize: '22px', opacity: '0.7', marginBottom: '12px' },
            }, persona) : null,
            h('div', {
                style: {
                    display: 'flex', fontSize: '30px', fontStyle: 'italic', lineHeight: '1.4',
                },
            }, `"${pedido}"`),
        ),
        // Arrow
        h('div', {
            style: {
                display: 'flex', justifyContent: 'center', fontSize: '48px',
                marginBottom: '24px',
            },
        }, '⬇️'),
        // Result
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column', flex: '1',
                background: 'rgba(0,0,0,0.3)', borderRadius: '24px',
                padding: '40px', border: `3px solid ${tema.accent}`,
            },
        },
            h('div', {
                style: {
                    display: 'flex', alignItems: 'baseline', marginBottom: '20px',
                    flexWrap: 'wrap', gap: '12px',
                },
            },
                h('div', {
                    style: { display: 'flex', fontSize: '52px', fontWeight: 'bold' },
                }, destino),
                pais ? h('div', {
                    style: { display: 'flex', fontSize: '32px', opacity: '0.8' },
                }, pais) : null,
            ),
            h('div', {
                style: {
                    display: 'flex', alignItems: 'baseline', marginBottom: '28px', gap: '8px',
                },
            },
                h('div', {
                    style: { display: 'flex', fontSize: '24px', opacity: '0.7' },
                }, 'a partir de'),
                h('div', {
                    style: {
                        display: 'flex', fontSize: '56px', fontWeight: 'bold',
                        color: tema.accent,
                    },
                }, `R$${preco}`),
            ),
            // Checkmarks
            h('div', {
                style: { display: 'flex', flexDirection: 'column', gap: '12px' },
            },
                ...checks.map(check =>
                    h('div', {
                        style: { display: 'flex', alignItems: 'center', fontSize: '26px', gap: '12px' },
                    },
                        h('div', {
                            style: {
                                display: 'flex', background: '#10b981', borderRadius: '50%',
                                width: '36px', height: '36px', alignItems: 'center',
                                justifyContent: 'center', fontSize: '20px',
                            },
                        }, '✓'),
                        h('div', { style: { display: 'flex' } }, check),
                    )
                ),
            ),
        ),
        // Footer
        h('div', {
            style: {
                display: 'flex', justifyContent: 'center', marginTop: '32px',
                fontSize: '26px', opacity: '0.8',
            },
        }, 'Diga o que precisa, a Tripinha encontra! 🐾'),
    );
}

// ============================================================
// LAYOUT: TOP 5 (Seg)
// ============================================================
function cardTop5(params) {
    const tema = TEMAS.top5;
    const origem = decodeURIComponent(params.get('o') || 'São Paulo');
    const destinos = [];
    for (let i = 1; i <= 5; i++) {
        const n = params.get(`d${i}n`);
        const p = params.get(`d${i}p`);
        const f = params.get(`d${i}f`); // flag emoji
        if (n && p) destinos.push({ nome: decodeURIComponent(n), preco: p, flag: f ? decodeURIComponent(f) : '' });
    }

    const medalhas = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

    return h('div', {
        style: {
            display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
            background: tema.bg, padding: '60px', fontFamily: 'sans-serif', color: 'white',
        },
    },
        // Header
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                marginBottom: '36px',
            },
        },
            h('div', {
                style: {
                    display: 'flex', background: tema.badgeBg, padding: '12px 28px',
                    borderRadius: '50px', fontSize: '32px', fontWeight: 'bold',
                    marginBottom: '16px',
                },
            }, tema.badge),
            h('div', {
                style: { display: 'flex', fontSize: '26px', opacity: '0.8' },
            }, `Saindo de ${origem} esta semana`),
        ),
        // List
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column', flex: '1',
                gap: '16px', justifyContent: 'center',
            },
        },
            ...destinos.map((d, i) =>
                h('div', {
                    style: {
                        display: 'flex', alignItems: 'center',
                        background: i === 0 ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.1)',
                        borderRadius: '16px', padding: '24px 28px',
                        border: i === 0 ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.15)',
                    },
                },
                    h('div', {
                        style: { display: 'flex', fontSize: '40px', marginRight: '20px' },
                    }, medalhas[i]),
                    h('div', {
                        style: { display: 'flex', flex: '1', fontSize: '32px', fontWeight: '600' },
                    }, `${d.flag} ${d.nome}`),
                    h('div', {
                        style: {
                            display: 'flex', fontSize: '36px', fontWeight: 'bold',
                            color: i === 0 ? '#fbbf24' : '#93c5fd',
                        },
                    }, `R$${d.preco}`),
                )
            ),
        ),
        // Footer
        h('div', {
            style: {
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: '32px', fontSize: '24px', opacity: '0.8',
            },
        },
            h('div', { style: { display: 'flex' } }, 'Preços reais atualizados pela Tripinha 🐾'),
            h('div', { style: { display: 'flex' } }, 'benetrip.com.br'),
        ),
    );
}

// ============================================================
// LAYOUT: ECONOMIA (Ter)
// ============================================================
function cardEconomia(params) {
    const tema = TEMAS.economia;
    const destino = decodeURIComponent(params.get('dn') || 'Destino');
    const pais = decodeURIComponent(params.get('dp') || '');
    const precoAntes = params.get('pa') || '0';
    const precoAgora = params.get('pn') || '0';
    const economia = params.get('ec') || '0';
    const percentual = params.get('pct') || '0';
    const origem = decodeURIComponent(params.get('o') || '');

    return h('div', {
        style: {
            display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
            background: tema.bg, padding: '60px', fontFamily: 'sans-serif', color: 'white',
        },
    },
        // Header
        h('div', {
            style: {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '48px',
            },
        },
            h('div', {
                style: {
                    display: 'flex', background: tema.badgeBg, padding: '12px 28px',
                    borderRadius: '50px', fontSize: '28px', fontWeight: 'bold',
                },
            }, tema.badge),
            h('div', { style: { display: 'flex', fontSize: '24px', opacity: '0.8' } }, 'benetrip.com.br'),
        ),
        // Destination name
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                marginBottom: '48px',
            },
        },
            h('div', {
                style: { display: 'flex', fontSize: '52px', fontWeight: 'bold' },
            }, `${destino} ${pais}`),
            origem ? h('div', {
                style: { display: 'flex', fontSize: '26px', opacity: '0.7', marginTop: '8px' },
            }, `Saindo de ${origem}`) : null,
        ),
        // Price comparison
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column', flex: '1',
                justifyContent: 'center', gap: '24px',
            },
        },
            // Before
            h('div', {
                style: {
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.1)', borderRadius: '16px',
                    padding: '28px 36px',
                },
            },
                h('div', { style: { display: 'flex', fontSize: '28px', opacity: '0.7' } }, '📅 Semana passada'),
                h('div', {
                    style: {
                        display: 'flex', fontSize: '40px', textDecoration: 'line-through',
                        opacity: '0.5',
                    },
                }, `R$${precoAntes}`),
            ),
            // After
            h('div', {
                style: {
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(52,211,153,0.2)', borderRadius: '16px',
                    padding: '28px 36px', border: '3px solid #34d399',
                },
            },
                h('div', { style: { display: 'flex', fontSize: '28px', fontWeight: 'bold' } }, '📅 Hoje'),
                h('div', {
                    style: { display: 'flex', fontSize: '52px', fontWeight: 'bold', color: '#34d399' },
                }, `R$${precoAgora}`),
            ),
            // Savings
            h('div', {
                style: {
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    background: 'rgba(0,0,0,0.3)', borderRadius: '16px',
                    padding: '32px', gap: '16px',
                },
            },
                h('div', {
                    style: { display: 'flex', fontSize: '36px', fontWeight: 'bold', color: '#34d399' },
                }, `💰 Economia: R$${economia}`),
                h('div', {
                    style: {
                        display: 'flex', background: '#34d399', color: '#065f46',
                        padding: '8px 16px', borderRadius: '8px',
                        fontSize: '28px', fontWeight: 'bold',
                    },
                }, `-${percentual}%`),
            ),
        ),
        // Footer
        h('div', {
            style: {
                display: 'flex', justifyContent: 'center', marginTop: '32px',
                fontSize: '26px', opacity: '0.8',
            },
        }, 'A Tripinha monitora preços todo dia pra você! 🐾'),
    );
}

// ============================================================
// LAYOUT: ORIGENS (Qua) - Mesmo destino, diferentes cidades
// ============================================================
function cardOrigens(params) {
    const tema = TEMAS.origens;
    const destino = decodeURIComponent(params.get('dn') || 'Destino');
    const pais = decodeURIComponent(params.get('dp') || '');
    const origens = [];
    for (let i = 1; i <= 6; i++) {
        const n = params.get(`o${i}n`);
        const p = params.get(`o${i}p`);
        if (n && p) origens.push({ nome: decodeURIComponent(n), preco: parseInt(p) });
    }
    // Sort by price
    origens.sort((a, b) => a.preco - b.preco);
    const melhor = origens[0];

    return h('div', {
        style: {
            display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
            background: tema.bg, padding: '60px', fontFamily: 'sans-serif', color: 'white',
        },
    },
        // Header
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                marginBottom: '36px',
            },
        },
            h('div', {
                style: {
                    display: 'flex', background: tema.badgeBg, padding: '12px 28px',
                    borderRadius: '50px', fontSize: '26px', fontWeight: 'bold',
                    marginBottom: '20px',
                },
            }, tema.badge),
            h('div', {
                style: { display: 'flex', fontSize: '52px', fontWeight: 'bold' },
            }, `${destino} ${pais}`),
        ),
        // Origins list
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column', flex: '1',
                gap: '14px', justifyContent: 'center',
            },
        },
            ...origens.map((o, i) => {
                const isMelhor = o === melhor;
                const barWidth = Math.max(30, Math.round((melhor.preco / o.preco) * 100));
                return h('div', {
                    style: {
                        display: 'flex', alignItems: 'center',
                        background: isMelhor ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)',
                        borderRadius: '14px', padding: '20px 28px',
                        border: isMelhor ? '2px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)',
                    },
                },
                    h('div', {
                        style: {
                            display: 'flex', width: '200px', fontSize: '28px',
                            fontWeight: isMelhor ? 'bold' : '500',
                        },
                    }, `De ${o.nome}`),
                    h('div', {
                        style: {
                            display: 'flex', flex: '1', height: '24px',
                            background: 'rgba(255,255,255,0.1)', borderRadius: '12px',
                            marginLeft: '20px', marginRight: '20px', overflow: 'hidden',
                        },
                    },
                        h('div', {
                            style: {
                                display: 'flex', width: `${barWidth}%`, height: '100%',
                                background: isMelhor ? '#60a5fa' : 'rgba(255,255,255,0.3)',
                                borderRadius: '12px',
                            },
                        }),
                    ),
                    h('div', {
                        style: {
                            display: 'flex', fontSize: '32px', fontWeight: 'bold',
                            color: isMelhor ? '#60a5fa' : 'white',
                            minWidth: '140px', justifyContent: 'flex-end',
                        },
                    }, `R$${o.preco}`),
                    isMelhor ? h('div', {
                        style: {
                            display: 'flex', marginLeft: '12px', fontSize: '22px',
                            background: '#60a5fa', color: '#1e3a5f',
                            padding: '4px 12px', borderRadius: '8px', fontWeight: 'bold',
                        },
                    }, 'MENOR!') : null,
                );
            }),
        ),
        // Footer
        h('div', {
            style: {
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: '28px', fontSize: '24px', opacity: '0.8',
            },
        },
            h('div', { style: { display: 'flex' } }, 'Compare preços de 100 cidades 🐾'),
            h('div', { style: { display: 'flex' } }, 'benetrip.com.br'),
        ),
    );
}

// ============================================================
// LAYOUT: ROTEIRO (Qui)
// ============================================================
function cardRoteiro(params) {
    const tema = TEMAS.roteiro;
    const destino = decodeURIComponent(params.get('dn') || 'Destino');
    const dias = parseInt(params.get('nd') || '3');
    const items = [];
    for (let d = 1; d <= dias; d++) {
        const titulo = params.get(`d${d}t`);
        const atividades = params.get(`d${d}a`);
        if (titulo) {
            items.push({
                titulo: decodeURIComponent(titulo),
                atividades: atividades ? decodeURIComponent(atividades).split('|') : [],
            });
        }
    }

    const emojis = ['🌅', '☀️', '🌄', '🌙', '⭐'];

    return h('div', {
        style: {
            display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
            background: tema.bg, padding: '60px', fontFamily: 'sans-serif', color: 'white',
        },
    },
        // Header
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                marginBottom: '36px',
            },
        },
            h('div', {
                style: {
                    display: 'flex', background: tema.badgeBg, padding: '12px 28px',
                    borderRadius: '50px', fontSize: '28px', fontWeight: 'bold',
                    marginBottom: '16px',
                },
            }, tema.badge),
            h('div', {
                style: { display: 'flex', fontSize: '48px', fontWeight: 'bold' },
            }, `${dias} DIAS EM ${destino.toUpperCase()}`),
        ),
        // Days
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column', flex: '1',
                gap: '16px', justifyContent: 'center',
            },
        },
            ...items.map((item, i) =>
                h('div', {
                    style: {
                        display: 'flex', flexDirection: 'column',
                        background: 'rgba(0,0,0,0.25)', borderRadius: '16px',
                        padding: '24px 28px',
                        borderLeft: '4px solid #fde68a',
                    },
                },
                    h('div', {
                        style: {
                            display: 'flex', fontSize: '28px', fontWeight: 'bold',
                            color: '#fde68a', marginBottom: '10px',
                        },
                    }, `${emojis[i] || '📍'} DIA ${i + 1} — ${item.titulo}`),
                    h('div', {
                        style: {
                            display: 'flex', flexDirection: 'column', gap: '6px',
                        },
                    },
                        ...item.atividades.map(a =>
                            h('div', {
                                style: { display: 'flex', fontSize: '24px', opacity: '0.9' },
                            }, `• ${a}`)
                        ),
                    ),
                )
            ),
        ),
        // Footer
        h('div', {
            style: {
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: '28px', fontSize: '24px', opacity: '0.8',
            },
        },
            h('div', { style: { display: 'flex' } }, 'Roteiro gerado por IA 🐾'),
            h('div', { style: { display: 'flex' } }, 'benetrip.com.br'),
        ),
    );
}

// ============================================================
// LAYOUT: RANKING (Sex)
// ============================================================
function cardRanking(params) {
    const tema = TEMAS.ranking;
    const semana = decodeURIComponent(params.get('sem') || 'Esta semana');
    const destinos = [];
    for (let i = 1; i <= 8; i++) {
        const n = params.get(`d${i}n`);
        const p = params.get(`d${i}p`);
        const e = params.get(`d${i}e`); // estilo emoji
        if (n && p) destinos.push({
            nome: decodeURIComponent(n),
            preco: p,
            emoji: e ? decodeURIComponent(e) : '✈️',
        });
    }

    return h('div', {
        style: {
            display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
            background: tema.bg, padding: '52px', fontFamily: 'sans-serif', color: 'white',
        },
    },
        // Header
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                marginBottom: '28px',
            },
        },
            h('div', {
                style: {
                    display: 'flex', background: tema.badgeBg, padding: '12px 28px',
                    borderRadius: '50px', fontSize: '30px', fontWeight: 'bold',
                    marginBottom: '12px',
                },
            }, tema.badge),
            h('div', {
                style: { display: 'flex', fontSize: '22px', opacity: '0.7' },
            }, semana),
        ),
        // Grid
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column', flex: '1',
                gap: '10px', justifyContent: 'center',
            },
        },
            ...destinos.map((d, i) =>
                h('div', {
                    style: {
                        display: 'flex', alignItems: 'center',
                        background: i < 3 ? 'rgba(196,181,253,0.15)' : 'rgba(255,255,255,0.06)',
                        borderRadius: '12px', padding: '16px 24px',
                    },
                },
                    h('div', {
                        style: {
                            display: 'flex', fontSize: '28px', fontWeight: 'bold',
                            color: i < 3 ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
                            width: '48px',
                        },
                    }, `${i + 1}º`),
                    h('div', {
                        style: { display: 'flex', fontSize: '24px', marginRight: '12px' },
                    }, d.emoji),
                    h('div', {
                        style: { display: 'flex', flex: '1', fontSize: '28px', fontWeight: '500' },
                    }, d.nome),
                    h('div', {
                        style: {
                            display: 'flex', fontSize: '30px', fontWeight: 'bold',
                            color: i === 0 ? '#fbbf24' : '#c4b5fd',
                        },
                    }, `R$${d.preco}`),
                )
            ),
        ),
        // Footer
        h('div', {
            style: {
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: '24px', fontSize: '22px', opacity: '0.8',
            },
        },
            h('div', { style: { display: 'flex' } }, 'Dados reais de 100 cidades brasileiras 🐾'),
            h('div', { style: { display: 'flex' } }, 'benetrip.com.br'),
        ),
    );
}

// ============================================================
// ROTEADOR DE FORMATOS
// ============================================================
const CARD_BUILDERS = {
    descobridor: cardDescobridor,
    top5: cardTop5,
    economia: cardEconomia,
    origens: cardOrigens,
    roteiro: cardRoteiro,
    ranking: cardRanking,
};

// ============================================================
// HANDLER (Node.js Runtime)
// ============================================================
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Modo diagnóstico
    if (req.query?.debug === 'true') {
        const diag = { satori: false, sharp: false, font: false };
        try { await getSatori(); diag.satori = true; } catch (e) { diag.satoriError = e.message; }
        try { await getSharp(); diag.sharp = true; } catch (e) { diag.sharpError = e.message; }
        try { await loadFont(); diag.font = true; } catch (e) { diag.fontError = e.message; }
        return res.status(200).json({ diagnostics: diag });
    }

    const formato = req.query?.f || 'descobridor';
    const searchParams = new URLSearchParams(req.query || {});

    const builder = CARD_BUILDERS[formato];
    if (!builder) {
        return res.status(400).json({ error: `Formato desconhecido: ${formato}` });
    }

    try {
        // Carregar dependências dinamicamente
        const satori = await getSatori();
        const fontData = await loadFont();
        const element = builder(searchParams);

        // Satori: React element → SVG
        const svg = await satori(element, {
            width: 1080,
            height: 1080,
            fonts: [
                { name: 'sans-serif', data: fontData, weight: 400, style: 'normal' },
                { name: 'sans-serif', data: fontData, weight: 600, style: 'normal' },
                { name: 'sans-serif', data: fontData, weight: 700, style: 'normal' },
            ],
        });

        // Tentar converter SVG → PNG com sharp
        try {
            const sharp = await getSharp();
            const pngBuffer = await sharp(Buffer.from(svg))
                .resize(1080, 1080)
                .png()
                .toBuffer();

            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.status(200).send(pngBuffer);
        } catch (sharpErr) {
            console.warn('Sharp falhou, retornando SVG:', sharpErr.message);
            // Fallback: retornar SVG
            res.setHeader('Content-Type', 'image/svg+xml');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.status(200).send(svg);
        }
    } catch (error) {
        console.error('Erro ao gerar card:', error);
        return res.status(500).json({
            error: error.message,
            step: !_satori ? 'satori_import' : !fontCache ? 'font_load' : 'render',
        });
    }
}
