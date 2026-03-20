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

// Cache de fontes
let fontRegularCache = null;
let fontBoldCache = null;

async function loadFontFromUrls(urls) {
    for (const url of urls) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                const buf = await res.arrayBuffer();
                console.log(`Fonte carregada: ${url} (${buf.byteLength} bytes)`);
                return buf;
            }
        } catch (err) {
            console.warn(`Fonte ${url}: ${err.message}`);
        }
    }
    return null;
}

async function loadFonts() {
    if (fontRegularCache && fontBoldCache) return { regular: fontRegularCache, bold: fontBoldCache };

    // Poppins - fonte oficial da Benetrip (TTF para satori)
    const [regular, bold] = await Promise.all([
        loadFontFromUrls([
            'https://cdn.jsdelivr.net/fontsource/fonts/poppins@latest/latin-400-normal.ttf',
            'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/Poppins-Regular.ttf',
        ]),
        loadFontFromUrls([
            'https://cdn.jsdelivr.net/fontsource/fonts/poppins@latest/latin-700-normal.ttf',
            'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/Poppins-Bold.ttf',
        ]),
    ]);

    // Fallback: Google Fonts CSS pedindo TTF
    if (!regular || !bold) {
        try {
            const cssRes = await fetch(
                'https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap',
                { headers: { 'User-Agent': 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)' } }
            );
            const css = await cssRes.text();
            const matches = [...css.matchAll(/font-weight:\s*(\d+);[^}]*src:\s*url\(([^)]+)\)\s*format\('truetype'\)/g)];
            for (const m of matches) {
                const fontRes = await fetch(m[2]);
                const buf = await fontRes.arrayBuffer();
                if (m[1] === '400' && !regular) fontRegularCache = buf;
                if (m[1] === '700' && !bold) fontBoldCache = buf;
            }
        } catch (err) {
            console.error('Falha no fallback Google Fonts:', err.message);
        }
    }

    fontRegularCache = regular || fontRegularCache;
    fontBoldCache = bold || fontBoldCache;

    if (!fontRegularCache) throw new Error('Nao conseguiu carregar fonte Poppins regular');
    if (!fontBoldCache) fontBoldCache = fontRegularCache; // usa regular como fallback

    return { regular: fontRegularCache, bold: fontBoldCache };
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
// PALETA BENETRIP OFICIAL
// ============================================================
const BRAND = {
    orange: '#E87722',
    orangeDark: '#CF6A1D',
    orangeLight: '#FF9A47',
    blue: '#00A3E0',
    blueDark: '#0090C7',
    dark: '#21272A',
    white: '#FFFFFF',
    gray100: '#F4F5F7',
    gray500: '#8B939C',
    green: '#22C55E',
};

// URL base para assets (Tripinha avatar hospedada no Vercel)
const ASSETS_BASE = 'https://benetrip.vercel.app/assets/images';
const TRIPINHA_FELIZ = `${ASSETS_BASE}/tripinha/avatar-feliz.png`;
const LOGO_WHITE = `${ASSETS_BASE}/logo/logo-benetrip-white.png`;

// ============================================================
// COMPONENTES REUTILIZÁVEIS
// ============================================================

// Header bar com gradiente laranja→azul (como o site real)
function brandHeader(badgeText, showLogo) {
    return h('div', {
        style: {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: `linear-gradient(135deg, ${BRAND.orange} 0%, ${BRAND.orangeLight} 40%, #FFB878 60%, #66C7FF 80%, ${BRAND.blue} 100%)`,
            padding: '28px 40px',
            borderRadius: '24px',
            marginBottom: '32px',
        },
    },
        // Badge pill
        h('div', {
            style: {
                display: 'flex', alignItems: 'center',
                background: 'rgba(0,0,0,0.25)', padding: '10px 24px',
                borderRadius: '50px', fontSize: '26px', fontWeight: '700',
                color: BRAND.white, letterSpacing: '0.5px',
            },
        }, badgeText),
        // Logo area
        showLogo ? h('div', {
            style: {
                display: 'flex', alignItems: 'center', gap: '12px',
            },
        },
            h('div', {
                style: {
                    display: 'flex', fontSize: '24px', fontWeight: '700',
                    color: BRAND.white, letterSpacing: '-0.5px',
                },
            }, 'benetrip.com.br'),
        ) : null,
    );
}

// Tripinha avatar circle com borda branca (como no hero do site)
function tripinhaAvatar(size) {
    return h('img', {
        src: TRIPINHA_FELIZ,
        width: size,
        height: size,
        style: {
            borderRadius: '50%',
            border: `4px solid ${BRAND.white}`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        },
    });
}

