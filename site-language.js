"use strict";

const siteTranslations = {
  navigation: ["Навигация", "Navigation"],
  telegram: ["Telegram-канал Lofi Developer", "Lofi Developer Telegram channel"],
  language: ["Язык интерфейса", "Interface language"],
};

const siteLanguageKey = "xinit-site-language";
const terminalSettingsKey = "xinit-terminal-settings-v1";

function storeSiteLanguage(language) {
  try {
    localStorage.setItem(siteLanguageKey, language);
  } catch {
    // The selector still works if storage is unavailable.
  }
}

function getSiteLanguage() {
  try {
    const language = localStorage.getItem(siteLanguageKey);
    if (language === "ru" || language === "en") return language;

    const previousLanguage = JSON.parse(localStorage.getItem(terminalSettingsKey))?.language;
    if (previousLanguage === "ru" || previousLanguage === "en") {
      storeSiteLanguage(previousLanguage);
      return previousLanguage;
    }
  } catch {
    // Fall back to the browser language when storage is unavailable or invalid.
  }
  return navigator.language.toLowerCase().split("-")[0] === "ru" ? "ru" : "en";
}

function initSiteLanguage(select, applyLanguage) {
  select.value = getSiteLanguage();
  applyLanguage(select.value);
  select.addEventListener("change", () => {
    storeSiteLanguage(select.value);
    applyLanguage(select.value);
  });
  window.addEventListener("pageshow", event => {
    if (!event.persisted) return;
    const language = getSiteLanguage();
    if (select.value === language) return;
    select.value = language;
    applyLanguage(language);
  });
}

function localizePage(translations, language) {
  document.documentElement.lang = language;
  const index = language === "ru" ? 0 : 1;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = translations[element.dataset.i18n][index];
  }
  for (const [key, attribute] of [["label", "aria-label"], ["title", "title"], ["placeholder", "placeholder"]]) {
    for (const element of document.querySelectorAll("[data-i18n-" + key + "]")) {
      element.setAttribute(attribute, translations[element.getAttribute("data-i18n-" + key)][index]);
    }
  }
}
