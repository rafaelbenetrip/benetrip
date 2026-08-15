// O header compartilhado é injetado por JavaScript e monta os próprios
// caminhos. Enquanto ele calculava um prefixo relativo, /escapadas/curitiba
// pedia "logo1.png" e o navegador resolvia /escapadas/logo1.png (404): o logo
// aparecia quebrado em toda cidade que não fosse a padrão, e os links do menu
// do topo levavam para /escapadas/voos.html. Nada no build acusava, porque o
// HTML só existe depois que o script roda e só quebra em URL com pasta.
//
// Este teste tranca a regra: todo caminho interno do header sai da raiz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const header = readFileSync(new URL('../public/assets/js/benetrip-header.js', import.meta.url), 'utf-8');

// Um caminho interno é aceitável quando começa na raiz. Externos (http),
// âncoras (#) e URLs montadas em runtime ficam de fora da regra.
function ehAceitavel(valor) {
    return (
        valor.startsWith('/') ||
        valor.startsWith('http://') ||
        valor.startsWith('https://') ||
        valor.startsWith('#') ||
        valor.startsWith('mailto:') ||
        valor.startsWith('data:')
    );
}

function atributos(nome) {
    const encontrados = [];
    const regex = new RegExp(`${nome}="([^"]*)"`, 'g');
    let m;
    while ((m = regex.exec(header)) !== null) encontrados.push(m[1]);
    return encontrados;
}

test('o prefixo de assets do header é a raiz do domínio', () => {
    assert.match(
        header,
        /const BASE = '\/';/,
        'BASE precisa ser "/" — prefixo relativo quebra em URLs com pasta como /escapadas/curitiba'
    );
});

test('todo src do header sai da raiz', () => {
    const valores = atributos('src').map((v) => v.replace('${BASE}', '/'));
    assert.ok(valores.length > 0, 'nenhum src encontrado: o teste perdeu o alvo');
    valores.forEach((v) => {
        assert.ok(ehAceitavel(v), `src relativo no header: "${v}" — resolve errado fora da raiz`);
    });
});

test('todo href do header sai da raiz', () => {
    const valores = atributos('href').map((v) => v.replace('${BASE}', '/'));
    assert.ok(valores.length > 0, 'nenhum href encontrado: o teste perdeu o alvo');
    valores.forEach((v) => {
        assert.ok(ehAceitavel(v), `href relativo no header: "${v}" — resolve errado fora da raiz`);
    });
});

test('os redirecionamentos do header apontam para caminhos absolutos', () => {
    const destinos = [...header.matchAll(/window\.location\.href\s*=\s*([^;]+);/g)].map((m) => m[1].trim());
    assert.ok(destinos.length > 0, 'nenhum redirecionamento encontrado: o teste perdeu o alvo');
    destinos.forEach((d) => {
        assert.match(d, /^'\//, `redirecionamento relativo no header: ${d}`);
    });
});

test('o logo tem fallback quando a imagem não carrega', () => {
    // Sem isso, uma falha de rede deixa o ícone de imagem quebrada com o alt
    // sublinhado em azul no meio do header laranja.
    assert.match(header, /class="bh-logo"[^>]*onerror=/s, 'o logo precisa de onerror');
    assert.match(header, /\.bh-logo\.bh-logo-fallback\s*\{/, 'falta o estilo do fallback do logo');
});

test('o menu do topo usa as URLs canônicas sem .html', () => {
    const navLinks = [...header.matchAll(/<a href="([^"]+)" class="bh-nav-link">/g)].map((m) => m[1]);
    assert.equal(navLinks.length, 4, 'o menu do topo deveria ter quatro atalhos');
    navLinks.forEach((href) => {
        assert.doesNotMatch(href, /\.html$/, `${href} usa .html: o site publica URLs limpas (cleanUrls)`);
    });
});

test('o breadcrumb reconhece as páginas com cidade na URL', () => {
    // /escapadas/curitiba tem a ferramenta no primeiro segmento e a cidade no
    // último: ler só o último segmento deixava as duas páginas sem contexto.
    assert.match(header, /'escapadas':\s*\{/, 'falta o contexto de Escapadas');
    assert.match(header, /'destinos-baratos':\s*\{/, 'falta o contexto de Destinos Baratos');
    assert.match(header, /pathname\.split\('\/'\)\.filter\(Boolean\)/, 'o contexto precisa percorrer os segmentos da URL');
});