// Footer com Tripinha + CTA
function brandFooter(text) {
    return h('div', {
        style: {
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '16px', marginTop: 'auto', paddingTop: '24px',
        },
    },
        tripinhaAvatar(64),
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column',
            },
        },
            h('div', {
                style: {
                    display: 'flex', fontSize: '24px', fontWeight: '700',
                    color: BRAND.orange,
                },
            }, text),
            h('div', {
                style: {
                    display: 'flex', fontSize: '20px', color: 'rgba(255,255,255,0.6)',
                },
            }, 'benetrip.com.br'),
        ),
    );
}

// CTA button pill (estilo do site)
function ctaButton(text) {
    return h('div', {
        style: {
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${BRAND.orange}, ${BRAND.orangeLight})`,
            padding: '16px 40px', borderRadius: '50px',
            fontSize: '26px', fontWeight: '700', color: BRAND.white,
            boxShadow: `0 8px 30px rgba(232,119,34,0.3)`,
        },
    }, text);
}

// Check item com bolinha verde
function checkItem(text) {
    return h('div', {
        style: { display: 'flex', alignItems: 'center', fontSize: '26px', gap: '14px' },
    },
        h('div', {
            style: {
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: BRAND.green, borderRadius: '50%',
                width: '34px', height: '34px', fontSize: '18px', color: BRAND.white,
                flexShrink: '0',
            },
        }, '✓'),
        h('div', { style: { display: 'flex', color: 'rgba(255,255,255,0.9)' } }, text),
    );
}

// ============================================================
// CORES E ESTILOS POR FORMATO
// ============================================================
const TEMAS = {
    descobridor: {
        bg: `linear-gradient(160deg, ${BRAND.dark} 0%, #1a2d45 40%, #163040 70%, #0d3d3d 100%)`,
        accent: BRAND.orange,
        badge: 'TRIPINHA DESCOBRIU!',
    },
    top5: {
        bg: `linear-gradient(160deg, ${BRAND.dark} 0%, #1a2040 40%, #1e2860 70%, #1e3a6f 100%)`,
        accent: BRAND.orange,
        badge: 'TOP 5 MAIS BARATOS',
    },
    economia: {
        bg: `linear-gradient(160deg, ${BRAND.dark} 0%, #102820 40%, #0d3828 70%, #064e31 100%)`,
        accent: BRAND.green,
        badge: 'PRECO CAIU!',
    },
    origens: {
        bg: `linear-gradient(160deg, ${BRAND.dark} 0%, #1a2a4a 40%, #1e3060 70%, #1e3a6f 100%)`,
        accent: BRAND.blue,
        badge: 'DE ONDE SAI MAIS BARATO?',
    },
    roteiro: {
        bg: `linear-gradient(160deg, ${BRAND.dark} 0%, #2a1a10 40%, #3a2010 70%, #4a2a10 100%)`,
        accent: BRAND.orange,
        badge: 'ROTEIRO COMPLETO',
    },
    ranking: {
        bg: `linear-gradient(160deg, ${BRAND.dark} 0%, #1a1530 40%, #251a40 70%, #302050 100%)`,
        accent: BRAND.orange,
        badge: 'RANKING DA SEMANA',
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

    return h('div', {
        style: {
            display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
            background: tema.bg, padding: '48px', fontFamily: 'Poppins', color: BRAND.white,
        },
    },
        // Header gradient bar
        brandHeader(tema.badge, true),

        // Quote box - o que o usuario pediu
        h('div', {
            style: {
                display: 'flex', alignItems: 'center',
                background: 'rgba(255,255,255,0.08)', borderRadius: '20px',
                padding: '28px 32px', marginBottom: '28px',
                border: '1px solid rgba(255,255,255,0.12)',
                gap: '20px',
            },
        },
            // Aspas estilizadas
            h('div', {
                style: {
                    display: 'flex', fontSize: '48px', color: BRAND.orange,
                    fontWeight: '700', lineHeight: '1', marginTop: '-12px',
                },
            }, '"'),
            h('div', {
                style: {
                    display: 'flex', flex: '1', fontSize: '28px',
                    fontStyle: 'italic', lineHeight: '1.4', opacity: '0.9',
                },
            }, pedido),
        ),

        // Tripinha arrow section
        h('div', {
            style: {
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '16px', marginBottom: '20px',
            },
        },
            tripinhaAvatar(80),
            h('div', {
                style: {
                    display: 'flex', fontSize: '20px', color: BRAND.orange,
                    fontWeight: '600',
                },
            }, 'A Tripinha farejou e encontrou...'),
        ),

        // Result card
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column', flex: '1',
                background: 'rgba(0,0,0,0.35)', borderRadius: '24px',
                padding: '36px 40px',
                border: `3px solid ${BRAND.orange}`,
                boxShadow: `0 0 40px rgba(232,119,34,0.15)`,
            },
        },
            // Destino + pais
            h('div', {
                style: {
                    display: 'flex', alignItems: 'center', marginBottom: '16px',
                    gap: '14px',
                },
            },
                h('div', {
                    style: { display: 'flex', fontSize: '50px', fontWeight: '700' },
                }, destino),
                pais ? h('div', {
                    style: { display: 'flex', fontSize: '30px', opacity: '0.7' },
                }, pais) : null,
            ),
            // Preco
            h('div', {
                style: {
                    display: 'flex', alignItems: 'baseline', marginBottom: '24px', gap: '10px',
                },
            },
                h('div', {
                    style: { display: 'flex', fontSize: '22px', opacity: '0.6' },
                }, 'a partir de'),
                h('div', {
                    style: {
                        display: 'flex', fontSize: '52px', fontWeight: '700',
                        color: BRAND.orange,
                    },
                }, `R$${preco}`),
            ),
            // Checkmarks
            h('div', {
                style: { display: 'flex', flexDirection: 'column', gap: '14px' },
            },
                ...checks.map(check => checkItem(check)),
            ),
        ),

        // Footer
        h('div', {
            style: {
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: '28px', gap: '12px',
            },
        },
            ctaButton('Diga o que precisa, a Tripinha encontra!'),
        ),
    );
}

