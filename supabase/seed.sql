-- =====================================================================
-- Tana Studio · Datos iniciales (Roma y Las Popas · noviembre 2026)
-- Usuarios de prueba (contraseña local: tana1234). REEMPLAZAR emails reales antes de usar en producción.
-- =====================================================================
set session_replication_role = replica; -- evita triggers de actividad/notificaciones durante la carga

-- ---------- Helpers temporales ----------
create or replace function pg_temp.ar(ts text) returns timestamptz language sql immutable as $$
  select (ts::timestamp at time zone 'America/Argentina/Buenos_Aires')
$$;

-- ---------- Usuarios ----------
create or replace function pg_temp.mk_user(p_id uuid, p_email text, p_name text, p_admin boolean) returns void
language plpgsql as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('tana1234', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_name), now(), now(), '', '', '', '')
  on conflict (id) do nothing;
  insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (p_id, p_id::text, jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now())
  on conflict do nothing;
  insert into public.profiles (id, email, full_name, is_tana_admin) values (p_id, p_email, p_name, p_admin)
  on conflict (id) do update set is_tana_admin = excluded.is_tana_admin, full_name = excluded.full_name;
end $$;

select pg_temp.mk_user('a0000000-0000-4000-8000-000000000001', 'socia1@tana.studio', 'Socia 1 · Tana', true);
select pg_temp.mk_user('a0000000-0000-4000-8000-000000000002', 'socia2@tana.studio', 'Socia 2 · Tana', true);
select pg_temp.mk_user('b0000000-0000-4000-8000-000000000001', 'roma@ejemplo.com', 'Román (Roma)', false);
select pg_temp.mk_user('b0000000-0000-4000-8000-000000000002', 'laspopas@ejemplo.com', 'Las Popas', false);

-- ---------- Clientes ----------
insert into public.workspaces (id, slug, name, industry, city, contact_name, whatsapp, email, socials, website, logo_url, brand,
  production_mode, approval_lead_days, revision_rounds, material_deadline_day, how_to_read_md, calendar_note, brand_book)
values
('c0000000-0000-4000-8000-000000000001', 'roma', 'Roma · Centro de Entrenamiento', 'Gimnasio · entrenamiento de fuerza',
 'Chivilcoy, Bs. As.', 'Román', '5492346000000', 'roma@ejemplo.com', '{"instagram":"roma.entrenamiento"}', null,
 '/logos/roma.png',
 '{"primary":"#5FB168","secondary":"#2F6B35","background":"#231F20","surface":"#2E2A2B","text":"#F2F0EA","muted":"#A8A29E","font":"Open Sans","headingFont":"Open Sans","theme":"dark"}',
 'cliente', 3, 2, 25,
$md$**Planificación, dirección creativa e indicaciones de grabación a cargo de Tana Studio · Producción audiovisual en sitio a cargo del equipo de Roma.**

### Tipos de pieza
- **Carrusel / Post · 1 por semana** — Pieza estática o carrusel de imágenes. Feed principal, contenido más elaborado: educativo, institucional o de resultados.
- **Reel · 1 por semana** — Video corto vertical. Contenido dinámico grabado en el box: rutinas, testimonios, detrás de escena, tips.
- **Historia · 4 por semana** — Contenido efímero (24 hs). Información, encuestas, backstage, recordatorios.

### Frecuencia semanal fija (4 semanas · noviembre)
- 1 Carrusel / Post — martes 18:00 hs
- 1 Reel — jueves 19:00 hs
- 4 Historias — lunes 10:00 · martes 13:00 · miércoles 18:00 · viernes 19:00

### ¿Por qué estos días y horarios?
- **Martes 18:00 (Post/Carrusel):** martes y miércoles son los días de mayor interacción general; en fitness, la franja 17–19 hs coincide con la salida de los turnos de entrenamiento de la tarde.
- **Jueves 19:00 (Reel):** los reels rinden mejor entre 18 y 23 hs entre semana; se elige jueves para no competir con el post del martes.
- **Historias:** alternadas entre la mañana (pre-entreno / motivación) y la tarde (post-entreno).$md$,
 null,
 '{"tone":"Cercano, motivador, directo. Voseo. Sin tecnicismos innecesarios.","audience":"Personas de Chivilcoy y alrededores que quieren empezar o sostener el entrenamiento de fuerza; ahora también personas de otras ciudades (plan online).","pillars":["Educativo / técnica","Comunidad y testimonios","Servicio online","Detrás de escena"],"use_words":["acompañamiento","evaluación funcional","a tu ritmo"],"avoid_words":["sin dolor no hay ganancia","cuerpo perfecto"],"hashtags":"#RomaEntrenamiento #Chivilcoy #EntrenamientoDeFuerza","links":["WhatsApp para consultas"]}'),
('c0000000-0000-4000-8000-000000000002', 'las-popas', 'Las Popas', 'Indumentaria de lino · tienda online',
 null, 'Las Popas', null, 'laspopas@ejemplo.com', '{"instagram":"laspopas"}', null,
 '/logos/las-popas-azul.png',
 '{"primary":"#004B76","secondary":"#E5DCCB","background":"#F7F3E8","surface":"#FFFDF8","text":"#0F2A3D","muted":"#6B7280","font":"Inter","headingFont":"Cormorant Garamond","theme":"light"}',
 'tana', 3, 2, 20,
$md$**"made by two" · Planificación y dirección de contenido a cargo de Tana Studio.**

### Tipos de pieza
- **Post · 1 o 2 por semana** — Carrusel o pieza estática para el feed. Contenido más elaborado: producto, confección, prueba de calidad, mensaje de marca.
- **Reel · 1 cada 15 días** — Video corto vertical. Contenido dinámico: detrás de escena, proceso de diseño, el lino puesto en el día a día, modelando el lino.
- **Historia · 5 por semana** — Contenido efímero (24 hs). Adelantos, encuestas, backstage, recordatorios, CTA.

### Frecuencia semanal fija (noviembre)
- Post — lunes 19:00 hs
- Post — miércoles 19:00 hs
- Reel — viernes 20:00 hs (cada 15 días)
- Historias — repartidas de lunes a viernes, para sostener la conversación entre los posts y el reel.$md$,
 'Domingos y días sin marcar quedan libres para historias o descanso de publicación.',
 '{"tone":"Editorial, cálido, honesto. Un lino que se muestra tal cual es, sin filtro.","audience":"Mujeres que buscan prendas de lino de calidad y compran online.","pillars":["Producto y detalle","Proceso y confección","Marca / identidad","Venta"],"use_words":["lino","hecho a mano","made by two"],"avoid_words":["oferta imperdible","últimas unidades (si no es real)"],"hashtags":"#LasPopas #Lino #MadeByTwo","links":["Tienda online"]}');

