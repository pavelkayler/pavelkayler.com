# Pavel Kayler — portfolio

Самостоятельный сайт на React / Vite. Production: https://pavelkayler.com/.
Сборка не извлекает данные или CSS из архивных HTML конструктора.

## Локальная сборка

Требуется Node.js 24. Из чистого checkout:

```sh
npm ci
npm run build
npm run preview -- --host 127.0.0.1
```

`npm run dev` запускает Vite. Для точной проверки публикуемого сайта используйте production-сборку: часть статических файлов копируется на завершающем шаге build.
Не коммитьте `node_modules`, `dist`, секреты или результаты тестов. `package-lock.json` хранится в Git; зависимости устанавливаются через `npm ci`.

## Где находятся данные

- `src/generated/content/` — теперь это сохранённые исходные данные страниц, а не временный результат генерации. Название папки сохранено ради совместимости импортов.
- `src/generated/pages.json` и `pages.ts` — метаданные страниц; проверяйте согласованность обоих представлений.
- `src/generated/asset-manifest.json` — список публикуемых медиа.
- `src/generated/social-images.json` — изображения предпросмотра ссылок.
- `media/images`, `media/video`, `media/static` — локальная медиатека.
- `assets/styles/site-theme.css` — сохранённые правила оформления.
- `assets/styles/responsive.css` и стили React-приложения — адаптивность и интерфейс.

При добавлении фотографии внесите файл в медиатеку, пути и размеры — в данные нужной галереи, все используемые варианты — в manifest. При замене содержимого используйте новое имя файла, чтобы старые кэши не показывали прежний кадр. Не меняйте размеры полноэкранного изображения в данных наугад: PhotoSwipe использует их для открытия и масштабирования.

## Проверки и публикация

Pull request проходит сборку из lockfile, оптимизацию копий медиа, структурные проверки и браузерные сценарии Chromium / WebKit. В `main` тот же браузерный тест выполняется **до** публикации артефакта. После публикации отдельно проверяются TLS-сертификат, HTTP → HTTPS, www → основной домен, маршруты, 404, навигация и галереи. `build-info.json` подтверждает SHA опубликованного коммита.

```sh
# После npm run build; ffmpeg и Pillow нужны для production-оптимизации.
node scripts/optimize-production-media.mjs
python3 scripts/optimize-production-images.py
bash scripts/validate-production.sh
python3 -m pip install playwright==1.57.0
python3 -m playwright install --with-deps chromium webkit
bash scripts/run-browser-checks.sh
bash scripts/check-live-site.sh
```

Скриншоты и JSON-отчёты сохраняются в GitHub Actions artifacts на 7 дней. Мобильные сценарии — эмуляция viewport и ввода; они не заменяют контрольный просмотр на физическом телефоне.

## Домен и HTTPS

GitHub Pages публикуется из GitHub Actions. Custom domain и Enforce HTTPS задаются в Settings → Pages, DNS — у регистратора. Проверки не изменяют эти настройки. Не удаляйте домен и не перестраивайте DNS ради ошибки сборки. При доступном только HTTP post-deploy проверка намеренно завершается ошибкой.

## Порядок изменений и откат

Рабочая ветка → pull request → успешные проверки → merge в `main` → deployment → live smoke. Не заменяйте этот порядок прямым push непроверенных массовых изменений.

Для отката создайте новую ветку от актуального `main`, выполните `git revert` проблемного коммита (для merge-коммита — с проверенным номером mainline), прогоните проверки и перенесите revert через PR. Не используйте force push и не переписывайте историю. Архивные ветки `archive/pre-wfolio-cleanup-2026-09-04` и `archive/preview-main-2026-09-03` сохраняют исходные состояния миграции; это резерв, а не источник следующей production-сборки.