// ============================================================
// LAYOUT: TOP 5 (Seg)
// ============================================================
function cardTop5(params) {
    const tema = TEMAS.top5;
    const origem = decodeURIComponent(params.get('o') || 'Sao Paulo');
    const destinos = [];
    for (let i = 1; i <= 5; i++) {
        const n = params.get(`d${i}n`);
        const p = params.get(`d${i}p`);
        const f = params.get(`d${i}f`);
        if (n && p) destinos.push({ nome: decodeURIComponent(n), preco: p, flag: f ? decodeURIComponent(f) : '' });
    }

    const medalhas = ['1', '2', '3', '4', '5'];

    return h('div', {
        style: {
            display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
            background: tema.bg, padding: '48px', fontFamily: 'Poppins', color: BRAND.white,
        },
    },
        brandHeader(tema.badge, true),
        // Subtitle
        h('div', {
            style: {
                display: 'flex', justifyContent: 'center',
                fontSize: '26px', opacity: '0.7', marginBottom: '28px',
            },
        }, `Saindo de ${origem} esta semana`),
        // List
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column', flex: '1',
                gap: '14px', justifyContent: 'center',
            },
        },
            ...destinos.map((d, i) =>
                h('div', {
                    style: {
                        display: 'flex', alignItems: 'center',
                        background: i === 0 ? `rgba(232,119,34,0.15)` : 'rgba(255,255,255,0.07)',
                        borderRadius: '16px', padding: '22px 28px',
                        border: i === 0 ? `2px solid ${BRAND.orange}` : '1px solid rgba(255,255,255,0.1)',
                    },
                },
                    // Numero com circulo
                    h('div', {
                        style: {
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '44px', height: '44px', borderRadius: '50%',
                            background: i === 0 ? BRAND.orange : 'rgba(255,255,255,0.15)',
                            fontSize: '24px', fontWeight: '700', marginRight: '20px',
                            flexShrink: '0',
                        },
                    }, medalhas[i]),
                    h('div', {
                        style: { display: 'flex', flex: '1', fontSize: '30px', fontWeight: '600' },
                    }, `${d.flag} ${d.nome}`),
                    h('div', {
                        style: {
                            display: 'flex', fontSize: '34px', fontWeight: '700',
                            color: i === 0 ? BRAND.orange : BRAND.blue,
                        },
                    }, `R$${d.preco}`),
                )
            ),
        ),
        brandFooter('Precos reais atualizados pela Tripinha'),
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
            background: tema.bg, padding: '48px', fontFamily: 'Poppins', color: BRAND.white,
        },
    },
        brandHeader(tema.badge, true),
        // Destination name
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                marginBottom: '40px',
            },
        },
            h('div', {
                style: { display: 'flex', fontSize: '48px', fontWeight: '700' },
            }, `${destino} ${pais}`),
            origem ? h('div', {
                style: { display: 'flex', fontSize: '24px', opacity: '0.6', marginTop: '8px' },
            }, `Saindo de ${origem}`) : null,
        ),
        // Price comparison
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column', flex: '1',
                justifyContent: 'center', gap: '20px',
            },
        },
            // Before
            h('div', {
                style: {
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.08)', borderRadius: '16px',
                    padding: '28px 36px',
                },
            },
                h('div', { style: { display: 'flex', fontSize: '26px', opacity: '0.6' } }, 'Semana passada'),
                h('div', {
                    style: {
                        display: 'flex', fontSize: '38px', textDecoration: 'line-through',
                        opacity: '0.4',
                    },
                }, `R$${precoAntes}`),
            ),
            // After
            h('div', {
                style: {
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(34,197,94,0.15)', borderRadius: '16px',
                    padding: '28px 36px', border: `3px solid ${BRAND.green}`,
                },
            },
                h('div', { style: { display: 'flex', fontSize: '26px', fontWeight: '700' } }, 'Hoje'),
                h('div', {
                    style: { display: 'flex', fontSize: '50px', fontWeight: '700', color: BRAND.green },
                }, `R$${precoAgora}`),
            ),
            // Savings
            h('div', {
                style: {
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    background: 'rgba(0,0,0,0.3)', borderRadius: '16px',
                    padding: '28px', gap: '16px',
                },
            },
                h('div', {
                    style: { display: 'flex', fontSize: '34px', fontWeight: '700', color: BRAND.green },
                }, `Economia: R$${economia}`),
                h('div', {
                    style: {
                        display: 'flex', background: BRAND.green, color: BRAND.dark,
                        padding: '8px 18px', borderRadius: '10px',
                        fontSize: '26px', fontWeight: '700',
                    },
                }, `-${percentual}%`),
            ),
        ),
        brandFooter('A Tripinha monitora precos pra voce!'),
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
    origens.sort((a, b) => a.preco - b.preco);
    const melhor = origens[0];

    return h('div', {
        style: {
            display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
            background: tema.bg, padding: '48px', fontFamily: 'Poppins', color: BRAND.white,
        },
    },
        brandHeader(tema.badge, true),
        // Destination
        h('div', {
            style: {
                display: 'flex', justifyContent: 'center',
                fontSize: '46px', fontWeight: '700', marginBottom: '28px',
            },
        }, `${destino} ${pais}`),
        // Origins list
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column', flex: '1',
                gap: '12px', justifyContent: 'center',
            },
        },
            ...origens.map((o, i) => {
                const isMelhor = o === melhor;
                const barWidth = Math.max(30, Math.round((melhor.preco / o.preco) * 100));
                return h('div', {
                    style: {
                        display: 'flex', alignItems: 'center',
                        background: isMelhor ? `rgba(0,163,224,0.2)` : 'rgba(255,255,255,0.06)',
                        borderRadius: '14px', padding: '18px 24px',
                        border: isMelhor ? `2px solid ${BRAND.blue}` : '1px solid rgba(255,255,255,0.08)',
                    },
                },
                    h('div', {
                        style: {
                            display: 'flex', width: '180px', fontSize: '26px',
                            fontWeight: isMelhor ? '700' : '400',
                        },
                    }, `De ${o.nome}`),
                    h('div', {
                        style: {
                            display: 'flex', flex: '1', height: '20px',
                            background: 'rgba(255,255,255,0.08)', borderRadius: '10px',
                            marginLeft: '16px', marginRight: '16px', overflow: 'hidden',
                        },
                    },
                        h('div', {
                            style: {
                                display: 'flex', width: `${barWidth}%`, height: '100%',
                                background: isMelhor ? BRAND.blue : 'rgba(255,255,255,0.25)',
                                borderRadius: '10px',
                            },
                        }),
                    ),
                    h('div', {
                        style: {
                            display: 'flex', fontSize: '30px', fontWeight: '700',
                            color: isMelhor ? BRAND.blue : BRAND.white,
                            minWidth: '130px', justifyContent: 'flex-end',
                        },
                    }, `R$${o.preco}`),
                    isMelhor ? h('div', {
                        style: {
                            display: 'flex', marginLeft: '10px', fontSize: '18px',
                            background: BRAND.blue, color: BRAND.white,
                            padding: '4px 12px', borderRadius: '8px', fontWeight: '700',
                        },
                    }, 'MENOR') : null,
                );
            }),
        ),
        brandFooter('Compare precos de 100 cidades'),
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

    return h('div', {
        style: {
            display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
            background: tema.bg, padding: '48px', fontFamily: 'Poppins', color: BRAND.white,
        },
    },
        brandHeader(tema.badge, true),
        // Title
        h('div', {
            style: {
                display: 'flex', justifyContent: 'center',
                fontSize: '42px', fontWeight: '700', marginBottom: '28px',
            },
        }, `${dias} dias em ${destino}`),
        // Days
        h('div', {
            style: {
                display: 'flex', flexDirection: 'column', flex: '1',
                gap: '14px', justifyContent: 'center',
            },
        },
            ...items.map((item, i) =>
                h('div', {
                    style: {
                        display: 'flex', flexDirection: 'column',
                        background: 'rgba(0,0,0,0.25)', borderRadius: '16px',
                        padding: '22px 28px',
                        borderLeft: `4px solid ${BRAND.orange}`,
                    },
                },
                    h('div', {
                        style: {
                            display: 'flex', fontSize: '26px', fontWeight: '700',
                            color: BRAND.orange, marginBottom: '8px',
                        },
                    }, `DIA ${i + 1} - ${item.titulo}`),
                    h('div', {
                        style: {
                            display: 'flex', flexDirection: 'column', gap: '4px',
                        },
                    },
                        ...item.atividades.map(a =>
                            h('div', {
                                style: { display: 'flex', fontSize: '22px', opacity: '0.85' },
                            }, `  ${a}`)
                        ),
                    ),
                )
            ),
        ),
        brandFooter('Roteiro gerado por IA'),
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
        if (n && p) destinos.push({
            nome: decodeURIComponent(n),
            preco: p,
        });
    }

    return h('div', {
        style: {
            display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
            background: tema.bg, padding: '48px', fontFamily: 'Poppins', color: BRAND.white,
        },
    },
        brandHeader(tema.badge, true),
        h('div', {
            style: {
                display: 'flex', justifyContent: 'center',
                fontSize: '22px', opacity: '0.6', marginBottom: '20px',
            },
        }, semana),
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
                        background: i < 3 ? `rgba(232,119,34,0.12)` : 'rgba(255,255,255,0.05)',
                        borderRadius: '12px', padding: '16px 24px',
                        border: i === 0 ? `2px solid ${BRAND.orange}` : 'none',
                    },
                },
                    h('div', {
                        style: {
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: i < 3 ? BRAND.orange : 'rgba(255,255,255,0.1)',
                            fontSize: '20px', fontWeight: '700', marginRight: '16px',
                            flexShrink: '0',
                        },
                    }, `${i + 1}`),
                    h('div', {
                        style: { display: 'flex', flex: '1', fontSize: '26px', fontWeight: '500' },
                    }, d.nome),
                    h('div', {
                        style: {
                            display: 'flex', fontSize: '28px', fontWeight: '700',
                            color: i === 0 ? BRAND.orange : BRAND.blue,
                        },
                    }, `R$${d.preco}`),
                )
            ),
        ),
        brandFooter('Dados reais de 100 cidades brasileiras'),
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

    // Modo diagnostico
    if (req.query?.debug === 'true') {
        const diag = { satori: false, sharp: false, font: false };
        try { await getSatori(); diag.satori = true; } catch (e) { diag.satoriError = e.message; }
        try { await getSharp(); diag.sharp = true; } catch (e) { diag.sharpError = e.message; }
        try { await loadFonts(); diag.font = true; } catch (e) { diag.fontError = e.message; }
        return res.status(200).json({ diagnostics: diag });
    }

    const formato = req.query?.f || 'descobridor';
    const searchParams = new URLSearchParams(req.query || {});

    const builder = CARD_BUILDERS[formato];
    if (!builder) {
        return res.status(400).json({ error: `Formato desconhecido: ${formato}` });
    }

    try {
        const satori = await getSatori();
        const { regular, bold } = await loadFonts();
        const element = builder(searchParams);

        const svg = await satori(element, {
            width: 1080,
            height: 1080,
            fonts: [
                { name: 'Poppins', data: regular, weight: 400, style: 'normal' },
                { name: 'Poppins', data: regular, weight: 500, style: 'normal' },
                { name: 'Poppins', data: bold, weight: 600, style: 'normal' },
                { name: 'Poppins', data: bold, weight: 700, style: 'normal' },
            ],
        });

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
            res.setHeader('Content-Type', 'image/svg+xml');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.status(200).send(svg);
        }
    } catch (error) {
        console.error('Erro ao gerar card:', error);
        return res.status(500).json({
            error: error.message,
            step: !_satori ? 'satori_import' : !fontRegularCache ? 'font_load' : 'render',
        });
    }
}
