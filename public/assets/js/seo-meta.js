/**
 * SEO Meta Tags Injector - Benetrip
 *
 * Este script injeta automaticamente meta tags de SEO (Open Graph, Twitter Cards,
 * canonical URL e JSON-LD) em todas as páginas do site.
 *
 * COMO FUNCIONA:
 * 1. Lê o <title> e <meta name="description"> que já existem na página
 * 2. Gera automaticamente as tags og:title, og:description, twitter:title, etc.
 * 3. Adiciona a URL canônica baseada na URL atual
 * 4. Injeta dados estruturados (JSON-LD) específicos por página
 *
 * Para usar: basta incluir <script src="assets/js/seo-meta.js"></script> no <head>
 */
(function () {
  'use strict';

  var SITE_URL = 'https://benetrip.com.br';
  var SITE_NAME = 'Benetrip';
  var DEFAULT_IMAGE = SITE_URL + '/assets/images/favicon/web-app-manifest-512x512.png';
  var DEFAULT_DESCRIPTION = 'Planeje sua viagem perfeita com a Tripinha! Descubra destinos incríveis, encontre passagens baratas e crie roteiros personalizados.';
  var LOCALE = 'pt_BR';

  // Pega dados existentes da página
  var title = document.title || SITE_NAME;
  var descTag = document.querySelector('meta[name="description"]');
  var description = descTag ? descTag.getAttribute('content') : DEFAULT_DESCRIPTION;

  // Gera URL canônica (sem .html, sem query strings)
  var canonicalPath = window.location.pathname
    .replace(/\.html$/, '')
    .replace(/\/index$/, '/')
    .replace(/\/+$/, '') || '/';
  var canonicalUrl = SITE_URL + canonicalPath;

  // ========== OPEN GRAPH ==========
  var ogTags = {
    'og:type': 'website',
    'og:site_name': SITE_NAME,
    'og:title': title,
    'og:description': description,
    'og:url': canonicalUrl,
    'og:image': DEFAULT_IMAGE,
    'og:locale': LOCALE
  };

  // ========== TWITTER CARD ==========
  var twitterTags = {
    'twitter:card': 'summary_large_image',
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': DEFAULT_IMAGE
  };

  // Injeta as meta tags no <head>
  var head = document.head;

  // Adiciona canonical link se não existir
  if (!document.querySelector('link[rel="canonical"]')) {
    var link = document.createElement('link');
    link.rel = 'canonical';
    link.href = canonicalUrl;
    head.appendChild(link);
  }

  // Injeta OG tags
  Object.keys(ogTags).forEach(function (property) {
    if (!document.querySelector('meta[property="' + property + '"]')) {
      var meta = document.createElement('meta');
      meta.setAttribute('property', property);
      meta.setAttribute('content', ogTags[property]);
      head.appendChild(meta);
    }
  });

  // Injeta Twitter tags
  Object.keys(twitterTags).forEach(function (name) {
    if (!document.querySelector('meta[name="' + name + '"]')) {
      var meta = document.createElement('meta');
      meta.setAttribute('name', name);
      meta.setAttribute('content', twitterTags[name]);
      head.appendChild(meta);
    }
  });

  // ========== JSON-LD (DADOS ESTRUTURADOS) ==========
  // Mapeia páginas para seus dados estruturados específicos
  var path = canonicalPath;
  var jsonLd = null;

  if (path === '/' || path === '') {
    // Página principal - Organization + WebSite + SearchAction
    jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        'name': 'Benetrip',
        'url': SITE_URL,
        'logo': DEFAULT_IMAGE,
        'description': description,
        'sameAs': []
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'name': SITE_NAME,
        'url': SITE_URL,
        'description': description,
        'potentialAction': {
          '@type': 'SearchAction',
          'target': SITE_URL + '/descobrir-destinos',
          'query-input': 'required name=destination'
        }
      }
    ];
  } else if (path === '/voos' || path === '/voos-baratos' || path === '/comparar-voos' || path === '/multidatas') {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': title,
      'url': canonicalUrl,
      'applicationCategory': 'TravelApplication',
      'operatingSystem': 'Web',
      'description': description,
      'provider': {
        '@type': 'Organization',
        'name': 'Benetrip',
        'url': SITE_URL
      },
      'offers': {
        '@type': 'AggregateOffer',
        'priceCurrency': 'BRL',
        'availability': 'https://schema.org/InStock'
      }
    };
  } else if (path === '/destinos-baratos') {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': title,
      'url': canonicalUrl,
      'description': description,
      'provider': {
        '@type': 'Organization',
        'name': 'Benetrip',
        'url': SITE_URL
      },
      'about': {
        '@type': 'Thing',
        'name': 'Passagens aéreas baratas',
        'description': 'Ranking diário dos destinos mais baratos saindo das principais cidades do Brasil'
      },
      'mainEntity': {
        '@type': 'ItemList',
        'itemListOrder': 'https://schema.org/ItemListOrderAscending',
        'name': 'Destinos mais baratos hoje'
      }
    };
  } else if (path === '/descobrir-destinos' || path === '/todos-destinos') {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': title,
      'url': canonicalUrl,
      'applicationCategory': 'TravelApplication',
      'operatingSystem': 'Web',
      'description': description,
      'provider': {
        '@type': 'Organization',
        'name': 'Benetrip',
        'url': SITE_URL
      }
    };
  } else if (path === '/roteiro-viagem' || path === '/create-itinerary') {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'TravelAction',
      'name': title,
      'description': description,
      'target': canonicalUrl,
      'provider': {
        '@type': 'Organization',
        'name': 'Benetrip',
        'url': SITE_URL
      }
    };
  } else if (path === '/quemsomos') {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      'name': title,
      'url': canonicalUrl,
      'description': description,
      'mainEntity': {
        '@type': 'Organization',
        'name': 'Benetrip',
        'url': SITE_URL,
        'foundingDate': '2024',
        'description': 'Plataforma inteligente de planejamento de viagens com IA'
      }
    };
  } else if (path === '/perguntasfrequentes') {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'name': title,
      'url': canonicalUrl,
      'description': description
    };
  } else if (path === '/termos') {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      'name': title,
      'url': canonicalUrl,
      'description': description,
      'mainEntity': {
        '@type': 'CreativeWork',
        'name': 'Termos e Condições de Uso',
        'text': description
      }
    };
  } else if (path === '/privacidade') {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      'name': title,
      'url': canonicalUrl,
      'description': description,
      'mainEntity': {
        '@type': 'CreativeWork',
        'name': 'Política de Privacidade',
        'text': description
      }
    };
  } else if (path === '/cookies') {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      'name': title,
      'url': canonicalUrl,
      'description': description
    };
  } else if (path === '/destinos') {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': title,
      'url': canonicalUrl,
      'applicationCategory': 'TravelApplication',
      'operatingSystem': 'Web',
      'description': description,
      'provider': {
        '@type': 'Organization',
        'name': 'Benetrip',
        'url': SITE_URL
      }
    };
  } else if (path === '/hoteis') {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': title,
      'url': canonicalUrl,
      'applicationCategory': 'TravelApplication',
      'operatingSystem': 'Web',
      'description': description,
      'provider': {
        '@type': 'Organization',
        'name': 'Benetrip',
        'url': SITE_URL
      },
      'offers': {
        '@type': 'AggregateOffer',
        'priceCurrency': 'BRL',
        'availability': 'https://schema.org/InStock'
      }
    };
  } else if (path === '/chat' || path === '/inicio') {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': title,
      'url': canonicalUrl,
      'applicationCategory': 'TravelApplication',
      'operatingSystem': 'Web',
      'description': description,
      'provider': {
        '@type': 'Organization',
        'name': 'Benetrip',
        'url': SITE_URL
      }
    };
  } else if (path === '/itinerary' || path === '/itinerary2' || path === '/flights') {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': title,
      'url': canonicalUrl,
      'applicationCategory': 'TravelApplication',
      'operatingSystem': 'Web',
      'description': description,
      'provider': {
        '@type': 'Organization',
        'name': 'Benetrip',
        'url': SITE_URL
      }
    };
  }

  // Injeta JSON-LD se existir para esta página
  if (jsonLd) {
    var items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
    items.forEach(function (data) {
      var script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(data);
      head.appendChild(script);
    });
  }
})();