insert into public.memberships (user_id, workspace_id, role, last_seen_at) values
('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'client_editor', pg_temp.ar('2026-11-20 09:00')),
('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'client_editor', pg_temp.ar('2026-11-20 09:00'));

-- ---------- Tipos de pieza (colores de cada marca) ----------
insert into public.content_types (workspace_id, key, label, color, text_color, description, sort) values
('c0000000-0000-4000-8000-000000000001', 'post', 'Post', '#2F6B35', '#FFFFFF', 'Pieza estática para el feed.', 1),
('c0000000-0000-4000-8000-000000000001', 'carrusel', 'Carrusel', '#2F6B35', '#FFFFFF', 'Carrusel de imágenes para el feed.', 2),
('c0000000-0000-4000-8000-000000000001', 'reel', 'Reel', '#F2F0EA', '#231F20', 'Video corto vertical.', 3),
('c0000000-0000-4000-8000-000000000001', 'historia', 'Historia', '#4A4544', '#F2F0EA', 'Contenido efímero (24 hs).', 4),
('c0000000-0000-4000-8000-000000000001', 'tiktok', 'TikTok', '#111111', '#FFFFFF', 'Video para TikTok.', 5),
('c0000000-0000-4000-8000-000000000001', 'otro', 'Otro', '#78716C', '#FFFFFF', null, 6),
('c0000000-0000-4000-8000-000000000002', 'post', 'Post', '#004B76', '#FFFFFF', 'Carrusel o pieza estática para el feed.', 1),
('c0000000-0000-4000-8000-000000000002', 'carrusel', 'Carrusel', '#004B76', '#FFFFFF', 'Carrusel para el feed.', 2),
('c0000000-0000-4000-8000-000000000002', 'reel', 'Reel', '#FFFFFF', '#004B76', 'Video corto vertical.', 3),
('c0000000-0000-4000-8000-000000000002', 'historia', 'Historia', '#E5DCCB', '#004B76', 'Contenido efímero (24 hs).', 4),
('c0000000-0000-4000-8000-000000000002', 'tiktok', 'TikTok', '#111111', '#FFFFFF', 'Video para TikTok.', 5),
('c0000000-0000-4000-8000-000000000002', 'otro', 'Otro', '#6B7280', '#FFFFFF', null, 6);

create or replace function pg_temp.t(ws uuid, k text) returns uuid language sql stable as $$
  select id from public.content_types where workspace_id = ws and key = k
$$;

-- ---------- Pilares y series ----------
insert into public.pillars (workspace_id, name, color) values
('c0000000-0000-4000-8000-000000000001', 'Educativo', '#2563EB'),
('c0000000-0000-4000-8000-000000000001', 'Comunidad', '#DB2777'),
('c0000000-0000-4000-8000-000000000001', 'Servicio online', '#059669'),
('c0000000-0000-4000-8000-000000000001', 'Cercanía', '#D97706'),
('c0000000-0000-4000-8000-000000000002', 'Producto y detalle', '#004B76'),
('c0000000-0000-4000-8000-000000000002', 'Marca / identidad', '#9A7B4F'),
('c0000000-0000-4000-8000-000000000002', 'Venta', '#B45309');

create or replace function pg_temp.p(ws uuid, n text) returns uuid language sql stable as $$
  select id from public.pillars where workspace_id = ws and name = n
$$;

insert into public.series (id, workspace_id, name, description) values
('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Testimonios reales',
 'Sección mensual: un testimonio diferente por mes, siempre como reel en el perfil.'),
('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Un mate con los profes',
 'Ronda de preguntas rápidas con un profe de Roma, mate de por medio.');

-- ---------- Plantillas semanales ----------
insert into public.template_slots (workspace_id, content_type_id, weekday, time, recurrence, anchor_date, title_default, story_template, sort) values
('c0000000-0000-4000-8000-000000000001', pg_temp.t('c0000000-0000-4000-8000-000000000001','carrusel'), 2, '18:00', 'weekly', null, null, '{}', 1),
('c0000000-0000-4000-8000-000000000001', pg_temp.t('c0000000-0000-4000-8000-000000000001','reel'), 4, '19:00', 'weekly', null, null, '{}', 2),
('c0000000-0000-4000-8000-000000000001', pg_temp.t('c0000000-0000-4000-8000-000000000001','historia'), 1, '10:00', 'weekly', null, 'Historia con caja de preguntas',
  '{"example":"¿Cuál es tu objetivo de esta semana?","objective":"Da material para responder en historias y conocer a la comunidad.","format":"Sticker de caja de preguntas"}', 3),
('c0000000-0000-4000-8000-000000000001', pg_temp.t('c0000000-0000-4000-8000-000000000001','historia'), 2, '13:00', 'weekly', null, 'Historia con encuesta ¿Verdadero o falso?',
  '{"example":"\"Si entrenás todos los días vas a progresar más rápido\" VERDADERO / FALSO","objective":"Educar y generar interacción.","format":"Sticker de encuesta"}', 4),
('c0000000-0000-4000-8000-000000000001', pg_temp.t('c0000000-0000-4000-8000-000000000001','historia'), 3, '18:00', 'weekly', null, 'Historia recap del día en Roma',
  '{"example":"Clips cortos del día: turnos, ejercicios, ambiente.","objective":"Mostrar el día a día del box.","format":"Video 9:16"}', 5),
('c0000000-0000-4000-8000-000000000001', pg_temp.t('c0000000-0000-4000-8000-000000000001','historia'), 5, '19:00', 'weekly', null, 'Historia semana cumplida',
  '{"example":"Mensaje de Roma para cerrar la semana sobre un video o foto de alumnos entrenando durante esos días, con música tranquila.","objective":"Reconocer el esfuerzo y despedir la semana con buena onda.","format":"Video o foto 9:16 + texto"}', 6),
('c0000000-0000-4000-8000-000000000002', pg_temp.t('c0000000-0000-4000-8000-000000000002','post'), 1, '19:00', 'weekly', null, null, '{}', 1),
('c0000000-0000-4000-8000-000000000002', pg_temp.t('c0000000-0000-4000-8000-000000000002','post'), 3, '19:00', 'weekly', null, null, '{}', 2),
('c0000000-0000-4000-8000-000000000002', pg_temp.t('c0000000-0000-4000-8000-000000000002','reel'), 5, '20:00', 'biweekly', '2026-11-13', null, '{}', 3),
('c0000000-0000-4000-8000-000000000002', pg_temp.t('c0000000-0000-4000-8000-000000000002','historia'), 1, '12:00', 'weekly', null, 'Historia del día', '{"objective":"Sostener la conversación entre los posts y el reel."}', 4),
('c0000000-0000-4000-8000-000000000002', pg_temp.t('c0000000-0000-4000-8000-000000000002','historia'), 2, '12:00', 'weekly', null, 'Historia del día', '{"objective":"Sostener la conversación entre los posts y el reel."}', 5),
('c0000000-0000-4000-8000-000000000002', pg_temp.t('c0000000-0000-4000-8000-000000000002','historia'), 3, '12:00', 'weekly', null, 'Historia del día', '{"objective":"Sostener la conversación entre los posts y el reel."}', 6),
('c0000000-0000-4000-8000-000000000002', pg_temp.t('c0000000-0000-4000-8000-000000000002','historia'), 4, '12:00', 'weekly', null, 'Historia del día', '{"objective":"Sostener la conversación entre los posts y el reel."}', 7),
('c0000000-0000-4000-8000-000000000002', pg_temp.t('c0000000-0000-4000-8000-000000000002','historia'), 5, '12:00', 'weekly', null, 'Historia del día', '{"objective":"Sostener la conversación entre los posts y el reel."}', 8);

-- ---------- Meses ----------
insert into public.months (id, workspace_id, year, month, status, intro, share_token, sent_at, approved_at, approved_by) values
('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 2026, 11, 'aprobado',
 'Mes de lanzamiento del servicio online de Roma: contamos que se puede entrenar desde cualquier lugar, mostramos el seguimiento real y sumamos comunidad.',
 'roma-nov-2026-demo-share-token-abc123', pg_temp.ar('2026-10-28 10:00'), pg_temp.ar('2026-10-29 21:14'), 'b0000000-0000-4000-8000-000000000001'),
('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 2026, 11, 'enviado',
 'Objetivos del mes: (1) instalar el concepto de marca antes de fin de año: un lino que se muestra tal cual es, sin filtro; (2) generar confianza en el producto mostrando las prendas puestas, en movimiento y en detalle; (3) convertir esa confianza en ventas, llevando a las clientas a comprar en la tienda online antes de las fiestas.',
 'laspopas-nov-2026-demo-share-token-xyz789', pg_temp.ar('2026-11-05 10:00'), null, null),
('e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 2026, 12, 'borrador', null, null, null, null, null);

-- =====================================================================
-- ROMA · Noviembre 2026
-- =====================================================================
insert into public.content_items (workspace_id, month_id, content_type_id, publish_at, status, pillar_id, series_id,
  production_owner, production_person, title, objective, format, recording_instructions, shot_list, script, slides,
  caption, cta, client_material_request, client_material_due, client_material_sent_at, clarifications, published_url, created_by)
values
-- 1. Carrusel 3/11
('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', pg_temp.t('c0000000-0000-4000-8000-000000000001','carrusel'),
 pg_temp.ar('2026-11-03 18:00'), 'publicado', pg_temp.p('c0000000-0000-4000-8000-000000000001','Servicio online'), null, 'mixto', 'Diseño: Tana · Info: Román',
 'Roma, ahora desde donde estés',
 'Dar a conocer por primera vez que Roma ahora se entrena desde cualquier lugar, y generar consultas directas por WhatsApp.',
 '{"ratio":"4:5","slides":3}',
 'Formato carrusel de 3 placas. Román debe brindar información detallada del servicio online (cómo es la evaluación, frecuencia, qué incluye el seguimiento).',
 '[]', '[]',
 $j$[{"text":"No importa en qué lugar estés. Podés entrenar con Roma."},{"text":"Cómo funciona: evaluación funcional online → planificación 100% personalizada → fuerza 2 o 3 veces por semana."},{"text":"Acompañamiento directo por WhatsApp. Escribinos y empezá con tu evaluación."}]$j$,
 'Entrená con nosotros desde donde estés. 🌎' || chr(10) || 'Arrancamos con una evaluación funcional online, armamos tu planificación 100% personalizada y te acompañamos por WhatsApp durante todo el proceso.' || chr(10) || 'Escribinos por mensaje directo y agendá tu evaluación.',
 'Escribinos y empezá con tu evaluación.',
 'Información detallada del servicio online (Román).', '2026-10-31', pg_temp.ar('2026-10-30 12:00'), null, null, 'a0000000-0000-4000-8000-000000000001'),
-- 2. Reel 5/11
('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', pg_temp.t('c0000000-0000-4000-8000-000000000001','reel'),
 pg_temp.ar('2026-11-05 19:00'), 'publicado', pg_temp.p('c0000000-0000-4000-8000-000000000001','Servicio online'), null, 'cliente', 'Román',
 'Online, pero con alguien del otro lado',
 'Mostrar que el servicio online de Roma no es una rutina descargable sino seguimiento real, para bajar la desconfianza de quien no vive en Chivilcoy y generar consultas por WhatsApp.',
 '{"ratio":"9:16","duration":"30–45 s"}',
 '- Grabá con el celular en vertical, a la altura de los ojos.' || chr(10) || '- Usá Roma como fondo, que se vea el espacio.' || chr(10) || '- Ponete de frente a la luz (una ventana o la puerta), nunca de espaldas.' || chr(10) || '- Tomas sin hablar (más abajo) + la parte hablada del guion mirando a cámara.',
 $j$[{"text":"Vos en la compu armando una planificación — toma de costado","done":true},{"text":"Pantalla de la compu de cerca mientras armás la planificación","done":true},{"text":"Vos mirando un video de alguien entrenando en el celular o la compu (puede ser un alumno que dé permiso)","done":true}]$j$,
 $j$[{"section":"Gancho","time":"0–3 s","voice":"No importa dónde estés: ahora podés entrenar con Roma.","on_screen":"Entrená con Roma desde donde estés"},{"section":"Desarrollo","time":"","voice":"Arrancamos con una evaluación funcional online, para ver desde dónde partís. Con eso te armo una planificación de fuerza totalmente personalizada, para entrenar 2 o 3 veces por semana.","on_screen":"Evaluación funcional online"},{"section":"Desarrollo","time":"","voice":"Vos me vas mandando videos entrenando y yo te voy siguiendo y corrigiendo. Y cualquier duda que tengas, me escribís por WhatsApp.","on_screen":"Seguimiento real, ejercicio por ejercicio"},{"section":"Cierre / CTA","time":"","voice":"Te acompaño en todo el proceso. Escribime y arrancamos con tu evaluación.","on_screen":"Escribinos 👉 link en bio"}]$j$,
 '[]',
 'Desde cualquier provincia o país, escribinos y empezá con tu evaluación 👉 link en bio',
 'Escribinos y empezá con tu evaluación (link en bio).', null, null, null, null, null, 'a0000000-0000-4000-8000-000000000001'),
-- 3. Post 10/11
('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', pg_temp.t('c0000000-0000-4000-8000-000000000001','post'),
 pg_temp.ar('2026-11-10 18:00'), 'publicado', pg_temp.p('c0000000-0000-4000-8000-000000000001','Educativo'), null, 'mixto', null,
 'Post técnico: Peso muerto (despegue) y sus variantes',
 'Educar técnicas de ejercicios.',
 '{"ratio":"4:5"}',
 'Carrusel o foto con pasos del ejercicio: postura, movimiento.' || chr(10) || 'Cierre: "¿No sabés cuál es la mejor variante para vos? Eso lo vemos en tu evaluación funcional. Te esperamos en Roma."',
 '[]', '[]', '[]',
 'PESO MUERTO, el ejercicio que parece simple, pero la técnica lo cambia todo.' || chr(10) || chr(10) || 'La técnica no se improvisa. Te mostramos cómo la trabajamos en Roma 👇' || chr(10) || chr(10) || '(deslizá para ver la técnica completa)',
 '¿No sabés cuál es la mejor variante para vos? Te esperamos en tu evaluación funcional.', 'Fotos del ejercicio paso a paso (postura inicial, despegue, bloqueo).', '2026-11-06', pg_temp.ar('2026-11-06 18:00'), null, null, 'a0000000-0000-4000-8000-000000000001'),
-- 4. Reel 12/11
('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', pg_temp.t('c0000000-0000-4000-8000-000000000001','reel'),
 pg_temp.ar('2026-11-12 19:00'), 'publicado', pg_temp.p('c0000000-0000-4000-8000-000000000001','Servicio online'), null, 'cliente', null,
 'Rutina de 10 minutos para hacer en casa',
 'Conecta con los planes online: quien no puede venir igual se lleva algo de Roma.',
 '{"ratio":"9:16","duration":"40 s","on_screen_text":"Nombre del ejercicio + tiempo"}',
 '- Formato vertical, mostrando pocos ejercicios simples para poder hacer en casa.' || chr(10) || '- 5 ejercicios sin elementos, mostrados uno a uno con el nombre y el tiempo en pantalla.' || chr(10) || '- Explicar brevemente técnica y minutos de ejercicio.' || chr(10) || '- Duración 40 segundos.',
 $j$[{"text":"Ejercicio 1 (plano entero, de costado)","done":true},{"text":"Ejercicio 2","done":true},{"text":"Ejercicio 3","done":true},{"text":"Ejercicio 4","done":true},{"text":"Ejercicio 5","done":true}]$j$,
 '[]', '[]',
 'Guardalo para cuando no tengas excusas. ¿Querés una rutina pensada para vos? Escribinos por DM.',
 'Escribinos por DM.', null, null, null, null, null, 'a0000000-0000-4000-8000-000000000001'),
-- 5. Post 17/11
('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', pg_temp.t('c0000000-0000-4000-8000-000000000001','post'),
 pg_temp.ar('2026-11-17 18:00'), 'publicado', pg_temp.p('c0000000-0000-4000-8000-000000000001','Comunidad'), null, 'tana', 'Diseño: Tana Studio',
 'Roma, según quienes entrenan acá',
 'Mostrar cómo siente su comunidad a Roma, a partir de las respuestas de los alumnos en la sección de historias ("definí Roma en una palabra").',
 '{"ratio":"4:5"}',
 'Diseño a cargo de Tana Studio a partir de las capturas.',
 '[]', '[]', '[]',
 'No lo decimos nosotros, lo dicen ustedes. 🤍 Gracias por cada palabra. Si todavía no viniste, escribinos por DM y sumate a ROMA.',
 'Escribinos por DM y sumate a ROMA.',
 'Capturas de pantalla con las respuestas en la caja de preguntas de la historia del mes de octubre.', '2026-11-12', pg_temp.ar('2026-11-11 20:30'), null, null, 'a0000000-0000-4000-8000-000000000001'),
-- 6. Reel 19/11 · Testimonios reales
('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', pg_temp.t('c0000000-0000-4000-8000-000000000001','reel'),
 pg_temp.ar('2026-11-19 19:00'), 'publicado', pg_temp.p('c0000000-0000-4000-8000-000000000001','Cercanía'), 'd0000000-0000-4000-8000-000000000001', 'cliente', null,
 'Testimonios reales de alumnos',
 'Pilar de cercanía: con este tipo de contenido transmitimos cercanía, emoción y experiencia.',
 '{"ratio":"9:16","duration":"30–60 s"}',
 '- Grabar a cada alumno entrevistado (mensualmente) en el mismo espacio del gimnasio.' || chr(10) || '- Grabar con la cámara en modo cine, en un plano medio.',
 $j$[{"text":"Plano medio del alumno respondiendo (modo cine)","done":true},{"text":"Tomas de apoyo del alumno entrenando","done":true}]$j$,
 $j$[{"section":"Pregunta 1","time":"","voice":"¿Cómo te llamás?","on_screen":"[Nombre]"},{"section":"Pregunta 2","time":"","voice":"¿Por qué empezaste?","on_screen":""},{"section":"Pregunta 3","time":"","voice":"¿Cómo te sentís hoy?","on_screen":""}]$j$,
 '[]',
 '[Nombre] empezó en Roma porque [motivo, en sus palabras]. Hoy nos cuenta cómo se siente.' || chr(10) || 'Cada proceso es distinto, y acompañarlos es lo que más nos gusta.',
 null, null, null, null,
 'SECCIÓN TESTIMONIOS REALES. Este reel es un contenido de sección mensual. La idea es grabar un testimonio diferente por mes y compartirlo siempre como reel en el perfil.',
 null, 'a0000000-0000-4000-8000-000000000001'),
-- 7. Carrusel 24/11
('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', pg_temp.t('c0000000-0000-4000-8000-000000000001','carrusel'),
 pg_temp.ar('2026-11-24 18:00'), 'publicado', pg_temp.p('c0000000-0000-4000-8000-000000000001','Comunidad'), null, 'mixto', null,
 'Las excusas que nos decimos todos antes de entrenar',
 'Eliminar las barreras que frenan a quienes todavía no se animaron a entrenar.',
 '{"ratio":"4:5","slides":4}',
 'Carrusel con slides mostrando notificación de celular y debajo una foto real del gimnasio.',
 '[]', '[]',
 $j$[{"text":"\"No tengo tiempo.\" → \"Abrimos desde las 7AM hasta la noche. Hay un turno para vos.\""},{"text":"\"Mañana empiezo.\" → \"Mañana también estamos. Pero hoy también.\""},{"text":"\"Ya estoy grande para esto.\" → \"Acá cada uno arranca a su ritmo.\""},{"text":"\"No sé qué hacer.\" → \"Para eso están los profes. Te acompañan en cada paso.\""}]$j$,
 'Todos tuvimos una excusa alguna vez. En ROMA tenemos una respuesta para cada una.' || chr(10) || 'Escribinos por DM y sumate!',
 'Escribinos por DM y sumate.', 'Fotos reales del gimnasio (4, una por placa).', '2026-11-20', pg_temp.ar('2026-11-19 22:10'), null, null, 'a0000000-0000-4000-8000-000000000001'),
-- 8. Reel 26/11 · Un mate con los profes
('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', pg_temp.t('c0000000-0000-4000-8000-000000000001','reel'),
 pg_temp.ar('2026-11-26 19:00'), 'en_produccion', pg_temp.p('c0000000-0000-4000-8000-000000000001','Cercanía'), 'd0000000-0000-4000-8000-000000000002', 'cliente', 'Equipo de Roma',
 'Un mate con los profes',
 'Humanizar la marca y que la gente conozca a los profes antes de pisar el centro. Generar cercanía y confianza, sobre todo en quien nunca entrenó o le da vergüenza arrancar.',
 '{"ratio":"9:16","duration":"30–45 s (cierre entre 42 y 55 s)","audio":"Sin música del gym; micrófonos corbateros"}',
 '- Formato vertical 9:16. Duración final de 30 a 45 segundos.' || chr(10) || '- Locación dentro de Roma, con equipamiento de fondo desenfocado y luz cálida o natural.' || chr(10) || '- Micrófonos corbateros en los dos y música del gym apagada.' || chr(10) || '- Formato relajado: un chico ceba y pregunta, el profe responde corto y espontáneo. El mate va y viene con cada pregunta.',
 $j$[{"text":"Plano de los dos con el mate (apertura)","done":false},{"text":"Plano medio del profe respondiendo","done":false},{"text":"Detalle del mate pasando de mano en mano","done":false},{"text":"Cierre: profe mirando a cámara","done":false}]$j$,
 $j$[{"section":"Gancho","time":"0–3 s","voice":"\"Contanos quién sos.\" — Profe: \"Soy [Nombre], profe en Roma hace [X] años.\"","on_screen":"Conocé a los profes de Roma: [Nombre]"},{"section":"Desarrollo","time":"","voice":"\"¿Cómo llegaste al entrenamiento?\" (respuesta breve: si fue deportista, qué estudió, qué lo hizo elegir esto). \"¿En qué te especializás?\" (fuerza, rehabilitación, adultos mayores, principiantes, etc.).","on_screen":""},{"section":"Desarrollo · Cómo trabaja","time":"","voice":"\"¿Qué es lo primero que hacés cuando llega alguien nuevo?\" / \"¿Qué es lo que más te gusta de este trabajo?\" — preguntas centrales: muestran criterio profesional y generan confianza.","on_screen":""},{"section":"Ping pong","time":"","voice":"Con pase de mate en cada una: ¿Dulce o amargo? / ¿Ejercicio favorito? / ¿Mañana o noche para entrenar?","on_screen":""},{"section":"Cierre / CTA","time":"42–55 s","voice":"\"Si alguien está dudando en arrancar, ¿qué le dirías?\" (profe responde mirando a cámara). \"Gracias, [Nombre].\"","on_screen":"Conocé al equipo · Roma Centro de Entrenamiento"}]$j$,
 '[]',
 'Un mate con los profes 🧉' || chr(10) || 'Antes de venir a entrenar, conocé a quién te va a acompañar. Hoy le toca a [Nombre del profe], con preguntas rápidas y respuestas sin pensar.' || chr(10) || '¿Qué le preguntarías vos? Dejalo en comentarios y se lo hacemos en el próximo mate.',
 '¿Qué le preguntarías vos? Dejalo en comentarios.',
 'Video grabado (crudo) del mate con el profe.', '2026-11-25', null, null, null, 'a0000000-0000-4000-8000-000000000001');

-- Historias de Roma: lunes 10:00, martes 13:00, miércoles 18:00, viernes 19:00 (2 al 27/11) + lunes 30/11
insert into public.content_items (workspace_id, month_id, content_type_id, publish_at, status, production_owner, title, objective, format, template_slot_id, created_by)
select 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
  pg_temp.t('c0000000-0000-4000-8000-000000000001','historia'),
  (d::date + s.time) at time zone 'America/Argentina/Buenos_Aires',
  case when (d::date + s.time) at time zone 'America/Argentina/Buenos_Aires' < pg_temp.ar('2026-11-24 15:00') then 'publicado'::public.content_status else 'aprobado'::public.content_status end,
  'cliente', s.title_default,
  coalesce(s.story_template ->> 'objective', '') ||
    case when s.story_template ? 'example' then chr(10) || 'Por ejemplo: ' || (s.story_template ->> 'example') else '' end,
  jsonb_build_object('ratio', '9:16', 'on_screen_text', s.story_template ->> 'format'),
  s.id, 'a0000000-0000-4000-8000-000000000001'
from generate_series('2026-11-02'::date, '2026-11-30'::date, interval '1 day') d
join public.template_slots s on s.workspace_id = 'c0000000-0000-4000-8000-000000000001'
  and s.weekday = extract(isodow from d)::int
  and s.content_type_id = pg_temp.t('c0000000-0000-4000-8000-000000000001','historia')
where d::date <= '2026-11-27' or (d::date = '2026-11-30' and s.weekday = 1);

-- =====================================================================
-- LAS POPAS · Noviembre 2026
-- =====================================================================
insert into public.content_items (workspace_id, month_id, content_type_id, publish_at, status, pillar_id,
  production_owner, title, objective, format, clarifications, created_by)
values
('c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', pg_temp.t('c0000000-0000-4000-8000-000000000002','post'),
 pg_temp.ar('2026-11-11 19:00'), 'publicado', null, 'tana', 'Post (a completar)', null, '{"ratio":"4:5"}', null, 'a0000000-0000-4000-8000-000000000001'),
('c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', pg_temp.t('c0000000-0000-4000-8000-000000000002','reel'),
 pg_temp.ar('2026-11-13 20:00'), 'publicado', null, 'tana', 'Reel (a completar)', null, '{"ratio":"9:16"}', null, 'a0000000-0000-4000-8000-000000000001'),
('c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', pg_temp.t('c0000000-0000-4000-8000-000000000002','post'),
 pg_temp.ar('2026-11-16 19:00'), 'publicado', pg_temp.p('c0000000-0000-4000-8000-000000000002','Marca / identidad'), 'tana',
 'Presentación de la etiqueta de Las Popas como elemento de identidad',
 'Fortalecer el reconocimiento de marca, acercar a la comunidad a su identidad y generar una conexión más personal, poniendo en valor el detrás de escena y los detalles que hacen a Las Popas.',
 '{"ratio":"4:5"}', null, 'a0000000-0000-4000-8000-000000000001'),
('c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', pg_temp.t('c0000000-0000-4000-8000-000000000002','carrusel'),
 pg_temp.ar('2026-11-20 19:00'), 'listo', pg_temp.p('c0000000-0000-4000-8000-000000000002','Producto y detalle'), 'tana',
 'Carrusel de foto producto y detalle de la prenda',
 'Dar mayor visibilidad a prendas puntuales de la colección, destacar sus detalles y generar interés en el producto a través de una presentación visual editorial y detallada.',
 '{"ratio":"4:5","slides":6}',
 'Tres prendas seleccionadas. Cada una se presenta a través de una fotografía general y otra imagen que permite apreciar sus detalles, texturas, terminaciones y características.',
 'a0000000-0000-4000-8000-000000000001'),
('c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', pg_temp.t('c0000000-0000-4000-8000-000000000002','post'),
 pg_temp.ar('2026-11-23 19:00'), 'publicado', pg_temp.p('c0000000-0000-4000-8000-000000000002','Marca / identidad'), 'tana',
 'Pieza gráfica de impacto visual',
 'Generar un corte visual dentro del feed, aportar dinamismo a la comunicación y reforzar la identidad de marca sin perder coherencia estética.',
 '{"ratio":"4:5"}',
 'Fondo liso azul con una frase breve que rompa con la estética habitual de la grilla, alternando las fotografías de producto y modelo con una composición más conceptual y editorial.',
 'a0000000-0000-4000-8000-000000000001'),
('c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', pg_temp.t('c0000000-0000-4000-8000-000000000002','reel'),
 pg_temp.ar('2026-11-27 20:00'), 'para_revisar', pg_temp.p('c0000000-0000-4000-8000-000000000002','Producto y detalle'), 'tana',
 'De la foto al cuerpo',
 'Mostrar cómo queda puesta cada prenda y cómo se mueve el lino, para que quien compra online pueda imaginársela sin probarla.',
 '{"ratio":"9:16","duration":"20–30 s"}',
 'Haciendo énfasis en los productos estrella, a los que más buscamos darles foco.',
 'a0000000-0000-4000-8000-000000000001'),
('c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', pg_temp.t('c0000000-0000-4000-8000-000000000002','carrusel'),
 pg_temp.ar('2026-11-30 19:00'), 'para_revisar', pg_temp.p('c0000000-0000-4000-8000-000000000002','Marca / identidad'), 'tana',
 'Carrusel conceptual tipo collage del mes',
 'Cerrar el año con una pieza de impacto visual que eleve la percepción de marca en la grilla, presente la colección desde una mirada más editorial y personal, y refuerce la identidad sin caer en una comunicación promocional.',
 '{"ratio":"4:5"}',
 'Fotos de la modelo y de producto tratadas como copias analógicas, con borde de película, superpuestas sobre fondo crema e intervenidas con frases breves con tipografía escrita a mano. Una composición editorial que se aleja de la foto de producto tradicional.',
 'a0000000-0000-4000-8000-000000000001'),
('c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000003', pg_temp.t('c0000000-0000-4000-8000-000000000002','post'),
 pg_temp.ar('2026-12-02 19:00'), 'idea', null, 'tana', 'Post (a completar)', null, '{"ratio":"4:5"}', null, 'a0000000-0000-4000-8000-000000000001');

-- Detalle de guion/tomas para el reel "De la foto al cuerpo"
update public.content_items set
  recording_instructions = 'Cada prenda aparece primero en su foto de producto, fija, y con un corte pasa al clip de la modelo usándola en movimiento. Se repite con 3 o 4 prendas.',
  shot_list = $j$[{"text":"Foto de producto fija de cada prenda (3 o 4)","done":false},{"text":"Clip de la modelo con cada prenda, en movimiento (caminar, girar)","done":false},{"text":"Detalle del lino moviéndose con luz natural","done":false}]$j$
where workspace_id = 'c0000000-0000-4000-8000-000000000002' and title = 'De la foto al cuerpo';

-- Historias de Las Popas: lunes a viernes 12:00 (9 al 30/11)
insert into public.content_items (workspace_id, month_id, content_type_id, publish_at, status, production_owner, title, objective, format, template_slot_id, created_by)
select 'c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002',
  pg_temp.t('c0000000-0000-4000-8000-000000000002','historia'),
  (d::date + s.time) at time zone 'America/Argentina/Buenos_Aires',
  case when d::date < '2026-11-24' then 'publicado'::public.content_status else 'aprobado'::public.content_status end,
  'tana', s.title_default, s.story_template ->> 'objective', '{"ratio":"9:16"}', s.id, 'a0000000-0000-4000-8000-000000000001'
from generate_series('2026-11-09'::date, '2026-11-30'::date, interval '1 day') d
join public.template_slots s on s.workspace_id = 'c0000000-0000-4000-8000-000000000002'
  and s.weekday = extract(isodow from d)::int
  and s.content_type_id = pg_temp.t('c0000000-0000-4000-8000-000000000002','historia');

-- Notas internas de ejemplo (NUNCA visibles para el cliente)
insert into public.content_internal (content_item_id, workspace_id, internal_notes)
select id, workspace_id, 'Confirmar con Román qué profe graba esta semana. Si no llegan con el material el 25, pasar a la semana próxima y subir el carrusel de backup.'
from public.content_items where title = 'Un mate con los profes';
insert into public.content_internal (content_item_id, workspace_id, internal_notes)
select id, workspace_id, 'Se demoró la entrega de fotos de detalle. Publicar apenas lleguen.'
from public.content_items where title = 'Carrusel de foto producto y detalle de la prenda';

-- Comentarios y aprobaciones de ejemplo
insert into public.comments (content_item_id, workspace_id, author_id, body, kind, created_at)
select id, workspace_id, 'b0000000-0000-4000-8000-000000000001',
  'Genial! Lo grabamos el miércoles con el profe Nico. ¿Les sirve que el mate sea con termo y todo?', 'comment', pg_temp.ar('2026-11-23 20:10')
from public.content_items where title = 'Un mate con los profes';
insert into public.comments (content_item_id, workspace_id, author_id, body, kind, created_at)
select id, workspace_id, 'a0000000-0000-4000-8000-000000000001',
  '¡Sí! Con termo queda bárbaro, suma a la idea de charla relajada. 🧉', 'comment', pg_temp.ar('2026-11-23 21:00')
from public.content_items where title = 'Un mate con los profes';
insert into public.approvals (workspace_id, month_id, user_id, action, created_at) values
('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'aprobado', pg_temp.ar('2026-10-29 21:14'));

-- =====================================================================
-- Servicios y presupuesto (PRECIOS FICTICIOS — reemplazar)
-- =====================================================================
insert into public.services (id, name, description, includes, excludes, default_price, billing) values
('f0000000-0000-4000-8000-000000000001', 'Planificación mensual de contenidos',
 'Estrategia, ideas, calendario, guiones, copies e indicaciones de grabación para todo el mes.',
 array['Calendario mensual en el portal','Ideas, objetivos y copies de cada pieza','Guiones e indicaciones de grabación','Historias planificadas','2 rondas de cambios por pieza'],
 array['Grabación en el lugar','Pauta publicitaria','Respuesta de mensajes y comentarios'], 180000, 'mensual'),
('f0000000-0000-4000-8000-000000000002', 'Dirección de contenido y arte',
 'Dirección creativa de las piezas: estética, referencias, composición y coherencia de la grilla.',
 array['Dirección de arte de cada pieza','Referencias visuales','Revisión de material antes de publicar'], array['Producción de fotos o video'], 120000, 'mensual'),
('f0000000-0000-4000-8000-000000000003', 'Diseño de piezas gráficas',
 'Diseño de posts, carruseles y placas para historias con la identidad de la marca.',
 array['Diseño de posts y carruseles del mes','Placas para historias','Adaptaciones de formato'], array['Sesión de fotos'], 90000, 'mensual'),
('f0000000-0000-4000-8000-000000000004', 'Edición de reels', 'Edición del material grabado por el cliente: cortes, subtítulos, música y textos.',
 array['Edición con subtítulos','Música con licencia','1 ronda de cambios'], array['Grabación'], 25000, 'por_pieza'),
('f0000000-0000-4000-8000-000000000005', 'Gestión de comunidad', 'Respuesta de comentarios y mensajes en horario hábil.',
 array['Respuestas de lunes a viernes','Reporte mensual de consultas'], array['Atención fines de semana'], 110000, 'mensual'),
('f0000000-0000-4000-8000-000000000006', 'Identidad visual', 'Diseño de logo, paleta, tipografías y manual de marca.',
 array['Logo y variantes','Paleta y tipografías','Manual de marca en PDF'], array['Impresión'], 450000, 'unico'),
('f0000000-0000-4000-8000-000000000007', 'Sesión de fotos de producto', 'Sesión de fotos de producto y modelo con dirección de arte.',
 array['Hasta 30 fotos editadas','Dirección de arte'], array['Contratación de modelo','Alquiler de locación'], 150000, 'unico');

insert into public.workspace_services (workspace_id, service_id, custom_name, description, includes, excludes, price, billing, status, start_date, due_day, conditions) values
('c0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', null,
 'Planificación, dirección creativa e indicaciones de grabación. La producción audiovisual en el lugar la hace el equipo de Roma.',
 array['4 posts/carruseles con indicaciones y copy','4 reels con guion e indicaciones de grabación','16 historias planificadas (4 por semana)','Diseño de las piezas gráficas del feed','2 rondas de cambios por pieza'],
 array['Grabación en el gimnasio','Edición de reels (servicio aparte)','Pauta publicitaria','Respuesta de mensajes'],
 180000, 'mensual', 'activo', '2026-09-01', 24, 'Se paga el día 24 de cada mes. Precio actualizable cada 3 meses.'),
('c0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000004', null, null,
 array['Edición con subtítulos','Música con licencia','1 ronda de cambios'], array['Grabación'],
 25000, 'por_pieza', 'propuesto', null, null, 'Se puede sumar cuando quieran: se cobra por reel editado.'),
('c0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000005', null, null,
 array['Respuestas de lunes a viernes','Reporte mensual de consultas'], array['Atención fines de semana'],
 110000, 'mensual', 'inactivo', null, 24, null),
('c0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'Planificación y dirección de contenido',
 'Ideas, objetivos, dirección de arte y aclaraciones de cada pieza del mes.',
 array['6 a 8 posts por mes','2 reels por mes (cada 15 días)','5 historias por semana planificadas','Dirección de arte','2 rondas de cambios por pieza'],
 array['Sesión de fotos','Contratación de modelo','Pauta publicitaria'],
 160000, 'mensual', 'activo', '2026-09-14', 2, 'Se paga el día 2 de cada mes.'),
('c0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003', null, null,
 array['Diseño de posts y carruseles del mes','Placas para historias'], array['Sesión de fotos'],
 60000, 'mensual', 'activo', '2026-10-01', 2, null),
('c0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000007', null, 'Ideal para la colección de verano.',
 array['Hasta 30 fotos editadas','Dirección de arte'], array['Contratación de modelo','Alquiler de locación'],
 150000, 'unico', 'propuesto', null, null, null),
('c0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000006', null, 'Realizada en 2026.',
 array['Logo y variantes','Paleta y tipografías','Manual de marca'], array[]::text[],
 450000, 'unico', 'inactivo', '2026-03-01', null, null);

-- Cuotas: octubre (pagada), noviembre (Roma pagada / Las Popas vencida), diciembre (pendiente)
insert into public.invoices (workspace_id, period, items, amount, due_date, paid_at, method, auto_generated) values
('c0000000-0000-4000-8000-000000000001', '2026-10-01', '[{"name":"Planificación mensual de contenidos","amount":180000}]', 180000, '2026-10-24', pg_temp.ar('2026-10-22 11:00'), 'Transferencia', true),
('c0000000-0000-4000-8000-000000000001', '2026-11-01', '[{"name":"Planificación mensual de contenidos","amount":180000}]', 180000, '2026-11-24', pg_temp.ar('2026-11-20 16:20'), 'Transferencia', true),
('c0000000-0000-4000-8000-000000000001', '2026-12-01', '[{"name":"Planificación mensual de contenidos","amount":180000}]', 180000, '2026-12-24', null, null, true),
('c0000000-0000-4000-8000-000000000002', '2026-10-01', '[{"name":"Planificación y dirección de contenido","amount":160000},{"name":"Diseño de piezas gráficas","amount":60000}]', 220000, '2026-10-02', pg_temp.ar('2026-10-01 10:00'), 'Mercado Pago', true),
('c0000000-0000-4000-8000-000000000002', '2026-11-01', '[{"name":"Planificación y dirección de contenido","amount":160000},{"name":"Diseño de piezas gráficas","amount":60000}]', 220000, '2026-11-02', null, null, true),
('c0000000-0000-4000-8000-000000000002', '2026-12-01', '[{"name":"Planificación y dirección de contenido","amount":160000},{"name":"Diseño de piezas gráficas","amount":60000}]', 220000, '2026-12-02', null, null, true);

-- Ideas y plantillas de pieza
insert into public.idea_bank (workspace_id, title, notes, pillar_id, content_type_id) values
('c0000000-0000-4000-8000-000000000001', 'Errores comunes en la sentadilla', 'Carrusel técnico, mismo formato que peso muerto.', pg_temp.p('c0000000-0000-4000-8000-000000000001','Educativo'), pg_temp.t('c0000000-0000-4000-8000-000000000001','carrusel')),
('c0000000-0000-4000-8000-000000000001', 'Alumno online desde otra provincia', 'Testimonio del plan online (videollamada o video del alumno).', pg_temp.p('c0000000-0000-4000-8000-000000000001','Servicio online'), pg_temp.t('c0000000-0000-4000-8000-000000000001','reel')),
('c0000000-0000-4000-8000-000000000002', 'Cómo cuidar el lino', 'Carrusel educativo: lavado, planchado, guardado.', pg_temp.p('c0000000-0000-4000-8000-000000000002','Producto y detalle'), pg_temp.t('c0000000-0000-4000-8000-000000000002','carrusel')),
('c0000000-0000-4000-8000-000000000002', 'Regalos para las fiestas', 'Selección de prendas para regalar + CTA a la tienda.', pg_temp.p('c0000000-0000-4000-8000-000000000002','Venta'), pg_temp.t('c0000000-0000-4000-8000-000000000002','post'));

insert into public.piece_templates (workspace_id, name, content_type_key, data) values
(null, 'Reel testimonio', 'reel', $j${"title":"Testimonio real","objective":"Transmitir cercanía, emoción y experiencia.","format":{"ratio":"9:16","duration":"30–60 s"},"recording_instructions":"- Plano medio, cámara en modo cine.\n- Siempre en el mismo espacio.\n- Luz de frente.","script":[{"section":"Pregunta 1","voice":"¿Cómo te llamás?","on_screen":"[Nombre]","time":""},{"section":"Pregunta 2","voice":"¿Por qué empezaste?","on_screen":"","time":""},{"section":"Pregunta 3","voice":"¿Cómo te sentís hoy?","on_screen":"","time":""}]}$j$),
(null, 'Carrusel técnico de ejercicio', 'carrusel', $j${"title":"Post técnico: [ejercicio]","objective":"Educar técnicas de ejercicios.","format":{"ratio":"4:5","slides":5},"slides":[{"text":"Portada: nombre del ejercicio + gancho"},{"text":"Postura inicial"},{"text":"Movimiento"},{"text":"Errores comunes"},{"text":"CTA: evaluación funcional"}]}$j$),
(null, 'Reel con guion a cámara', 'reel', $j${"format":{"ratio":"9:16","duration":"30–45 s"},"recording_instructions":"- Celular vertical, a la altura de los ojos.\n- De frente a la luz.\n- Fondo con el espacio de la marca.","script":[{"section":"Gancho","time":"0–3 s","voice":"","on_screen":""},{"section":"Desarrollo","time":"","voice":"","on_screen":""},{"section":"Cierre / CTA","time":"","voice":"","on_screen":""}]}$j$);

-- Actividad inicial
insert into public.activity_log (workspace_id, actor_id, entity, entity_id, action, summary, created_at) values
('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'month', 'e0000000-0000-4000-8000-000000000001', 'month_approved', 'Mes aprobado completo (11/2026)', pg_temp.ar('2026-10-29 21:14')),
('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'month', 'e0000000-0000-4000-8000-000000000002', 'month_sent', 'Calendario de noviembre enviado para revisar', pg_temp.ar('2026-11-05 10:00'));

-- Notificaciones de ejemplo
insert into public.notifications (user_id, workspace_id, type, title, body, link, created_at) values
('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'comentario', 'Comentario nuevo del cliente',
 'Reel del 26/11 · "Un mate con los profes": Genial! Lo grabamos el miércoles…', '/clientes/roma/calendario', pg_temp.ar('2026-11-23 20:10')),
('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'para_revisar', 'Tenés piezas para revisar',
 'Reel del 27/11 y carrusel del 30/11', '/portal/las-popas', pg_temp.ar('2026-11-21 10:00'));

set session_replication_role = origin;
