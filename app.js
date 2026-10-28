const BOT = "avantizbot";
const STORE = "avantiz-quiz";
const MAX = 100;

const STEPS = [
  {
    key: "project",
    label: "Дизайн-проект",
    title: "Есть ли у вас дизайн-проект?",
    hint: "Так менеджер точнее оценит сроки и стоимость.",
    options: ["Готов", "Готовится", "Есть картинки из Pinterest", "Не нужен", "Нужна помощь"],
  },
  {
    key: "room",
    label: "Помещение",
    title: "Для какого помещения нужна мебель?",
    hint: "Выберите главное, остальное обсудим с менеджером.",
    tiles: true,
    options: [
      ["Вся квартира", "whole"],
      ["Кухня", "kitchen"],
      ["Гостиная", "living"],
      ["Прихожая", "hall"],
      ["Спальня", "bedroom"],
      ["Детская", "kids"],
      ["Гардеробная", "wardrobe"],
      ["Санузел", "bath"],
      ["Кабинет", "office"],
    ],
    otherPlaceholder: "Например, балкон или кухня-гостиная",
  },
  {
    key: "city",
    label: "Город",
    title: "В каком городе нужна мебель?",
    hint: "Производство и салоны — в Москве, доставляем и в другие города.",
    options: ["Москва", "Московская область"],
    otherLabel: "Другой город",
    otherPlaceholder: "Например, Тула",
  },
  {
    key: "facade",
    label: "Фасады",
    title: "Какой материал фасадов рассматриваете?",
    options: ["Эмаль", "Шпон", "ЛДСП", "Cleaf", "Пластик", "Плёнка", "Ещё не определился"],
    otherPlaceholder: "Например, массив или стекло",
  },
  {
    key: "budget",
    label: "Бюджет",
    title: "Ориентировочный бюджет?",
    options: ["До 300 тыс. ₽", "300–700 тыс. ₽", "700 тыс. – 1,5 млн ₽", "Больше 1,5 млн ₽"],
    otherPlaceholder: "Ваша сумма или комментарий",
  },
  {
    key: "messenger",
    label: "Прислать расчёт",
    title: "Куда удобнее получить расчёт?",
    options: ["WhatsApp", "Telegram", "Viber", "Позвонить"],
    otherPlaceholder: "Например, MAX или e-mail",
  },
  {
    key: "name",
    label: "Имя",
    title: "Как к вам обращаться?",
    input: "text",
    placeholder: "Имя",
  },
  {
    key: "phone",
    label: "Телефон",
    title: "Оставьте номер телефона",
    hint: "Менеджер свяжется с вами по этому номеру.",
    input: "tel",
    placeholder: "+7 900 000-00-00",
  },
];

const tg = window.Telegram && window.Telegram.WebApp;
const inTelegram = !!tg && tg.platform && tg.platform !== "unknown";
const at = (v) => inTelegram && typeof tg.isVersionAtLeast === "function" && tg.isVersionAtLeast(v);

const screen = document.getElementById("screen");
const progress = document.getElementById("progress");
const count = document.getElementById("count");
const back = document.getElementById("back");
const next = document.getElementById("next");
const bar = document.getElementById("bar");

let answers = restore();
let step = 0;
let editing = false;
let advanceTimer = 0;

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function persist() {
  try {
    localStorage.setItem(STORE, JSON.stringify(answers));
  } catch {
    return;
  }
}

function forget() {
  try {
    localStorage.removeItem(STORE);
  } catch {
    return;
  }
}

function paintTelegram() {
  try {
    tg.setHeaderColor(at("6.9") ? "#e4e3df" : "bg_color");
    tg.setBackgroundColor("#e4e3df");
  } catch {
    return;
  }
}

function haptic(kind) {
  if (!at("6.1")) return;
  if (kind === "select") tg.HapticFeedback.selectionChanged();
  else tg.HapticFeedback.impactOccurred(kind);
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const child of children.flat()) if (child) node.append(child);
  return node;
}

function digits(s) {
  return (s || "").replace(/\D/g, "");
}

function value(s) {
  const a = answers[s.key];
  if (!a) return "";
  if (s.input) return (a.text || "").trim();
  return a.other ? (a.text || "").trim() : a.choice || "";
}

function ready(s) {
  const v = value(s);
  if (!v) return false;
  if (s.key === "phone") return digits(v).length >= 10;
  return true;
}

function optionLabel(o) {
  return Array.isArray(o) ? o[0] : o;
}

