# modules/realtime-chat

Supabase Realtime ile oda bazlı canlı sohbet + presence (kaç kişi çevrimiçi).

```tsx
navigation.navigate("Chat", { roomId: "genel" });
```

## ZORUNLU: tabloyu Realtime yayınına ekle

`schema.sql` bunu `alter publication supabase_realtime add table messages` ile
deniyor ama **bazı planlarda panelden de onaylamak gerekiyor**:
Dashboard > Database > Replication.

Bu adım atlanırsa mesajlar **canlı gelmez** — sadece ekranı yeniden açınca
görünür. En sık karşılaşılan "realtime çalışmıyor" nedeni bu.

## Kanalı kapatmak zorunlu

Realtime eşzamanlı bağlantı kotasına tabi (ücretsiz planda sınırlı).
`useChat` unmount'ta `removeChannel` çağırıyor; kendi kanalını açarsan aynısını
yap, yoksa ekranlar arası gezindikçe bağlantılar birikir ve yeni abonelikler
sessizce başarısız olur.

## Mesaj tekilleştirme

Kendi `INSERT`'in hem optimistik ekleme hem de realtime event olarak iki kez
gelebiliyor. `useChat` id bazlı bir `Set` ile tekilleştiriyor — kendi
implementasyonunda bunu atlarsan mesajlar çift görünür.

## Özel odalar

Varsayılan RLS **tüm odaları herkese okutur**. Özel oda istiyorsan:

```sql
create table room_members (room_id text, user_id uuid, primary key (room_id, user_id));

create policy "Sadece oda üyeleri okur" on messages for select
  using (exists (select 1 from room_members m
                 where m.room_id = messages.room_id and m.user_id = auth.uid()));
```

## APPLE GUIDELINE 1.2

Sohbet kullanıcı içeriğidir — `modules/moderation` olmadan review'dan geçmez.
Raporlama ve **kullanıcı engelleme** ikisi de gerekli.
