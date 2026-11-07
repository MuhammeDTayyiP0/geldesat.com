-- The banner has one button now: only essential cookies exist, so there is
-- nothing to choose between. An admin's own edit of this text stays untouched.
update legal_pages
set body = replace(replace(body,
  'Banner''da "Tümünü kabul et" derseniz, ileride eklenebilecek ölçüm çerezleri de devreye girebilir. ', ''),
  'Banner''daki seçiminizi değiştirmek için tarayıcıda geldesat-cookie kaydını silin veya çerezleri temizleyin; sayfa yenilenince banner yeniden çıkar. "Sadece zorunlu" her zaman yeterlidir.',
  'Çerezleri tarayıcınızdan istediğiniz zaman silebilirsiniz. Zorunlu çerezler olmadan oturum açılamaz.')
where slug = 'cerez';