function setChrome() {
  const total = STEPS.length;
  const onSummary = step === total;
  const done = step > total;
  progress.style.width = `${(Math.min(step, total) / total) * 100}%`;
  count.textContent = done ? "" : onSummary ? "Проверьте заявку" : `Вопрос ${step + 1} из ${total}`;
  bar.hidden = done;
  back.style.visibility = step === 0 ? "hidden" : "visible";
  if (onSummary) {
    next.textContent = "Отправить заявку";
    next.disabled = !STEPS.every(ready);
  } else if (!done) {
    next.textContent = editing ? "Сохранить" : step === total - 1 ? "Проверить заявку" : "Далее";
    next.disabled = !ready(STEPS[step]);
  }
  if (at("6.1")) {
    if (step > 0 && !done) tg.BackButton.show();
    else tg.BackButton.hide();
  }
}

function go(to) {
  clearTimeout(advanceTimer);
  step = to;
  render();
  window.scrollTo({ top: 0 });
}

function advance() {
  if (editing) {
    editing = false;
    go(STEPS.length);
  } else {
    go(step + 1);
  }
}

function goBack() {
  if (step > STEPS.length) return;
  if (editing) {
    editing = false;
    go(STEPS.length);
    return;
  }
  if (step > 0) go(step - 1);
}

function choose(s, choice) {
  answers[s.key] = { choice };
  persist();
  haptic("select");
  render(true);
  clearTimeout(advanceTimer);
  advanceTimer = setTimeout(advance, 260);
}

