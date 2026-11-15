"use strict";

const navigation = document.querySelector(".site-navigation");
const menuToggle = navigation.querySelector(".site-menu-toggle");
const menuLinks = navigation.querySelector(".site-menu");

function setMenuExpanded(expanded) {
  menuToggle.setAttribute("aria-expanded", String(expanded));
}

menuToggle.addEventListener("click", () => {
  setMenuExpanded(menuToggle.getAttribute("aria-expanded") === "false");
});

menuLinks.addEventListener("click", event => {
  if (event.target.closest("a")) setMenuExpanded(false);
});

navigation.addEventListener("keydown", event => {
  if (event.key !== "Escape" || menuToggle.getAttribute("aria-expanded") !== "true") return;
  event.preventDefault();
  setMenuExpanded(false);
  menuToggle.focus();
});

navigation.addEventListener("focusout", event => {
  if (!navigation.contains(event.relatedTarget)) setMenuExpanded(false);
});

document.addEventListener("click", event => {
  if (!navigation.contains(event.target)) setMenuExpanded(false);
});

menuToggle.hidden = false;
