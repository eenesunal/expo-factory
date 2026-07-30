-- Konumlu kayıtlar. ZATEN lat/lon tutan bir tablon varsa bu tabloya ihtiyacın
-- yok — aşağıdaki `nearby_places` fonksiyonunu kendi tablonla yaz ve bunu sil.
create table if not exists places (
  id bigint generated always as identity primary key,
  entity_id text not null unique,
  title text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now()
);

-- Kaba bir kutu filtresi için (fonksiyon önce bounding box ile eliyor, sonra
-- gerçek mesafeyi hesaplıyor — tam tarama yapmasın).
create index if not exists places_lat_lon_idx on places (latitude, longitude);

alter table places enable row level security;

drop policy if exists "Konumlar herkese okunur" on places;
create policy "Konumlar herkese okunur"
  on places for select
  using (true);

-- ponytail: PostGIS YOK. Haversine formülü düz SQL'le yazılabiliyor ve
-- şehir/ülke ölçeğinde "yakındakiler" için yeterince doğru.
-- Ceiling: gerçek geometri işlemleri (poligon içi mi, rota mesafesi, karmaşık
-- uzamsal index) yapamaz. Yükseltme yolu: `create extension postgis` + geography
-- kolonu + ST_DWithin.
--
-- Bounding box ön filtresi index'ten faydalanır; trigonometri sadece kalan
-- satırlarda çalışır. Bu olmadan her sorgu tüm tabloyu tarar.
create or replace function public.nearby_places(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km double precision default 10,
  p_limit int default 50
)
returns table (entity_id text, title text, latitude double precision, longitude double precision, distance_km double precision)
language sql stable
as $$
  with box as (
    select
      p_radius_km / 111.045 as lat_delta,
      -- Boylam dereceleri kutuplara doğru daralır; enlemin kosinüsüyle
      -- ölçekliyoruz. cos(0)'a bölmeyi engellemek için alt sınır koyuyoruz.
      p_radius_km / (111.045 * greatest(cos(radians(p_latitude)), 0.01)) as lon_delta
  ),
  candidates as (
    select p.* from places p, box b
    where p.latitude between p_latitude - b.lat_delta and p_latitude + b.lat_delta
      and p.longitude between p_longitude - b.lon_delta and p_longitude + b.lon_delta
  )
  select c.entity_id, c.title, c.latitude, c.longitude,
    (6371 * 2 * asin(sqrt(
      power(sin(radians(c.latitude - p_latitude) / 2), 2) +
      cos(radians(p_latitude)) * cos(radians(c.latitude)) *
      power(sin(radians(c.longitude - p_longitude) / 2), 2)
    )))::double precision as distance_km
  from candidates c
  where (6371 * 2 * asin(sqrt(
      power(sin(radians(c.latitude - p_latitude) / 2), 2) +
      cos(radians(p_latitude)) * cos(radians(c.latitude)) *
      power(sin(radians(c.longitude - p_longitude) / 2), 2)
    ))) <= p_radius_km
  order by distance_km
  limit p_limit;
$$;

grant execute on function public.nearby_places(double precision, double precision, double precision, int) to anon, authenticated;
