# Effect

Effect — AI-билдер сайтов, лендингов, презентаций и игр от команды **Prism**.

- Лендинг: `/effect`
- Студия: `/effect/studio`
- API агентов: `api/effect.mjs` (нужны `ANTHROPIC_API_KEY` и, по желанию, `OPENROUTER_API_KEY` в переменных окружения Vercel)

## Запуск

```bash
npm install
npm run dev          # разработка
npm run build:static # статическая сборка в dist/client
```

Деплой на Vercel: настройки берутся из `vercel.json`, корень `/` ведёт на `/effect`.
