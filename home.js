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
  openEditor: ["Открыть редактор", "Open editor"],
  preview: ["Пример снимка", "Example screenshot"],
};

initSiteLanguage(document.querySelector("#interface-language"), language => {
  localizePage(homeTranslations, language);
});
