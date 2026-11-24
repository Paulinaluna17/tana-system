# Tana Studio · Sistema de contenidos y presupuestos

Web app propia de Tana Studio para planificar el contenido mensual de cada cliente, que el cliente lo vea siempre actualizado (con su propia identidad visual), apruebe o pida cambios, y tenga clarísimo qué servicios tiene y cuándo paga.

- **Panel de Tana** (`/inicio`): resumen de todos los clientes, alertas, calendario con arrastrar y soltar, ficha completa de cada pieza, plantillas, ideas, presupuesto, usuarios y actividad.
- **Portal del cliente** (`/portal/<cliente>`): “Pendiente de vos”, “Esta semana”, calendario, ficha de cada pieza (con modo grabación), presupuesto con semáforo, novedades y guía “Cómo leer este calendario”.
- **Link público de solo lectura** (`/compartir/<token>`) para mandar por WhatsApp.
- **PDF** del mes (`/imprimir/<cliente>/<año>/<mes>`) y del presupuesto.

---

## Índice

1. [Qué hay adentro](#1-qué-hay-adentro)
2. [Probarlo en tu compu (local)](#2-probarlo-en-tu-compu-local)
3. [Publicarlo en internet (producción)](#3-publicarlo-en-internet-producción)
4. [Uso diario](#4-uso-diario)
5. [Agregar un cliente nuevo](#5-agregar-un-cliente-nuevo)
6. [Cambiar precios y servicios](#6-cambiar-precios-y-servicios)
7. [Preguntas frecuentes](#7-preguntas-frecuentes)
8. [Para quien programe](#8-para-quien-programe)
9. [Supuestos y decisiones](#9-supuestos-y-decisiones)

---

## 1. Qué hay adentro

| Parte | Tecnología |
|---|---|
| Web | Next.js 15 (App Router) + TypeScript + Tailwind (componentes estilo shadcn/ui) |
| Base de datos, usuarios y archivos | Supabase (Postgres + Auth + Storage + Realtime) |
| Seguridad | Row Level Security: cada cliente solo ve lo suyo; las notas internas viven en una tabla que solo ve Tana |
| Emails (opcional) | Resend + React Email |
| Tareas automáticas | Vercel Cron (1 vez por día) |
| Tests | Vitest (lógica + seguridad) y Playwright (flujos completos) |

Datos de ejemplo incluidos: **Roma · Centro de Entrenamiento** y **Las Popas** con todo noviembre 2026 (piezas, guiones, indicaciones, historias, servicios y cuotas).

---

## 2. Probarlo en tu compu (local)

Necesitás: [Node.js 20+](https://nodejs.org) y [Docker Desktop](https://www.docker.com/products/docker-desktop/) abierto.

```bash
npm install
```

```bash
npx supabase start
```

(La primera vez tarda porque descarga Supabase. Al final muestra unas claves.)

```bash
cp .env.example .env.local
```

Abrí `.env.local` y pegá los valores que mostró `supabase start`:
- `NEXT_PUBLIC_SUPABASE_URL` = `API URL` (ej. `http://127.0.0.1:54321`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `anon key`
- `SUPABASE_SERVICE_ROLE_KEY` = `service_role key`
- `APP_URL=http://localhost:3000`

Cargá la base con los datos de ejemplo:

```bash
npx supabase db reset
```

Levantá la app:

```bash
npm run dev
```

Entrá a http://localhost:3000 con alguno de estos usuarios de prueba (contraseña **`tana1234`**, usando “Equipo de Tana: entrar con contraseña”):

| Usuario | Qué ve |
|---|---|
| `socia1@tana.studio` / `socia2@tana.studio` | Panel completo de Tana |
| `roma@ejemplo.com` | Solo el portal de Roma |
| `laspopas@ejemplo.com` | Solo el portal de Las Popas |

Los emails locales (magic links, avisos) se ven en http://127.0.0.1:54324 (Mailpit).

---

## 3. Publicarlo en internet (producción)

### 3.1 Supabase
1. Creá un proyecto en [supabase.com](https://supabase.com) (región São Paulo).
2. En *Project Settings → API* copiá `Project URL`, `anon public key` y `service_role key`.
3. Desde la carpeta del proyecto, conectá y subí la base:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref TU-PROJECT-REF
```

```bash
npx supabase db push --include-seed
```

(`--include-seed` carga Roma y Las Popas. Si querés arrancar vacío, sacalo.)

4. En *Authentication → URL Configuration*:
   - **Site URL**: la dirección de tu app (ej. `https://tana-studio.vercel.app`)
   - **Redirect URLs**: agregá `https://tana-studio.vercel.app/**`
5. **Recomendado** – en *Authentication → Email Templates → Magic Link* reemplazá el link por este (así el link funciona aunque el cliente abra el mail en otro celular o compu):

```
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/">Entrar al calendario</a>
```

6. *Authentication → Providers → Email*: dejá **desactivado** “Allow new users to sign up” (solo entra quien Tana invita).
7. Para que lleguen bien los mails, configurá un SMTP propio en *Authentication → SMTP* (por ejemplo el de Resend). El SMTP gratuito de Supabase tiene límites muy bajos.

### 3.2 Vercel
1. Subí el código a GitHub e importalo en [vercel.com](https://vercel.com) → *Add New Project*.
2. En *Environment Variables* cargá todo lo de `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_URL` = la URL final (ej. `https://tana-studio.vercel.app`)
   - `CRON_SECRET` = un texto largo y aleatorio
   - `TANA_ADMIN_EMAILS` = los emails reales de las dos socias, separados por coma
   - (opcional) `RESEND_API_KEY` y `EMAIL_FROM` (ej. `Tana Studio <hola@tudominio.com>`, dominio verificado en Resend)
3. Deploy. El cron diario ya está configurado en `vercel.json` (todos los días a las 8:00 de Argentina).

### 3.3 Cuentas reales
Con `.env.local` apuntando a la base de producción:

```bash
npm run setup:prod -- --borrar-demo
```

Esto crea las cuentas de las socias (las de `TANA_ADMIN_EMAILS`) y **borra los usuarios de prueba** (que tienen contraseña `tana1234`). Después, cada socia entra en `/login` con su email (le llega un link). Si quieren entrar con contraseña, la pueden definir desde Supabase (*Authentication → Users → Send password recovery*).

Para darle acceso a un cliente: desde la app, pestaña **Usuarios** del cliente (o por consola):

```bash
npm run setup:prod -- --cliente roma roman@gmail.com "Román"
```

---

## 4. Uso diario

### Planificar un mes
1. Cliente → **Calendario** → navegá al mes.
2. **Generar mes desde plantilla**: crea todas las fechas fijas (posts, reels e historias recurrentes) en los días correctos. También podés **Duplicar mes anterior**.
3. Hacé clic en cada pieza y completá la ficha: tema, objetivo, formato, indicaciones de grabación, tomas, guion, placas, copy, CTA, material que tiene que mandar el cliente, aclaraciones y notas internas 🔒.
4. Las piezas en **Idea** y **En redacción** no las ve el cliente. Cuando estén listas, pasalas a **Para revisar**.
5. **Enviar al cliente**: el mes pasa a “Enviado”, el cliente recibe un aviso y lo ve en su portal. Desde **Compartir** tenés el link del portal, el link público y el botón para mandarlo por WhatsApp.
6. **PDF**: si igual quieren una presentación, se genera con la misma estética (portada, cómo leerlo, grilla, una página por pieza, historias).

### Cambios en el calendario
- **Arrastrá** una pieza a otro día (conserva la hora). El cliente la ve movida al instante con la etiqueta **Actualizado**.
- **Cambiar por otra pieza**: la vieja queda como “Reemplazada” en el historial y se crea una nueva en la misma fecha.
- Todo cambio queda en el **Historial de cambios** (qué cambió, antes → después, quién y cuándo).

### Lo que puede hacer el cliente
Aprobar · Pedir cambios (con comentario obligatorio; se cuentan las rondas) · Mandar material (archivos o link) · Tildar tomas grabadas · Comentar · Aprobar todo el mes · Informar un pago con comprobante.

### El calendario es “vivo”
- Lo publicado y ya pasado aparece **tachado ✓**.
- Hoy está resaltado; la semana actual marcada; barra de avance del mes.
- Si la fecha pasó y no se publicó → **Atrasada** (en rojo) y aparece en tu Inicio.
- Si falta poco y no está aprobada → **Aprobación urgente**.

### Presupuesto y pagos
- Cada servicio muestra qué incluye, qué no, precio, modalidad y día de pago.
- Las cuotas mensuales se **generan solas** (cron diario) según los servicios activos.
- Semáforo automático: 🟢 Pagado · ⚪ Pendiente · 🟡 Por vencer (≤ 3 días) · 🔵 Informado (el cliente subió comprobante) · 🔴 Vencido.
- Cuando el cliente informa un pago, tocás **Confirmar pago** y pasa a verde (y se le avisa).
- **Recordatorio por WhatsApp** arma un mensaje amable listo para mandar.

### Avisos
Campanita en la app para todo. Si configuraron Resend, también por email: mes enviado, pieza actualizada, aprobación urgente, material pendiente, pago por vencer/vencido, y a Tana: comentarios, cambios pedidos, aprobaciones, material subido, pagos informados y piezas atrasadas. Los lunes, resumen semanal para el cliente.

---

## 5. Agregar un cliente nuevo

**Clientes → Nuevo cliente** (asistente de 5 pasos, sin tocar código):
1. Datos (nombre, rubro, contacto, WhatsApp, redes).
2. Identidad visual: logo, colores, tipografías, tema claro/oscuro (con vista previa y control de contraste).
3. Modelo de trabajo: quién produce, días de anticipación para aprobar, rondas de cambios, día límite de material.
4. Frecuencia: publicaciones fijas de la semana (incluye “cada 15 días”).
5. Servicios contratados / para ofrecer y personas con acceso.

Después: **Generar mes desde plantilla** y a planificar. En **Marca y ajustes** completás el brand book y la guía “Cómo leer este calendario”.

---

## 6. Cambiar precios y servicios

- **Servicios** (menú superior): el catálogo general de Tana (precio de referencia, qué incluye y qué no).
- En cada cliente → **Presupuesto y pagos** → **Editar** en el servicio: precio propio, estado (Activo, Pausado, Inactivo, Disponible para sumar), día de vencimiento y condiciones (ej. “se actualiza cada 3 meses”).
- Las cuotas ya generadas no cambian solas: si cambiás un precio a mitad de mes, editá la cuota con **Editar**.
- ⚠️ Los precios del seed son **ficticios**: reemplazalos antes de mostrarle el portal a los clientes.

---

## 7. Preguntas frecuentes

**¿Al cliente no le llega el link para entrar?**  Revisá spam. Si no aparece, en **Usuarios** tocá **Link de acceso** y mandáselo por WhatsApp (sirve una sola vez).

**¿El cliente puede ver las notas internas?**  No. Están en una tabla separada protegida por la base de datos (no solo ocultas en la pantalla). Los comentarios marcados como “nota interna” tampoco.

**¿Qué ve el cliente de un mes en borrador?**  Nada, hasta que lo envíes (o marques una pieza puntual como visible).

**¿Cómo veo lo que ve el cliente?**  Botón **Ver como cliente** (arriba a la derecha en cada cliente o pieza).

**¿Se puede usar desde el celular?**  Sí, todo está pensado primero para celular. En la ficha de una pieza, **Modo grabación** muestra indicaciones, tomas y guion en letra grande.

**¿Y si un cliente deja de trabajar con nosotras?**  **Marca y ajustes → Archivar cliente**. No se borra nada.

**¿Cuánto cuesta mantenerlo?**  Para 2–10 clientes entra en los planes gratuitos de Supabase, Vercel y Resend. (El plan gratuito de Supabase pausa proyectos sin uso por una semana: si eso pasa, se reactiva desde el panel.)

---

## 8. Para quien programe

```bash
npm run dev          # desarrollo
npm run build        # build de producción
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm test             # Vitest: lógica (fechas, semáforo, generación) + seguridad RLS contra Supabase local
npm run test:e2e     # Playwright: flujos completos (requiere `npx supabase db reset` antes)
```

Estructura:

```
app/(admin)/…              Panel de Tana (inicio, clientes/[slug]/…, servicios)
app/portal/[slug]/…        Portal del cliente
app/compartir/[token]      Vista pública de solo lectura
app/imprimir/…             Versiones para PDF
app/api/cron/daily         Cuotas, recordatorios, atrasadas, resumen semanal, emails
app/actions/*.ts           Server Actions (validadas con Zod + permisos + RLS)
components/                calendar/, piece/, portal/, budget/, admin/, ui/
lib/dates.ts               Fechas SIEMPRE en hora de Argentina (date-fns-tz)
lib/status.ts              Estados de piezas y semáforo de cuotas (misma regla que la función SQL invoice_status)
lib/generate.ts            Generación del mes desde la plantilla
lib/billing.ts             Armado de la cuota mensual
lib/ai/                    Punto de extensión para un asistente de IA (no activo)
supabase/migrations/       Esquema, funciones, triggers, RLS y Storage
supabase/seed.sql          Datos de Roma y Las Popas (noviembre 2026)
```

Seguridad, en corto:
- RLS en todas las tablas. Tana (`profiles.is_tana_admin`) ve todo; los miembros solo su `workspace_id`.
- El cliente **no puede escribir** piezas, cuotas ni perfiles directamente: sus acciones pasan por funciones SQL `SECURITY DEFINER` (`client_approve_item`, `client_request_changes`, `client_mark_material_sent`, `client_toggle_shot`, `client_approve_month`, `client_report_payment`) que validan permisos.
- Historial de versiones, “Actualizado” y log de actividad se generan con triggers en la base (no se pueden saltear).
- `SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor (cron, invitaciones, emails).
- El cron exige `Authorization: Bearer CRON_SECRET`.

---

## 9. Supuestos y decisiones

- **Next.js 15** (en vez de 14): es la versión estable actual del App Router; mismo modelo.
- **Componentes “estilo shadcn/ui” escritos dentro del proyecto** (Radix + Tailwind + cva) para que tomen la identidad de cada cliente vía variables CSS.
- **PDF por impresión del navegador** (CSS `@media print`, A4 apaisado) en vez de `@react-pdf/renderer`: respeta exactamente el diseño, tipografías y logos de cada marca.
- **Alta de usuarios**: Tana crea el acceso y el cliente entra con su email (magic link). Se evitan los links de “invitación” porque fallan si se abren en otro dispositivo; para eso está también el botón “Link de acceso”.
- **Emails**: las notificaciones siempre quedan en la app; por email salen al momento (después de cada acción) y en el cron diario, solo si hay `RESEND_API_KEY`.
- **Correcciones respecto de las presentaciones originales**: Roma no tiene “31 de noviembre”; la frecuencia dice “noviembre”; el reel “Un mate con los profes” es el jueves 26; las historias de Roma van lunes 10:00, martes 13:00, miércoles 18:00 y viernes 19:00 (como en la slide de historias). Las Popas: posts lunes y miércoles 19:00, reel viernes 20:00 cada 15 días (13 y 27 de noviembre).
- Las Popas: el post del miércoles 11, el reel del viernes 13 y el post del miércoles 2/12 quedaron como “a completar” porque no tenían contenido en el PDF. Sus historias tienen hora por defecto 12:00 (editable).
- Estados del seed pensados para mostrar todo funcionando “hoy” (24/11/2026): hay una pieza atrasada (carrusel del 20/11 de Las Popas), una cuota vencida (noviembre de Las Popas) y piezas para revisar.
- Fuera de alcance (arquitectura preparada): publicación automática en Instagram, métricas automáticas (hay campos manuales de alcance/guardados/comentarios), facturación AFIP / cobro con Mercado Pago (hay campo “link de pago”) y asistente con IA (`lib/ai/`).
