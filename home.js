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
  paintDescription: ["Рисуйте схемы и добавляйте пометки на изображения", "Draw diagrams and annotate images"],
  openPaint: ["Открыть x-paint", "Open x-paint"],
  openEditor: ["Открыть редактор", "Open editor"],
  preview: ["Пример снимка", "Example screenshot"],
  paintPreview: ["Пример рисунка", "Example drawing"],
  paintPreviewImage: ["Схема со стрелками на холсте x-paint", "A diagram with arrows on the x-paint canvas"],
};

initSiteLanguage(document.querySelector("#interface-language"), language => {
  localizePage(homeTranslations, language);
});
