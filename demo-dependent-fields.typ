// ДЕМО: каскад зависимых полей.
// Пока поле пустое — его «дочерние» поля скрыты и в документе, и в форме.
// Как только у поля появляется значение — открывается следующий уровень.
//
// Важно: форма видит только объявления #let ВЕРХНЕГО уровня, поэтому все поля
// объявлены сверху. А видимость задаётся ВЛОЖЕННЫМИ #if в теле документа —
// именно вложенность даёт каскад (ворота ребёнка не проверяются, пока не открыт
// родитель).

#let fill(value, placeholder: "____________") = {
  if value == "" [#placeholder] else [#value]
}

#align(center)[
  *ДЕМО — ЗАВИСИМЫЕ ПОЛЯ*
]

// @section 1. Компания
#let company_name = ""

// @section 2. Руководитель
#let director_role = ""
#let director_name = ""

// @section 3. Полномочия
#let authority = "ustav" // ustav | poa
#let poa_number = ""
#let poa_date = ""

// --- Документ: вложенные #if дают каскад видимости ---

1. Название компании: #fill(company_name).

#if company_name != "" [
  2. Компания «#fill(company_name)» в лице #fill(director_role) #fill(director_name).

  #if director_name != "" [
    3. Действует на основании #if authority == "ustav" [
      Устава.
    ] else if authority == "poa" [
      доверенности № #fill(poa_number) от #fill(poa_date).
    ]
  ]
]
