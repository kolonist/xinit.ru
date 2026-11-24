"use strict";

const homeTranslations = {
  ...siteTranslations,
  pageTitle: ["Главная · xinit.ru", "Home · xinit.ru"],
  menu: ["Меню", "Menu"],
  intro: ["Небольшие утилиты для работы и публикаций.", "Small utilities for work and publishing."],
  terminalTitle: ["Снимок терминала", "Terminal screenshot"],
  terminalDescription: [
    "Создайте скриншот терминала для постов, иллюстраций и презентаций",
    "Create a terminal screenshot for posts, illustrations, and presentations",
  ],
  paintDescription: [
    "Нужно быстро разметить скриншот или набросать схемку? Обрежьте снимок, выделите важное, добавьте стрелки и подписи. Скопируйте результат в PNG и вставьте в сообщение или презентацию.",
    "Need to mark up a screenshot or sketch a quick diagram? Crop the screenshot, highlight what matters, and add arrows and labels. Copy the result as a PNG and paste it into a message or presentation.",
  ],
  paintBoardsDescription: [
    "Ведите несколько досок, храните их прямо в браузере, сохраняйте на диск, делитесь ссылками. Демонстрируйте экран с лазерной указкой.",
    "Work across multiple boards, keep them in your browser, save them to disk, and share them by link. Use the laser pointer when sharing your screen.",
  ],
  openPaint: ["Открыть x-paint", "Open x-paint"],
  openEditor: ["Открыть редактор", "Open editor"],
  preview: ["Пример снимка", "Example screenshot"],
  paintPreview: ["Пример разметки скриншота", "Annotated screenshot example"],
  playPaintLaser: ["Запустить анимацию", "Play animation"],
  pausePaintLaser: ["Остановить анимацию", "Stop animation"],
  paintPreviewImage: [
    "Стрелка на фото самолёта ведёт от бортового номера к увеличенному фрагменту. Справа маркером выделены строки в списке сообщений.",
    "An arrow connects the aircraft’s registration number to a close-up. On the right, a marker highlights lines in the message log.",
  ],
};

initSiteLanguage(document.querySelector("#interface-language"), language => {
  localizePage(homeTranslations, language);
});

const paintPreview = document.querySelector(".home-paint-preview");
const paintLaserToggle = document.querySelector(".home-paint-laser-toggle");

if (paintPreview && paintLaserToggle && "IntersectionObserver" in window) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const laser = new Image();
  laser.className = "home-paint-laser";
  laser.alt = "";
  let visible = false;
  let enabled = true;

  function updatePaintLaser() {
    paintLaserToggle.hidden = reducedMotion.matches;
    if (visible && enabled && !reducedMotion.matches) {
      if (laser.isConnected) return;
      laser.src = "x-paint/preview-laser.webp?v=3";
      paintPreview.append(laser);
    } else if (laser.isConnected) {
      laser.remove();
      laser.removeAttribute("src");
    }
  }

  paintLaserToggle.addEventListener("click", () => {
    enabled = !enabled;
    paintLaserToggle.querySelector('[data-i18n="playPaintLaser"]').hidden = enabled;
    paintLaserToggle.querySelector('[data-i18n="pausePaintLaser"]').hidden = !enabled;
    updatePaintLaser();
  });
  reducedMotion.addEventListener("change", updatePaintLaser);

  const paintLaserObserver = new IntersectionObserver(([entry]) => {
    visible = entry.intersectionRatio >= 0.5;
    updatePaintLaser();
  }, { threshold: 0.5 });
  paintLaserObserver.observe(paintPreview);
}
