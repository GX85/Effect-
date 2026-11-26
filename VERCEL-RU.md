# Focus — публикация на Vercel

1. В Vercel выберите **Add New → Project**, затем репозиторий **Focus**.
2. Root Directory оставьте корнем репозитория (`./`). Настройки уже находятся в `vercel.json`: Framework Preset **Other**, Build Command `npm run build:static`, Output Directory `dist/client`.
3. В Environment Variables добавьте серверные `RESEND_API_KEY` и `RESEND_FROM`. Ключ не нужно добавлять в GitHub или присылать в переписку.
4. Нажмите **Deploy**. После изменения переменных окружения выполните **Redeploy**.
5. Откройте Production URL и проверьте `/`, `/work/rapid` и `/start`. Для посетителей не должен быть включён Vercel Authentication в настройках доступа к production.

## Почта

Форма вызывает `/api/inquiry`; серверная функция отправляет одну заявку на **ItsTeamSwift@proton.me** и **gigabytex50@gmail.com**. Email посетителя используется как Reply-To. Получатели заданы в серверном коде.

В Resend сначала добавьте свой домен, внесите предложенные сервисом DNS-записи и дождитесь статуса **Verified**. После этого создайте ключ **Sending access**, ограниченный этим доменом. `RESEND_FROM` должен быть адресом на этом домене, например `Prism <hello@your-domain.com>`.

Домены `proton.me` и `gmail.com` принадлежат почтовым сервисам: их нельзя подтвердить как свой домен отправителя. Они остаются получателями. Тестовый отправитель `onboarding@resend.dev` не подходит для отправки сразу на два произвольных адреса.

До настройки переменных форма честно показывает, что отправка ещё не подключена, и сохраняет введённые данные на текущей странице. Посетитель может отправить бриф через Proton или WhatsApp. Успешный ответ Resend означает, что сервис принял письмо; доставку в почтовый ящик можно проверить в журнале Resend.

## Файлы и проверка

- Исходники и `api/` нужно импортировать из GitHub. Загрузка только статического ZIP не установит почтовую функцию.
- Изображения, шрифты и 3D-модель включены в проект. Ссылка на старый сайт Sites при публикации на Vercel не изменяется.
- `npm ci`, `npm run lint`, `npx tsc --noEmit`, `node --test tests/*.test.ts tests/*.test.mjs`, `npm run build:static`.
- `npm run preview:local` обслуживает собранный сайт и серверную функцию на `http://127.0.0.1:8080`. По умолчанию письмо не отправится без переменных Resend.
- В `api/inquiry.mjs` есть ограничение размера, проверка данных, скрытое поле от простых ботов и ключ повторной отправки. Для большого публичного трафика настройте ограничения запросов в Vercel Firewall.

Документация: [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [Vercel functions](https://vercel.com/docs/functions/runtimes/node-js), [Resend domains](https://resend.com/docs/dashboard/domains/introduction).


## Effect: модели Focus (необязательно)

Конструктор Effect (`/effect` и `/effect/studio`) работает бесплатно и без настроек — мгновенный движок выполняется в браузере.

Чтобы включить модели **Focus Astrolabe** (мощная), **Focus Compass** (средняя) и **Focus Spyglass** (сверхбыстрая), добавьте в Vercel → Settings → Environment Variables переменную `ANTHROPIC_API_KEY` (ключ из console.anthropic.com) и сделайте Redeploy. В студии станут доступны модели и уровни глубины: Авто, Быстро, Вдумчиво, Глубоко и Ultra. Генерация оплачивается по токенам на вашем аккаунте Anthropic; по умолчанию один IP может сделать 12 генераций за 10 минут (`EFFECT_RATE_LIMIT`).

Важно: функция ограничена 300 секундами (`vercel.json`). Большой сайт или игра на Astrolabe с уровнем Ultra может не уложиться — тогда выберите «Глубоко» или Compass, либо на тарифе Pro поднимите `maxDuration` до 800.
