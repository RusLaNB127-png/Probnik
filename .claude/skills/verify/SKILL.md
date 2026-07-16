---
name: verify
description: Как проверять статические страницы этого репозитория (CRM, морской бой) в headless-браузере.
---

# Проверка страниц репозитория

Все приложения здесь — статические HTML-страницы без сборки. Проверяются
запуском в headless Chromium через Playwright.

## Запуск

- Chromium: `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`
  (путь `/opt/pw-browsers/chromium/chrome` не существует — смотрите
  версионированную папку `chromium-*/chrome-linux/chrome`).
- Страницы открываются по `file://` URL, сервер не нужен.
- Внешние CDN (unpkg и т.п.) в этой среде блокируются прокси (403) —
  подменяйте внешние библиотеки заглушками через `page.evaluate` после загрузки.

## Морской бой (`battleship/index.html`)

Мультиплеер на PeerJS. Для e2e без сети: открыть две страницы, подменить
`window.Peer` фейком и связать их через `exposeFunction`-реле
(готовый скрипт-образец: полная партия двух игроков, реванш, пробы).
Ключевые точки: `genBoard()` доступна глобально; ход определяется по
классу `#status` (`my-turn`/`enemy-turn`); конец игры — класс `active`
у `#overlay`.