function chooseOther(s) {
  const prev = answers[s.key];
  answers[s.key] = { other: true, text: prev && prev.other ? prev.text : "" };
  persist();
  haptic("select");
  clearTimeout(advanceTimer);
  render(true);
  const box = document.getElementById("other");
  if (box) {
    box.focus({ preventScroll: true });
    box.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

function otherBox(s) {
  const a = answers[s.key];
  const area = el("textarea", {
    id: "other",
    class: "field",
    maxlength: MAX,
    rows: 3,
    placeholder: s.otherPlaceholder || "Напишите свой вариант",
    oninput: (e) => {
      answers[s.key] = { other: true, text: e.target.value.slice(0, MAX) };
      persist();
      setChrome();
    },
  });
  area.value = (a && a.text) || "";
  return el("div", { class: "other-box" }, el("label", { class: "field-label", for: "other", text: "Свой вариант" }), area);
}

function choiceStep(s) {
  const a = answers[s.key];
  const isOther = !!(a && a.other);
  const group = el("div", { class: s.tiles ? "options tiles" : "options", role: "radiogroup", "aria-label": s.title });
  for (const o of s.options) {
    const label = optionLabel(o);
    const checked = !isOther && a && a.choice === label;
    if (s.tiles) {
      group.append(
        el("button", { type: "button", class: "tile", role: "radio", "aria-checked": checked ? "true" : "false", onclick: () => choose(s, label) },
          el("img", { src: `img/${o[1]}.jpg`, alt: "", loading: "lazy" }),
          el("span", { text: label })),
      );
    } else {
      group.append(
        el("button", { type: "button", class: "option", role: "radio", "aria-checked": checked ? "true" : "false", onclick: () => choose(s, label) },
          el("span", { class: "dot", "aria-hidden": "true" }),
          el("span", { text: label })),
      );
    }
  }
  const otherText = s.otherLabel || "Другое";
  if (s.tiles) {
    group.append(
      el("button", { type: "button", class: "tile tile-other", role: "radio", "aria-checked": isOther ? "true" : "false", onclick: () => chooseOther(s) },
        el("span", {}, otherText, el("small", { text: "свой вариант" }))),
    );
  } else {
    group.append(
      el("button", { type: "button", class: "option", role: "radio", "aria-checked": isOther ? "true" : "false", onclick: () => chooseOther(s) },
        el("span", { class: "dot", "aria-hidden": "true" }),
        el("span", { text: `${otherText} — свой вариант` })),
    );
  }
  return [group, isOther ? otherBox(s) : null];
}

function inputStep(s) {
  const a = answers[s.key] || {};
  const field = el("input", {
    id: "field",
    class: "field",
    type: s.input,
    inputmode: s.input === "tel" ? "tel" : null,
    autocomplete: s.input === "tel" ? "tel" : "given-name",
    maxlength: s.input === "tel" ? 30 : MAX,
    placeholder: s.placeholder,
    oninput: (e) => {
      answers[s.key] = { text: e.target.value };
      persist();
      error.hidden = true;
      setChrome();
    },
    onblur: () => {
      if (s.key === "phone" && value(s) && !ready(s)) error.hidden = false;
    },
    onkeydown: (e) => {
      if (e.key === "Enter" && ready(s)) {
        e.preventDefault();
        advance();
      }
    },
  });
  field.value = a.text || "";
  const error = el("p", { class: "field-error", text: "Проверьте номер: нужно минимум 10 цифр.", hidden: true });
  const parts = [el("label", { class: "field-label", for: "field", text: s.label }), field, error];
  if (s.key === "phone" && at("6.9") && typeof tg.requestContact === "function") {
    parts.push(
      el("button", {
        type: "button",
        class: "btn btn-line",
        text: "Взять номер из Telegram",
        onclick: () => {
          tg.requestContact((ok, res) => {
            const phone = ok && res && res.responseUnsafe && res.responseUnsafe.contact && res.responseUnsafe.contact.phone_number;
            if (!phone) return;
            answers.phone = { text: phone.startsWith("+") ? phone : `+${phone}` };
            persist();
            haptic("light");
            render(true);
          });
        },
      }),
    );
  }
  if (s.key === "phone") parts.push(el("p", { class: "field-note", text: "Номер увидит только менеджер «Авантиз»." }));
  return parts;
}

function summaryScreen() {
  const list = el("ul", { class: "summary" });
  STEPS.forEach((s, i) => {
    list.append(
      el("li", {},
        el("span", { class: "s-text" }, el("span", { class: "s-label", text: s.label }), el("span", { class: "s-value", text: value(s) || "—" })),
        el("button", { type: "button", class: "s-edit", text: "Изменить", "aria-label": `Изменить: ${s.label}`, onclick: () => { editing = true; go(i); } })),
    );
  });
  return [
    el("h1", { class: "title", text: "Всё верно?" }),
    el("p", { class: "hint", text: "Проверьте ответы. После отправки бот предложит прислать план, замеры или фото-идеи." }),
    list,
  ];
}

function doneScreen() {
  const parts = [
    el("div", { class: "done-mark", "aria-hidden": "true", text: "✓" }),
    el("h1", { class: "title", text: "Заявка отправлена" }),
  ];
  if (inTelegram) {
    parts.push(el("p", { class: "hint", text: "Вернитесь в чат с ботом: там можно прислать план или фото. Если окно не закрылось само, откройте анкету кнопкой «Заполнить анкету» под строкой ввода." }));
  } else {
    parts.push(
      el("p", { class: "hint", text: "Это просмотр в браузере: заявка отсюда не уходит. Чтобы отправить её менеджеру, откройте анкету в Telegram." }),
      el("a", { class: "btn btn-main", href: `https://t.me/${BOT}?start=app`, text: "Открыть бота" }),
    );
  }
  return el("div", { class: "done" }, parts);
}

function render(keep) {
  const total = STEPS.length;
  screen.replaceChildren();
  if (!keep) {
    screen.classList.remove("enter");
    void screen.offsetWidth;
    screen.classList.add("enter");
  }
  if (step < total) {
    const s = STEPS[step];
    screen.append(el("h1", { class: "title", text: s.title }));
    if (s.hint) screen.append(el("p", { class: "hint", text: s.hint }));
    screen.append(...(s.input ? inputStep(s) : choiceStep(s)).filter(Boolean));
    if (s.input && !keep) {
      const field = document.getElementById("field");
      if (field) setTimeout(() => field.focus({ preventScroll: true }), 300);
    }
  } else if (step === total) {
    screen.append(...summaryScreen());
  } else {
    screen.append(doneScreen());
  }
  setChrome();
}

function submit() {
  if (!STEPS.every(ready)) return;
  const payload = { v: 1, answers: Object.fromEntries(STEPS.map((s) => [s.key, value(s).slice(0, s.key === "phone" ? 30 : MAX)])) };
  haptic("medium");
  forget();
  step = STEPS.length + 1;
  render();
  if (inTelegram) {
    try {
      tg.sendData(JSON.stringify(payload));
    } catch {
      return;
    }
  }
}

next.addEventListener("click", () => {
  if (step === STEPS.length) submit();
  else if (ready(STEPS[step])) advance();
});
back.addEventListener("click", goBack);

if (inTelegram) {
  tg.ready();
  tg.expand();
  if (at("6.1")) tg.BackButton.onClick(goBack);
  paintTelegram();
  const first = tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.first_name;
  if (first && !answers.name) answers.name = { text: first };
}

render();
