-- Сообщества «Рублёвки» в трёх мессенджерах: Telegram (прежняя колонка community_target_url), VK и MAX.
-- QR сообщества больше не показывается: на его месте — кнопки со значками платформ.
-- Колонка community_qr_image остаётся (применённые миграции не меняются), но приложением не используется;
-- загруженный ранее файл не удаляется, пока на него есть ссылка.

ALTER TABLE app_settings ADD COLUMN community_vk_url TEXT;
ALTER TABLE app_settings ADD COLUMN community_max_url TEXT;

-- Ссылки и текст, согласованные владельцем 21.10.2026. Заполняются только пустые ссылки
-- и только исходный текст по умолчанию: то, что администратор уже изменил, не трогается.
UPDATE app_settings SET community_target_url = 'https://t.me/+-G2HEy3Y79M2YmYy' WHERE community_target_url IS NULL;
UPDATE app_settings SET community_vk_url = 'https://vk.ru/rublevka34ru';
UPDATE app_settings SET community_max_url = 'https://web.max.ru/join/W4hPFGLIY250awhUiexEKstMeE5aNQLnMPaHnDb8Bfg';

UPDATE app_settings SET community_title = 'Выбирайте удобное для Вас сообщество'
  WHERE community_title = 'Присоединяйтесь в наше дружное сообщество';

UPDATE app_settings
  SET community_description = 'В сообществах мы делимся новостями «Рублёвки», анонсами встреч и фотографиями с прошедших событий, общаемся лично.'
  WHERE community_description IN (
    '',
    'Здесь мы делимся новостями «Рублёвки», анонсами встреч и фотографиями с прошедших событий. Наведите камеру телефона на QR-код.'
  );
