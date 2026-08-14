// Validação do vercel.json contra as regras da plataforma.
//
// Existe porque um deploy foi rejeitado com
//   "Redirect at index 0 cannot define both `permanent` and `statusCode`"
// e o erro só apareceu no build da Vercel, depois do merge. Configuração de
// deploy é código: se quebra a publicação inteira, tem que falhar aqui antes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf-8'));

// ============================================================
// REDIRECTS
// ============================================================
test('nenhum redirect define permanent e statusCode ao mesmo tempo', () => {
    (cfg.redirects || []).forEach((r, i) => {
        const temAmbos = r.permanent !== undefined && r.statusCode !== undefined;
        assert.equal(temAmbos, false, `redirect ${i} (${r.source}) define os dois: a Vercel rejeita o deploy`);
    });
});

test('todo redirect tem source e destination', () => {
    (cfg.redirects || []).forEach((r, i) => {
        assert.ok(r.source, `redirect ${i} sem source`);
        assert.ok(r.destination, `redirect ${i} sem destination`);
    });
});

test('statusCode de redirect é um código de redirecionamento válido', () => {
    const validos = [301, 302, 303, 307, 308];
    (cfg.redirects || []).forEach((r, i) => {
        if (r.statusCode === undefined) return;
        assert.ok(validos.includes(r.statusCode), `redirect ${i} usa statusCode ${r.statusCode}`);
    });
});

test('as páginas legadas redirecionam com 308 para a ferramenta atual', () => {
    const porOrigem = new Map((cfg.redirects || []).map((r) => [r.source, r]));
    assert.equal(porOrigem.get('/multidatas')?.destination, '/comparar-voos');
    assert.equal(porOrigem.get('/multidatas')?.statusCode, 308);
    assert.equal(porOrigem.get('/create-itinerary')?.destination, '/roteiro-viagem');
    assert.equal(porOrigem.get('/create-itinerary')?.statusCode, 308);
});

test('redirect não aponta para ele mesmo (loop infinito)', () => {
    (cfg.redirects || []).forEach((r, i) => {
        assert.notEqual(r.source, r.destination, `redirect ${i} aponta para si mesmo`);
    });
});

test('destino de redirect não é origem de outro redirect (cadeia)', () => {
    const origens = new Set((cfg.redirects || []).map((r) => r.source));
    (cfg.redirects || []).forEach((r, i) => {
        assert.equal(origens.has(r.destination), false,
            `redirect ${i} leva a ${r.destination}, que também redireciona: encadeia dois saltos`);
    });
});

// ============================================================
// REWRITES
// ============================================================
test('todo rewrite tem source e destination', () => {
    (cfg.rewrites || []).forEach((r, i) => {
        assert.ok(r.source, `rewrite ${i} sem source`);
        assert.ok(r.destination, `rewrite ${i} sem destination`);
    });
});

test('nenhuma rota é redirect e rewrite ao mesmo tempo', () => {
    const redirects = new Set((cfg.redirects || []).map((r) => r.source));
    (cfg.rewrites || []).forEach((r) => {
        assert.equal(redirects.has(r.source), false, `${r.source} está em redirects e rewrites`);
    });
});

// ============================================================
// FUNCTIONS
// ============================================================
test('toda function declarada aponta para um arquivo existente', () => {
    Object.keys(cfg.functions || {}).forEach((caminho) => {
        assert.ok(existsSync(new URL(`../${caminho}`, import.meta.url)),
            `${caminho} está no vercel.json mas não existe no repositório`);
    });
});

test('maxDuration das functions está dentro do limite da plataforma', () => {
    Object.entries(cfg.functions || {}).forEach(([caminho, conf]) => {
        if (conf.maxDuration === undefined) return;
        assert.ok(conf.maxDuration > 0 && conf.maxDuration <= 300,
            `${caminho} declara maxDuration ${conf.maxDuration}`);
    });
});

// ============================================================
// ESTRUTURA GERAL
// ============================================================
test('as chaves estruturais esperadas continuam presentes', () => {
    assert.equal(cfg.outputDirectory, 'public');
    assert.equal(cfg.cleanUrls, true, 'as URLs canônicas sem .html dependem disto');
    assert.equal(cfg.trailingSlash, false);
});

test('os rewrites das páginas renderizadas no servidor continuam de pé', () => {
    const porOrigem = new Map((cfg.rewrites || []).map((r) => [r.source, r.destination]));
    assert.equal(porOrigem.get('/destinos-baratos'), '/api/destinos-baratos-page');
    assert.equal(porOrigem.get('/escapadas'), '/api/escapadas-page');
    assert.equal(porOrigem.get('/sitemap.xml'), '/api/sitemap');
});

test('todo cron aponta para uma function declarada', () => {
    const declaradas = new Set(Object.keys(cfg.functions || {}));
    (cfg.crons || []).forEach((c) => {
        const arquivo = `${c.path.replace(/^\//, '')}.js`;
        assert.ok(declaradas.has(arquivo), `cron ${c.path} não tem function declarada (${arquivo})`);
    });
});
