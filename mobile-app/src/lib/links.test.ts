/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appRouteForWebPath } from '@/lib/links';

describe('appRouteForWebPath', () => {
  it('maps home paths and canonical site URLs to root', () => {
    assert.equal(appRouteForWebPath('/'), '/');
    assert.equal(appRouteForWebPath('  '), '/');
    assert.equal(appRouteForWebPath('https://www.geldesat.com'), '/');
    assert.equal(appRouteForWebPath('https://geldesat.com/'), '/');
  });

  it('maps listing and conversation paths', () => {
    assert.deepEqual(appRouteForWebPath('/ilan/temiz-arac-123'), {
      pathname: '/ilan/[id]',
      params: { id: 'temiz-arac-123' },
    });
    assert.deepEqual(appRouteForWebPath('https://www.geldesat.com/ilan/ev-45?utm=1#detay'), {
      pathname: '/ilan/[id]',
      params: { id: 'ev-45' },
    });
    assert.equal(appRouteForWebPath('/ilan'), null);

    assert.equal(appRouteForWebPath('/mesajlar'), '/mesajlar');
    assert.deepEqual(appRouteForWebPath('/mesajlar/conv-99'), {
      pathname: '/mesaj/[id]',
      params: { id: 'conv-99' },
    });
  });

  it('maps map, category, and search routes', () => {
    assert.equal(appRouteForWebPath('/harita'), '/harita');

    assert.deepEqual(appRouteForWebPath('/category/otomobil'), {
      pathname: '/sonuclar',
      params: { category: 'otomobil' },
    });
    assert.equal(appRouteForWebPath('/category'), null);

    assert.deepEqual(
      appRouteForWebPath('/search?q=laptop&category=elektronik&city=istanbul&district=besiktas&sort=price_asc&extra=ignored'),
      {
        pathname: '/sonuclar',
        params: {
          q: 'laptop',
          category: 'elektronik',
          city: 'istanbul',
          district: 'besiktas',
          sort: 'price_asc',
        },
      },
    );
    assert.deepEqual(appRouteForWebPath('/search'), {
      pathname: '/sonuclar',
      params: {},
    });
  });

  it('maps settings, account, seller, store, and static pages', () => {
    assert.equal(appRouteForWebPath('/ayarlar/hesap'), '/ayarlar/guvenlik');
    assert.equal(appRouteForWebPath('/ayarlar/gizlilik'), '/ayarlar/gizlilik');
    assert.equal(appRouteForWebPath('/ayarlar/bilinmeyen'), '/ayarlar');
    assert.equal(appRouteForWebPath('/ayarlar'), '/ayarlar');

    assert.equal(appRouteForWebPath('/profil'), '/hesap');
    assert.equal(appRouteForWebPath('/ilanlarim'), '/ilanlarim');
    assert.equal(appRouteForWebPath('/favoriler'), '/favoriler');
    assert.equal(appRouteForWebPath('/bildirimler'), '/bildirimler');
    assert.equal(appRouteForWebPath('/ilan-ver'), '/ilan-ver');
    assert.equal(appRouteForWebPath('/doping'), '/doping');
    assert.equal(appRouteForWebPath('/son-bakilanlar'), '/son-bakilanlar');

    assert.deepEqual(appRouteForWebPath('/satici/user-1'), {
      pathname: '/satici/[id]',
      params: { id: 'user-1' },
    });
    assert.deepEqual(appRouteForWebPath('/magaza/oto-galeri'), {
      pathname: '/magaza/[slug]',
      params: { slug: 'oto-galeri' },
    });
    assert.deepEqual(appRouteForWebPath('/sayfa/hakkimizda'), {
      pathname: '/sayfa/[slug]',
      params: { slug: 'hakkimizda' },
    });
  });

  it('decodes percent-encoded segments safely without throwing on malformed input', () => {
    assert.deepEqual(appRouteForWebPath('/category/ev%20esyasi'), {
      pathname: '/sonuclar',
      params: { category: 'ev esyasi' },
    });
    assert.deepEqual(appRouteForWebPath('/ilan/%E0%A4%A'), {
      pathname: '/ilan/[id]',
      params: { id: '%E0%A4%A' },
    });
  });

  it('returns null for external hosts and unknown paths', () => {
    assert.equal(appRouteForWebPath('https://evil.example/ilan/123'), null);
    assert.equal(appRouteForWebPath('https://sub.geldesat.com/ilan/123'), null);
    assert.equal(appRouteForWebPath('/bilinmeyen/rota'), null);
    assert.equal(appRouteForWebPath('ftp://www.geldesat.com/ilan/123'), null);
  });
});
