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
  paintPreview: ["Разметка скриншота и диаграмма", "Annotated screenshot and diagram"],
  playPaintAnimation: ["Запустить анимацию", "Play animation"],
  pausePaintAnimation: ["Остановить анимацию", "Stop animation"],
  paintPreviewImage: [
    "Превью показывает разметку фото самолёта и диаграмму, на которой ломаная стрелка соединяет тензор с моделью.",
    "The preview shows an annotated aircraft photo and a diagram where a bent arrow connects a tensor to a model.",
  ],
};

initSiteLanguage(document.querySelector("#interface-language"), language => {
  localizePage(homeTranslations, language);
});

const paintPreview = document.querySelector(".home-paint-preview");
const paintAnimationToggle = document.querySelector(".home-paint-animation-toggle");

if (paintPreview && paintAnimationToggle && "IntersectionObserver" in window) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const animation = new Image();
  animation.className = "home-paint-animation";
  animation.alt = "";
  let visible = false;
  let enabled = true;

  function updatePaintAnimation() {
    paintAnimationToggle.hidden = reducedMotion.matches;
    if (visible && enabled && !reducedMotion.matches) {
      if (animation.isConnected) return;
      animation.src = "x-paint/preview-animation.webp";
      paintPreview.append(animation);
    } else if (animation.isConnected) {
      animation.remove();
      animation.removeAttribute("src");
    }
  }

  paintAnimationToggle.addEventListener("click", () => {
    enabled = !enabled;
    paintAnimationToggle.querySelector('[data-i18n="playPaintAnimation"]').hidden = enabled;
    paintAnimationToggle.querySelector('[data-i18n="pausePaintAnimation"]').hidden = !enabled;
    updatePaintAnimation();
  });
  reducedMotion.addEventListener("change", updatePaintAnimation);

  const paintAnimationObserver = new IntersectionObserver(([entry]) => {
    visible = entry.intersectionRatio >= 0.5;
    updatePaintAnimation();
  }, { threshold: 0.5 });
  paintAnimationObserver.observe(paintPreview);
}
