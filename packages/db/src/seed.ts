import dotenv from "dotenv";

dotenv.config({
  path: "../../apps/server/.env",
});

const { db } = await import("./index");
const { template, templateVersion } = await import("./schema/template");
const { subscriptionPlan } = await import("./schema/subscription");
const { eq } = await import("drizzle-orm");

const NI = "—"; // not included
const subscriptionPlans = [
  {
    id: "plan_one_time",
    name: "Разовый",
    description:
      "Один договор — одна оплата. Без подписки и обязательств. Достаточно для теста Zhebe.",
    priceMonthly: 0,
    discountLabel: null as string | null,
    downloadQuota: 1,
    editQuota: 1,
    sortOrder: 0,
    isDefault: true,
    features: [
      { label: "Поддержка", value: "Чат-бот" },
      { label: "Сохранение реквизитов", value: NI },
      { label: "Проверка документов", value: NI },
      { label: "Риск аналитика", value: NI },
      { label: "Пользователи в команде", value: NI },
      { label: "Составление документов", value: NI },
      { label: "Консультация от юриста", value: NI },
    ],
  },
  {
    id: "plan_basic",
    name: "Базовый",
    description:
      "Регулярный доступ к шаблонам для фрилансеров и небольших проектов.",
    priceMonthly: 23_870,
    // Годовая цена ≈ -20% от 12× месячной (совпадает с discountLabel). Поправь
    // суммы под свою тарифную политику при необходимости.
    priceYearly: 229_152,
    discountLabel: "-20%",
    downloadQuota: 15,
    editQuota: 5,
    sortOrder: 1,
    isDefault: false,
    features: [
      { label: "Поддержка", value: "Чат-бот" },
      { label: "Сохранение реквизитов", value: "до 3" },
      { label: "Проверка документов", value: "1" },
      { label: "Риск аналитика", value: NI },
      { label: "Пользователи в команде", value: NI },
      { label: "Составление документов", value: NI },
      { label: "Консультация от юриста", value: NI },
    ],
  },
  {
    id: "plan_standard",
    name: "Стандарт",
    description:
      "Полный доступ и юридическая поддержка для команд до 10 человек.",
    priceMonthly: 61_000,
    priceYearly: 585_600,
    discountLabel: "-20%",
    downloadQuota: -1,
    editQuota: 20,
    sortOrder: 2,
    isDefault: false,
    features: [
      { label: "Поддержка", value: "до 5 в месяц" },
      { label: "Сохранение реквизитов", value: "∞" },
      { label: "Проверка документов", value: "3" },
      { label: "Риск аналитика", value: "∞" },
      { label: "Пользователи в команде", value: "10" },
      { label: "Составление документов", value: "1" },
      { label: "Консультация от юриста", value: "1" },
    ],
  },
  {
    id: "plan_premium",
    name: "Премиум",
    description:
      "Максимальные возможности платформы для компаний с высоким документооборотом.",
    priceMonthly: 120_000,
    priceYearly: 1_152_000,
    discountLabel: "-20%",
    downloadQuota: -1,
    editQuota: 50,
    sortOrder: 3,
    isDefault: false,
    features: [
      { label: "Поддержка", value: "до 10 в месяц" },
      { label: "Сохранение реквизитов", value: "∞" },
      { label: "Проверка документов", value: "5" },
      { label: "Риск аналитика", value: "∞" },
      { label: "Пользователи в команде", value: "30" },
      { label: "Составление документов", value: "3" },
      { label: "Консультация от юриста", value: "5" },
    ],
  },
];

// Taxonomy assignment per template id. `categories` holds terminal slugs from
// packages/api/src/constants/template-options.ts (CATEGORY_TREE); the catalogue
// filter expands a broader selection down to these for matching.
const TEMPLATE_TAXONOMY: Record<
  string,
  { categories: string[]; documentType: string | null }
> = {
  tpl_service_agreement: {
    categories: ["uslugi-razovyy"],
    documentType: "dogovor",
  },
  tpl_nda: { categories: [], documentType: "soglashenie" },
  tpl_employment_contract: {
    categories: ["trudovoy-dogovor"],
    documentType: "dogovor",
  },
  tpl_consulting_agreement: {
    categories: ["uslugi-konsultacii-razovyy"],
    documentType: "dogovor",
  },
  tpl_rental_agreement: {
    categories: ["arenda-kvartira-dolgo"],
    documentType: "dogovor",
  },
  tpl_rental_agreement_kz: {
    categories: ["arenda-nezhiloe"],
    documentType: "dogovor",
  },
  tpl_service_agreement_kz: {
    categories: ["uslugi-mnogorazovyy"],
    documentType: "dogovor",
  },
  tpl_supply_contract_kz: {
    categories: ["postavka-razovaya"],
    documentType: "dogovor",
  },
  tpl_prilozhenie_specifikaciya: {
    categories: [],
    documentType: "prilozhenie",
  },
  tpl_akt_vypolnennyh_rabot: { categories: [], documentType: "akt" },
  tpl_reshenie_uchastnika: { categories: [], documentType: "reshenie" },
  tpl_protokol_sobraniya: { categories: [], documentType: "protokol" },
  tpl_prikaz_priem: { categories: [], documentType: "prikaz" },
  tpl_uvedomlenie_rastorzhenie: { categories: [], documentType: "uvedomlenie" },
  tpl_pretenziya_oplata: { categories: [], documentType: "pretenziya" },
  tpl_zayavlenie_uvolnenie: { categories: [], documentType: "zayavlenie" },
  tpl_iskovoe_zayavlenie: { categories: [], documentType: "isk" },
  tpl_hodataystvo: { categories: [], documentType: "hodataystvo" },
  tpl_zhaloba: { categories: [], documentType: "zhaloba" },
  tpl_doverennost: { categories: [], documentType: "doverennost" },
  tpl_garantiynoe_pismo: { categories: [], documentType: "pismo" },
};

const EMPTY_TAXONOMY = { categories: [] as string[], documentType: null };

const templates = [
  {
    id: "tpl_service_agreement",
    title: "Service Agreement",
    description:
      "A comprehensive service agreement template for businesses providing services to clients. Includes scope of work, payment terms, and liability clauses.",
    price: 4999,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "providerName",
        type: "text",
        required: true,
        label: "Service Provider Name",
      },
      {
        name: "providerAddress",
        type: "text",
        required: true,
        label: "Provider Address",
      },
      {
        name: "clientName",
        type: "text",
        required: true,
        label: "Client Name",
      },
      {
        name: "clientAddress",
        type: "text",
        required: true,
        label: "Client Address",
      },
      {
        name: "serviceDescription",
        type: "text",
        required: true,
        label: "Description of Services",
      },
      {
        name: "contractAmount",
        type: "number",
        required: true,
        label: "Contract Amount",
      },
      {
        name: "paymentTerms",
        type: "select",
        required: true,
        label: "Payment Terms",
        options: ["Net 15", "Net 30", "Net 60", "Due on Receipt"],
      },
      {
        name: "startDate",
        type: "date",
        required: true,
        label: "Start Date",
      },
      {
        name: "endDate",
        type: "date",
        required: false,
        label: "End Date",
      },
      {
        name: "governingLaw",
        type: "text",
        required: true,
        label: "Governing Law (State/Country)",
        defaultValue: "Saudi Arabia",
      },
    ],
    typstContent: `#set document(title: "Service Agreement")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)

#align(center)[
  #text(size: 18pt, weight: "bold")[SERVICE AGREEMENT]
]

#v(1em)

This Service Agreement ("Agreement") is entered into as of #datetime.today().display("[month repr:long] [day], [year]")

#v(1em)

*BETWEEN:*

#strong[{{providerName}}] ("Service Provider")\\
Address: {{providerAddress}}

#v(0.5em)

*AND:*

#strong[{{clientName}}] ("Client")\\
Address: {{clientAddress}}

#v(1em)

== 1. Services

The Service Provider agrees to provide the following services to the Client:

#block(inset: (left: 1em))[
  {{serviceDescription}}
]

== 2. Term

This Agreement shall commence on *{{startDate}}*#if "{{endDate}}" != "" [ and shall continue until *{{endDate}}*] else [ and shall continue until terminated by either party with 30 days written notice].

== 3. Compensation

The Client agrees to pay the Service Provider a total of *{{contractAmount}} SAR* for the services described herein.

Payment Terms: *{{paymentTerms}}*

== 4. Confidentiality

Both parties agree to maintain the confidentiality of any proprietary information shared during the course of this Agreement.

== 5. Limitation of Liability

The Service Provider's liability under this Agreement shall be limited to the total amount paid by the Client for services.

== 6. Governing Law

This Agreement shall be governed by and construed in accordance with the laws of *{{governingLaw}}*.

== 7. Entire Agreement

This Agreement constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, or agreements relating to this subject matter.

#v(2em)

#grid(
  columns: (1fr, 1fr),
  gutter: 2em,
  [
    *SERVICE PROVIDER*
    #v(2em)
    #line(length: 80%)
    {{providerName}}\\
    Date: #box(width: 6em)[#repeat[.]]
  ],
  [
    *CLIENT*
    #v(2em)
    #line(length: 80%)
    {{clientName}}\\
    Date: #box(width: 6em)[#repeat[.]]
  ]
)
`,
  },
  {
    id: "tpl_nda",
    title: "Non-Disclosure Agreement (NDA)",
    description:
      "A mutual non-disclosure agreement to protect confidential information shared between two parties during business discussions or partnerships.",
    price: 2999,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "disclosingParty",
        type: "text",
        required: true,
        label: "Disclosing Party Name",
      },
      {
        name: "receivingParty",
        type: "text",
        required: true,
        label: "Receiving Party Name",
      },
      {
        name: "purpose",
        type: "text",
        required: true,
        label: "Purpose of Disclosure",
      },
      {
        name: "confidentialityPeriod",
        type: "number",
        required: true,
        label: "Confidentiality Period (years)",
        defaultValue: 2,
      },
      {
        name: "effectiveDate",
        type: "date",
        required: true,
        label: "Effective Date",
      },
      {
        name: "governingLaw",
        type: "text",
        required: true,
        label: "Governing Law (State/Country)",
        defaultValue: "Saudi Arabia",
      },
      {
        name: "isMutual",
        type: "boolean",
        required: true,
        label: "Mutual NDA (both parties share info)",
        defaultValue: true,
      },
    ],
    typstContent: `#set document(title: "Non-Disclosure Agreement")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)

#align(center)[
  #text(size: 18pt, weight: "bold")[NON-DISCLOSURE AGREEMENT]
  #v(0.3em)
  #text(size: 12pt)[#if {{isMutual}} [(Mutual)] else [(One-Way)]]
]

#v(1em)

This Non-Disclosure Agreement ("Agreement") is entered into as of *{{effectiveDate}}*

#v(1em)

*BETWEEN:*

#strong[{{disclosingParty}}] ("Disclosing Party")

*AND:*

#strong[{{receivingParty}}] ("Receiving Party")

#if {{isMutual}} [
  _(Each party may be both a Disclosing Party and Receiving Party under this Agreement)_
]

#v(1em)

== 1. Purpose

The parties wish to explore a potential business relationship concerning:

#block(inset: (left: 1em))[
  {{purpose}}
]

In connection with this purpose, each party may disclose certain confidential and proprietary information to the other party.

== 2. Definition of Confidential Information

"Confidential Information" means any information disclosed by either party that is:
- Marked as confidential or proprietary
- Reasonably understood to be confidential given the nature of the information
- Technical, business, or financial information

== 3. Obligations of Receiving Party

The Receiving Party agrees to:
+ Hold the Confidential Information in strict confidence
+ Not disclose the Confidential Information to any third parties without prior written consent
+ Use the Confidential Information only for the Purpose stated above
+ Take reasonable measures to protect the confidentiality of the information

== 4. Exclusions

This Agreement does not apply to information that:
- Is or becomes publicly available through no fault of the Receiving Party
- Was known to the Receiving Party prior to disclosure
- Is independently developed by the Receiving Party
- Is disclosed with written permission of the Disclosing Party

== 5. Term

The confidentiality obligations under this Agreement shall remain in effect for a period of *{{confidentialityPeriod}} years* from the date of disclosure.

== 6. Return of Information

Upon termination of this Agreement or upon request, the Receiving Party shall return or destroy all Confidential Information and any copies thereof.

== 7. Governing Law

This Agreement shall be governed by the laws of *{{governingLaw}}*.

== 8. Remedies

The parties acknowledge that breach of this Agreement may cause irreparable harm for which monetary damages may be inadequate, and the Disclosing Party shall be entitled to seek equitable relief.

#v(2em)

#grid(
  columns: (1fr, 1fr),
  gutter: 2em,
  [
    *DISCLOSING PARTY*
    #v(2em)
    #line(length: 80%)
    {{disclosingParty}}\\
    Date: #box(width: 6em)[#repeat[.]]
  ],
  [
    *RECEIVING PARTY*
    #v(2em)
    #line(length: 80%)
    {{receivingParty}}\\
    Date: #box(width: 6em)[#repeat[.]]
  ]
)
`,
  },
  {
    id: "tpl_employment_contract",
    title: "Employment Contract",
    description:
      "A standard employment contract template defining the terms of employment including position, salary, benefits, and termination conditions.",
    price: 5999,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "employerName",
        type: "text",
        required: true,
        label: "Employer/Company Name",
      },
      {
        name: "employerAddress",
        type: "text",
        required: true,
        label: "Employer Address",
      },
      {
        name: "employeeName",
        type: "text",
        required: true,
        label: "Employee Full Name",
      },
      {
        name: "employeeAddress",
        type: "text",
        required: true,
        label: "Employee Address",
      },
      {
        name: "jobTitle",
        type: "text",
        required: true,
        label: "Job Title/Position",
      },
      {
        name: "department",
        type: "text",
        required: false,
        label: "Department",
      },
      {
        name: "startDate",
        type: "date",
        required: true,
        label: "Employment Start Date",
      },
      {
        name: "salary",
        type: "number",
        required: true,
        label: "Monthly Salary (SAR)",
      },
      {
        name: "probationPeriod",
        type: "number",
        required: true,
        label: "Probation Period (months)",
        defaultValue: 3,
      },
      {
        name: "workingHours",
        type: "number",
        required: true,
        label: "Weekly Working Hours",
        defaultValue: 40,
      },
      {
        name: "annualLeave",
        type: "number",
        required: true,
        label: "Annual Leave Days",
        defaultValue: 21,
      },
      {
        name: "noticePeriod",
        type: "number",
        required: true,
        label: "Notice Period (days)",
        defaultValue: 30,
      },
    ],
    typstContent: `#set document(title: "Employment Contract")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)

#align(center)[
  #text(size: 18pt, weight: "bold")[EMPLOYMENT CONTRACT]
]

#v(1em)

This Employment Contract ("Contract") is entered into as of #datetime.today().display("[month repr:long] [day], [year]")

#v(1em)

*BETWEEN:*

#strong[{{employerName}}] ("Employer")\\
Address: {{employerAddress}}

#v(0.5em)

*AND:*

#strong[{{employeeName}}] ("Employee")\\
Address: {{employeeAddress}}

#v(1em)

== 1. Position and Duties

The Employer hereby employs the Employee in the position of *{{jobTitle}}*#if "{{department}}" != "" [ in the *{{department}}* department].

The Employee agrees to perform all duties and responsibilities associated with this position as directed by the Employer.

== 2. Commencement Date

This employment shall commence on *{{startDate}}*.

== 3. Probation Period

The Employee shall be subject to a probationary period of *{{probationPeriod}} months*. During this period, either party may terminate the employment with one week's notice.

== 4. Compensation

The Employee shall receive a monthly salary of *{{salary}} SAR*, payable at the end of each month.

The salary is subject to all applicable tax deductions and statutory contributions.

== 5. Working Hours

The standard working hours shall be *{{workingHours}} hours per week*, typically distributed across the working days as determined by the Employer.

== 6. Annual Leave

The Employee shall be entitled to *{{annualLeave}} working days* of paid annual leave per year, to be taken at times agreed upon with the Employer.

== 7. Confidentiality

The Employee agrees to maintain the confidentiality of all proprietary information, trade secrets, and business information of the Employer during and after the term of employment.

== 8. Termination

Either party may terminate this Contract by providing *{{noticePeriod}} days* written notice to the other party.

The Employer may terminate employment immediately for cause, including but not limited to:
- Gross misconduct
- Breach of confidentiality
- Failure to perform duties

== 9. Return of Property

Upon termination, the Employee shall return all company property, documents, and materials in their possession.

== 10. Governing Law

This Contract shall be governed by the labor laws of the Kingdom of Saudi Arabia.

#v(2em)

#grid(
  columns: (1fr, 1fr),
  gutter: 2em,
  [
    *EMPLOYER*
    #v(2em)
    #line(length: 80%)
    Authorized Representative\\
    {{employerName}}\\
    Date: #box(width: 6em)[#repeat[.]]
  ],
  [
    *EMPLOYEE*
    #v(2em)
    #line(length: 80%)
    {{employeeName}}\\
    Date: #box(width: 6em)[#repeat[.]]
  ]
)
`,
  },
  {
    id: "tpl_consulting_agreement",
    title: "Consulting/Freelance Agreement",
    description:
      "An agreement for hiring independent contractors or consultants on a project basis. Defines scope, deliverables, payment schedule, and IP ownership.",
    price: 3999,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "companyName",
        type: "text",
        required: true,
        label: "Company/Client Name",
      },
      {
        name: "companyAddress",
        type: "text",
        required: true,
        label: "Company Address",
      },
      {
        name: "consultantName",
        type: "text",
        required: true,
        label: "Consultant Name",
      },
      {
        name: "consultantAddress",
        type: "text",
        required: true,
        label: "Consultant Address",
      },
      {
        name: "projectDescription",
        type: "text",
        required: true,
        label: "Project Description",
      },
      {
        name: "deliverables",
        type: "text",
        required: true,
        label: "Deliverables",
      },
      {
        name: "totalFee",
        type: "number",
        required: true,
        label: "Total Project Fee (SAR)",
      },
      {
        name: "paymentSchedule",
        type: "select",
        required: true,
        label: "Payment Schedule",
        options: [
          "100% upon completion",
          "50% upfront, 50% on completion",
          "Monthly milestones",
          "Weekly payments",
        ],
      },
      {
        name: "startDate",
        type: "date",
        required: true,
        label: "Project Start Date",
      },
      {
        name: "endDate",
        type: "date",
        required: true,
        label: "Project End Date",
      },
      {
        name: "ipOwnership",
        type: "select",
        required: true,
        label: "Intellectual Property Ownership",
        options: [
          "Client owns all IP",
          "Consultant retains IP, grants license",
          "Joint ownership",
        ],
      },
    ],
    typstContent: `#set document(title: "Consulting Agreement")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)

#align(center)[
  #text(size: 18pt, weight: "bold")[CONSULTING AGREEMENT]
]

#v(1em)

This Consulting Agreement ("Agreement") is entered into as of #datetime.today().display("[month repr:long] [day], [year]")

#v(1em)

*BETWEEN:*

#strong[{{companyName}}] ("Client")\\
Address: {{companyAddress}}

#v(0.5em)

*AND:*

#strong[{{consultantName}}] ("Consultant")\\
Address: {{consultantAddress}}

#v(1em)

== 1. Engagement

The Client hereby engages the Consultant as an independent contractor to perform consulting services as described in this Agreement.

== 2. Scope of Work

The Consultant agrees to perform the following services:

#block(inset: (left: 1em))[
  {{projectDescription}}
]

== 3. Deliverables

The Consultant shall provide the following deliverables:

#block(inset: (left: 1em))[
  {{deliverables}}
]

== 4. Term

This Agreement shall commence on *{{startDate}}* and shall continue until *{{endDate}}*, unless terminated earlier in accordance with this Agreement.

== 5. Compensation

The Client agrees to pay the Consultant a total fee of *{{totalFee}} SAR* for the services described herein.

*Payment Schedule:* {{paymentSchedule}}

== 6. Independent Contractor Status

The Consultant is an independent contractor and not an employee of the Client. The Consultant shall be responsible for all taxes, insurance, and other obligations arising from this engagement.

== 7. Intellectual Property

#if "{{ipOwnership}}" == "Client owns all IP" [
  All work product, deliverables, and intellectual property created by the Consultant in the performance of this Agreement shall be the sole and exclusive property of the Client.
] else if "{{ipOwnership}}" == "Consultant retains IP, grants license" [
  The Consultant retains ownership of all intellectual property created during this engagement but grants the Client a perpetual, non-exclusive license to use such intellectual property for the Client's business purposes.
] else [
  All intellectual property created during this engagement shall be jointly owned by the Client and Consultant. Neither party may license or transfer the joint intellectual property without the written consent of the other party.
]

== 8. Confidentiality

The Consultant agrees to maintain the confidentiality of all proprietary information disclosed by the Client and shall not disclose such information to any third party without prior written consent.

== 9. Termination

Either party may terminate this Agreement with 14 days written notice. Upon termination:
- The Client shall pay for all work completed up to the termination date
- The Consultant shall deliver all completed work product to the Client

== 10. Limitation of Liability

The Consultant's total liability under this Agreement shall not exceed the total fees paid by the Client.

== 11. Governing Law

This Agreement shall be governed by the laws of the Kingdom of Saudi Arabia.

#v(2em)

#grid(
  columns: (1fr, 1fr),
  gutter: 2em,
  [
    *CLIENT*
    #v(2em)
    #line(length: 80%)
    Authorized Representative\\
    {{companyName}}\\
    Date: #box(width: 6em)[#repeat[.]]
  ],
  [
    *CONSULTANT*
    #v(2em)
    #line(length: 80%)
    {{consultantName}}\\
    Date: #box(width: 6em)[#repeat[.]]
  ]
)
`,
  },
  {
    id: "tpl_rental_agreement",
    title: "Rental/Lease Agreement",
    description:
      "A comprehensive rental agreement for residential or commercial property. Includes terms for rent, security deposit, maintenance responsibilities, and termination.",
    price: 4499,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "landlordName",
        type: "text",
        required: true,
        label: "Landlord Name",
      },
      {
        name: "landlordAddress",
        type: "text",
        required: true,
        label: "Landlord Address",
      },
      {
        name: "tenantName",
        type: "text",
        required: true,
        label: "Tenant Name",
      },
      {
        name: "tenantIdNumber",
        type: "text",
        required: true,
        label: "Tenant ID/Iqama Number",
      },
      {
        name: "propertyAddress",
        type: "text",
        required: true,
        label: "Property Address",
      },
      {
        name: "propertyType",
        type: "select",
        required: true,
        label: "Property Type",
        options: [
          "Apartment",
          "Villa",
          "Office Space",
          "Retail Space",
          "Warehouse",
        ],
      },
      {
        name: "monthlyRent",
        type: "number",
        required: true,
        label: "Monthly Rent (SAR)",
      },
      {
        name: "securityDeposit",
        type: "number",
        required: true,
        label: "Security Deposit (SAR)",
      },
      {
        name: "leaseStartDate",
        type: "date",
        required: true,
        label: "Lease Start Date",
      },
      {
        name: "leaseDuration",
        type: "number",
        required: true,
        label: "Lease Duration (months)",
        defaultValue: 12,
      },
      {
        name: "paymentDueDay",
        type: "number",
        required: true,
        label: "Rent Due Day of Month",
        defaultValue: 1,
      },
      {
        name: "utilitiesIncluded",
        type: "boolean",
        required: true,
        label: "Utilities Included in Rent",
        defaultValue: false,
      },
    ],
    typstContent: `#set document(title: "Rental Agreement")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)

#align(center)[
  #text(size: 18pt, weight: "bold")[RENTAL AGREEMENT]
]

#v(1em)

This Rental Agreement ("Agreement") is entered into as of #datetime.today().display("[month repr:long] [day], [year]")

#v(1em)

*BETWEEN:*

#strong[{{landlordName}}] ("Landlord")\\
Address: {{landlordAddress}}

#v(0.5em)

*AND:*

#strong[{{tenantName}}] ("Tenant")\\
ID/Iqama Number: {{tenantIdNumber}}

#v(1em)

== 1. Property

The Landlord agrees to rent to the Tenant the following property:

*Property Type:* {{propertyType}}\\
*Address:* {{propertyAddress}}

== 2. Term

This lease shall commence on *{{leaseStartDate}}* and shall continue for a period of *{{leaseDuration}} months*.

== 3. Rent

The Tenant agrees to pay monthly rent of *{{monthlyRent}} SAR*.

Rent is due on the *{{paymentDueDay}}th day* of each month.

Late payment may result in a penalty fee as permitted by applicable law.

== 4. Security Deposit

The Tenant shall pay a security deposit of *{{securityDeposit}} SAR* upon signing this Agreement.

The security deposit shall be returned within 30 days after the termination of this lease, less any deductions for:
- Unpaid rent
- Damages beyond normal wear and tear
- Cleaning costs if property is not left in reasonable condition

== 5. Utilities

#if {{utilitiesIncluded}} [
  Utilities (electricity, water, and internet) are *included* in the monthly rent.
] else [
  Utilities (electricity, water, internet, etc.) are *not included* in the rent and shall be the sole responsibility of the Tenant.
]

== 6. Use of Property

The property shall be used exclusively for #if "{{propertyType}}" == "Apartment" or "{{propertyType}}" == "Villa" [residential purposes] else [commercial purposes as agreed upon].

The Tenant shall not:
- Sublet the property without written consent
- Make structural modifications without written consent
- Use the property for illegal purposes

== 7. Maintenance and Repairs

- *Landlord* is responsible for major repairs and structural maintenance
- *Tenant* is responsible for day-to-day maintenance and minor repairs
- Tenant shall promptly report any damage or necessary repairs to the Landlord

== 8. Entry by Landlord

The Landlord may enter the property with 24 hours notice for:
- Inspections
- Repairs
- Showing to prospective tenants (in final 60 days of lease)

== 9. Termination

Either party may terminate this Agreement:
- At the end of the lease term with 30 days written notice
- Immediately for material breach of this Agreement

== 10. Governing Law

This Agreement shall be governed by the rental laws of the Kingdom of Saudi Arabia.

#v(2em)

#grid(
  columns: (1fr, 1fr),
  gutter: 2em,
  [
    *LANDLORD*
    #v(2em)
    #line(length: 80%)
    {{landlordName}}\\
    Date: #box(width: 6em)[#repeat[.]]
  ],
  [
    *TENANT*
    #v(2em)
    #line(length: 80%)
    {{tenantName}}\\
    Date: #box(width: 6em)[#repeat[.]]
  ]
)
`,
  },
  {
    id: "tpl_rental_agreement_kz",
    title: "Договор аренды (Казахстан)",
    description:
      "Договор аренды для различных объектов: офис, квартира, земельный участок, транспортное средство, оборудование. Поддерживает выбор типа сторон и гибкую настройку условий.",
    price: 4999,
    currentVersion: 1,
    isPublished: true,
    variables: [
      // === General ===
      {
        name: "city",
        type: "text",
        required: true,
        label: "Город",
        defaultValue: "Алматы",
      },
      {
        name: "contractDate",
        type: "date",
        required: true,
        label: "Дата договора",
      },
      // === Landlord ===
      {
        name: "landlordType",
        type: "select",
        required: true,
        label: "Тип арендодателя",
        options: ["Юридическое лицо", "ИП", "Физическое лицо"],
      },
      {
        name: "landlordCompanyName",
        type: "text",
        required: false,
        label: "Наименование компании арендодателя",
        dependsOn: { field: "landlordType", value: "Юридическое лицо" },
      },
      {
        name: "landlordIPName",
        type: "text",
        required: false,
        label: "Наименование ИП арендодателя",
        dependsOn: { field: "landlordType", value: "ИП" },
      },
      {
        name: "landlordPosition",
        type: "text",
        required: false,
        label: "Должность представителя арендодателя",
        dependsOn: {
          field: "landlordType",
          value: ["Юридическое лицо", "ИП"],
          operator: "in",
        },
      },
      {
        name: "landlordFIO",
        type: "text",
        required: true,
        label: "ФИО арендодателя",
      },
      {
        name: "landlordGender",
        type: "select",
        required: false,
        label: "Пол представителя арендодателя",
        options: ["Мужской", "Женский"],
      },
      {
        name: "landlordAuthDocType",
        type: "select",
        required: false,
        label: "Документ-основание (Арендодатель, юрлицо)",
        options: ["Устав", "Доверенность", "Иной документ"],
        dependsOn: { field: "landlordType", value: "Юридическое лицо" },
      },
      {
        name: "landlordProxyNumber",
        type: "text",
        required: false,
        label: "№ доверенности (Арендодатель)",
        dependsOn: { field: "landlordAuthDocType", value: "Доверенность" },
      },
      {
        name: "landlordProxyDate",
        type: "date",
        required: false,
        label: "Дата выдачи доверенности (Арендодатель)",
        dependsOn: { field: "landlordAuthDocType", value: "Доверенность" },
      },
      {
        name: "landlordProxyValidUntil",
        type: "date",
        required: false,
        label: "Срок действия доверенности (Арендодатель)",
        dependsOn: { field: "landlordAuthDocType", value: "Доверенность" },
      },
      {
        name: "landlordOtherDocName",
        type: "text",
        required: false,
        label: "Название документа (Арендодатель)",
        dependsOn: { field: "landlordAuthDocType", value: "Иной документ" },
      },
      {
        name: "landlordOtherDocDate",
        type: "date",
        required: false,
        label: "Дата документа (Арендодатель)",
        dependsOn: { field: "landlordAuthDocType", value: "Иной документ" },
      },
      {
        name: "landlordAuthDocTypeIP",
        type: "select",
        required: false,
        label: "Документ-основание (Арендодатель, ИП)",
        options: ["Доверенность", "Талон"],
        dependsOn: { field: "landlordType", value: "ИП" },
      },
      {
        name: "landlordIPProxyNumber",
        type: "text",
        required: false,
        label: "№ доверенности (Арендодатель, ИП)",
        dependsOn: { field: "landlordAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "landlordIPProxyDate",
        type: "date",
        required: false,
        label: "Дата выдачи доверенности (Арендодатель, ИП)",
        dependsOn: { field: "landlordAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "landlordIPProxyValidUntil",
        type: "date",
        required: false,
        label: "Срок действия доверенности (Арендодатель, ИП)",
        dependsOn: { field: "landlordAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "landlordTalonNumber",
        type: "text",
        required: false,
        label: "№ талона (Арендодатель)",
        dependsOn: { field: "landlordAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "landlordTalonOrgName",
        type: "text",
        required: false,
        label: "Наименование принимающей организации (Арендодатель)",
        dependsOn: { field: "landlordAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "landlordTalonDate",
        type: "date",
        required: false,
        label: "Дата талона (Арендодатель)",
        dependsOn: { field: "landlordAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "landlordTalonRegNumber",
        type: "text",
        required: false,
        label: "Входящий рег. номер уведомления (Арендодатель)",
        dependsOn: { field: "landlordAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "landlordBIN",
        type: "text",
        required: false,
        label: "БИН арендодателя",
        dependsOn: { field: "landlordType", value: "Юридическое лицо" },
      },
      {
        name: "landlordIIN",
        type: "text",
        required: false,
        label: "ИИН арендодателя",
        dependsOn: {
          field: "landlordType",
          value: ["ИП", "Физическое лицо"],
          operator: "in",
        },
      },
      // === Tenant ===
      {
        name: "tenantType",
        type: "select",
        required: true,
        label: "Тип арендатора",
        options: ["Юридическое лицо", "ИП", "Физическое лицо"],
      },
      {
        name: "tenantCompanyName",
        type: "text",
        required: false,
        label: "Наименование компании арендатора",
        dependsOn: { field: "tenantType", value: "Юридическое лицо" },
      },
      {
        name: "tenantIPName",
        type: "text",
        required: false,
        label: "Наименование ИП арендатора",
        dependsOn: { field: "tenantType", value: "ИП" },
      },
      {
        name: "tenantPosition",
        type: "text",
        required: false,
        label: "Должность представителя арендатора",
        dependsOn: {
          field: "tenantType",
          value: ["Юридическое лицо", "ИП"],
          operator: "in",
        },
      },
      {
        name: "tenantFIO",
        type: "text",
        required: true,
        label: "ФИО арендатора",
      },
      {
        name: "tenantGender",
        type: "select",
        required: false,
        label: "Пол представителя арендатора",
        options: ["Мужской", "Женский"],
      },
      {
        name: "tenantAuthDocType",
        type: "select",
        required: false,
        label: "Документ-основание (Арендатор, юрлицо)",
        options: ["Устав", "Доверенность", "Иной документ"],
        dependsOn: { field: "tenantType", value: "Юридическое лицо" },
      },
      {
        name: "tenantProxyNumber",
        type: "text",
        required: false,
        label: "№ доверенности (Арендатор)",
        dependsOn: { field: "tenantAuthDocType", value: "Доверенность" },
      },
      {
        name: "tenantProxyDate",
        type: "date",
        required: false,
        label: "Дата выдачи доверенности (Арендатор)",
        dependsOn: { field: "tenantAuthDocType", value: "Доверенность" },
      },
      {
        name: "tenantProxyValidUntil",
        type: "date",
        required: false,
        label: "Срок действия доверенности (Арендатор)",
        dependsOn: { field: "tenantAuthDocType", value: "Доверенность" },
      },
      {
        name: "tenantOtherDocName",
        type: "text",
        required: false,
        label: "Название документа (Арендатор)",
        dependsOn: { field: "tenantAuthDocType", value: "Иной документ" },
      },
      {
        name: "tenantOtherDocDate",
        type: "date",
        required: false,
        label: "Дата документа (Арендатор)",
        dependsOn: { field: "tenantAuthDocType", value: "Иной документ" },
      },
      {
        name: "tenantAuthDocTypeIP",
        type: "select",
        required: false,
        label: "Документ-основание (Арендатор, ИП)",
        options: ["Доверенность", "Талон"],
        dependsOn: { field: "tenantType", value: "ИП" },
      },
      {
        name: "tenantIPProxyNumber",
        type: "text",
        required: false,
        label: "№ доверенности (Арендатор, ИП)",
        dependsOn: { field: "tenantAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "tenantIPProxyDate",
        type: "date",
        required: false,
        label: "Дата выдачи доверенности (Арендатор, ИП)",
        dependsOn: { field: "tenantAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "tenantIPProxyValidUntil",
        type: "date",
        required: false,
        label: "Срок действия доверенности (Арендатор, ИП)",
        dependsOn: { field: "tenantAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "tenantTalonNumber",
        type: "text",
        required: false,
        label: "№ талона (Арендатор)",
        dependsOn: { field: "tenantAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "tenantTalonOrgName",
        type: "text",
        required: false,
        label: "Наименование принимающей организации (Арендатор)",
        dependsOn: { field: "tenantAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "tenantTalonDate",
        type: "date",
        required: false,
        label: "Дата талона (Арендатор)",
        dependsOn: { field: "tenantAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "tenantTalonRegNumber",
        type: "text",
        required: false,
        label: "Входящий рег. номер уведомления (Арендатор)",
        dependsOn: { field: "tenantAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "tenantBIN",
        type: "text",
        required: false,
        label: "БИН арендатора",
        dependsOn: { field: "tenantType", value: "Юридическое лицо" },
      },
      {
        name: "tenantIIN",
        type: "text",
        required: false,
        label: "ИИН арендатора",
        dependsOn: {
          field: "tenantType",
          value: ["ИП", "Физическое лицо"],
          operator: "in",
        },
      },
      // === Rental Object ===
      {
        name: "rentalObjectType",
        type: "select",
        required: true,
        label: "Тип объекта аренды",
        options: [
          "Офис",
          "Квартира",
          "Земельный участок",
          "Транспортное средство",
          "Оборудование",
        ],
      },
      {
        name: "objectAddress",
        type: "text",
        required: false,
        label: "Адрес объекта",
        dependsOn: {
          field: "rentalObjectType",
          value: ["Офис", "Квартира", "Земельный участок"],
          operator: "in",
        },
      },
      {
        name: "objectArea",
        type: "number",
        required: false,
        label: "Площадь (кв.м)",
        dependsOn: {
          field: "rentalObjectType",
          value: ["Офис", "Квартира", "Земельный участок"],
          operator: "in",
        },
      },
      {
        name: "roomCount",
        type: "number",
        required: false,
        label: "Количество комнат",
        dependsOn: { field: "rentalObjectType", value: "Квартира" },
      },
      {
        name: "cadastralNumber",
        type: "text",
        required: false,
        label: "Кадастровый номер",
        dependsOn: { field: "rentalObjectType", value: "Земельный участок" },
      },
      {
        name: "landPurpose",
        type: "text",
        required: false,
        label: "Целевое назначение участка",
        dependsOn: { field: "rentalObjectType", value: "Земельный участок" },
      },
      {
        name: "vehicleMake",
        type: "text",
        required: false,
        label: "Марка ТС",
        dependsOn: {
          field: "rentalObjectType",
          value: "Транспортное средство",
        },
      },
      {
        name: "vehicleModel",
        type: "text",
        required: false,
        label: "Модель ТС",
        dependsOn: {
          field: "rentalObjectType",
          value: "Транспортное средство",
        },
      },
      {
        name: "vehicleRegNumber",
        type: "text",
        required: false,
        label: "Гос. номер ТС",
        dependsOn: {
          field: "rentalObjectType",
          value: "Транспортное средство",
        },
      },
      {
        name: "vehicleYear",
        type: "number",
        required: false,
        label: "Год выпуска ТС",
        dependsOn: {
          field: "rentalObjectType",
          value: "Транспортное средство",
        },
      },
      {
        name: "vehicleVIN",
        type: "text",
        required: false,
        label: "VIN номер",
        dependsOn: {
          field: "rentalObjectType",
          value: "Транспортное средство",
        },
      },
      {
        name: "vehicleCrew",
        type: "select",
        required: false,
        label: "Экипаж",
        options: ["С экипажем", "Без экипажа"],
        dependsOn: {
          field: "rentalObjectType",
          value: "Транспортное средство",
        },
      },
      {
        name: "vehicleTerritory",
        type: "text",
        required: false,
        label: "Территория эксплуатации ТС",
        defaultValue: "Республика Казахстан",
        dependsOn: {
          field: "rentalObjectType",
          value: "Транспортное средство",
        },
      },
      {
        name: "equipmentName",
        type: "text",
        required: false,
        label: "Наименование оборудования",
        dependsOn: { field: "rentalObjectType", value: "Оборудование" },
      },
      {
        name: "equipmentSerial",
        type: "text",
        required: false,
        label: "Заводской номер",
        dependsOn: { field: "rentalObjectType", value: "Оборудование" },
      },
      {
        name: "equipmentYear",
        type: "number",
        required: false,
        label: "Год выпуска оборудования",
        dependsOn: { field: "rentalObjectType", value: "Оборудование" },
      },
      {
        name: "equipmentCondition",
        type: "text",
        required: false,
        label: "Техническое состояние",
        dependsOn: { field: "rentalObjectType", value: "Оборудование" },
      },
      {
        name: "equipmentPurpose",
        type: "text",
        required: false,
        label: "Цель использования оборудования",
        dependsOn: { field: "rentalObjectType", value: "Оборудование" },
      },
      // === Contract Configuration ===
      {
        name: "subleasePolicy",
        type: "select",
        required: true,
        label: "Политика субаренды",
        options: [
          "Полный запрет",
          "С письменного согласия",
          "Свободно с уведомлением",
          "Без ограничений",
        ],
      },
      {
        name: "subleaseNotifyDays",
        type: "number",
        required: false,
        label: "Срок уведомления о субаренде (дни)",
        defaultValue: 10,
        dependsOn: {
          field: "subleasePolicy",
          value: "Свободно с уведомлением",
        },
      },
      {
        name: "landlordRepairScope",
        type: "select",
        required: true,
        label: "Ремонт арендодателя",
        options: ["Все виды ремонта", "Только капитальный"],
      },
      {
        name: "tenantRepairScope",
        type: "select",
        required: true,
        label: "Ремонт арендатора",
        options: ["Все виды ремонта", "Только текущий"],
      },
      {
        name: "utilityCostBearer",
        type: "select",
        required: true,
        label: "Коммунальные расходы несёт",
        options: ["Арендодатель", "Арендатор"],
      },
      {
        name: "insuranceBearer",
        type: "select",
        required: true,
        label: "Страхование обеспечивает",
        options: ["Арендодатель", "Арендатор"],
      },
      {
        name: "improvementsCompensation",
        type: "boolean",
        required: true,
        label: "Компенсация неотделимых улучшений",
        defaultValue: true,
      },
      {
        name: "returnCostBearer",
        type: "select",
        required: true,
        label: "Расходы на возврат объекта",
        options: ["Арендодатель", "Арендатор", "По соглашению сторон"],
      },
      // === Payment ===
      {
        name: "rentAmount",
        type: "text",
        required: true,
        label: "Сумма арендной платы",
      },
      {
        name: "paymentSchedule",
        type: "select",
        required: true,
        label: "График оплаты",
        options: [
          "Авансом",
          "Единовременно",
          "В рассрочку",
          "В конце месяца",
          "В следующем месяце",
        ],
      },
      {
        name: "paymentDay",
        type: "number",
        required: false,
        label: "Число месяца для оплаты",
        dependsOn: {
          field: "paymentSchedule",
          value: ["Авансом", "В рассрочку", "В следующем месяце"],
          operator: "in",
        },
      },
      {
        name: "paymentBankDays",
        type: "number",
        required: false,
        label: "Банковских дней для единовременной оплаты",
        dependsOn: { field: "paymentSchedule", value: "Единовременно" },
      },
      {
        name: "rentIncreaseFrequency",
        type: "text",
        required: true,
        label: "Периодичность повышения арендной платы",
        defaultValue: "1 раз в год",
      },
      {
        name: "maxRentIncreasePercent",
        type: "number",
        required: true,
        label: "Макс. повышение арендной платы (%)",
        defaultValue: 10,
      },
      {
        name: "firstIncreaseDelay",
        type: "text",
        required: true,
        label: "Первое повышение не ранее чем через",
        defaultValue: "12 месяцев",
      },
      // === Liability ===
      {
        name: "penaltyRate",
        type: "number",
        required: true,
        label: "Неустойка за просрочку (% в день)",
        defaultValue: 0.1,
      },
      {
        name: "maxPenaltyPercent",
        type: "number",
        required: true,
        label: "Максимальная неустойка (%)",
        defaultValue: 10,
      },
      {
        name: "thirdPartyLiabilityDays",
        type: "number",
        required: false,
        label: "Срок компенсации убытков третьих лиц (дни)",
        defaultValue: 10,
        dependsOn: {
          field: "rentalObjectType",
          value: "Транспортное средство",
        },
      },
      {
        name: "riskBearer",
        type: "select",
        required: true,
        label: "Риск случайной гибели несёт",
        options: ["Арендатор", "Арендодатель"],
      },
      // === Term ===
      {
        name: "leaseStartDate",
        type: "date",
        required: true,
        label: "Дата начала аренды",
      },
      {
        name: "leaseEndDate",
        type: "date",
        required: true,
        label: "Дата окончания аренды",
      },
      {
        name: "noticePeriodDays",
        type: "number",
        required: true,
        label: "Срок уведомления о расторжении (дни)",
        defaultValue: 30,
        wordForms: ["календарный день", "календарных дня", "календарных дней"],
      },
      {
        name: "returnPeriodDays",
        type: "number",
        required: true,
        label: "Срок возврата объекта (дни)",
        defaultValue: 5,
        wordForms: ["календарный день", "календарных дня", "календарных дней"],
      },
      {
        name: "prolongation",
        type: "select",
        required: true,
        label: "Пролонгация",
        options: [
          "Однократная",
          "Автоматическая без ограничений",
          "Не предусмотрена",
        ],
      },
      {
        name: "prolongationNoticeDays",
        type: "number",
        required: false,
        label: "Уведомление о прекращении при автопролонгации (дни)",
        defaultValue: 30,
        wordForms: ["день", "дня", "дней"],
        dependsOn: {
          field: "prolongation",
          value: "Автоматическая без ограничений",
        },
      },
      {
        name: "preferentialRight",
        type: "boolean",
        required: true,
        label: "Преимущественное право на новый срок",
        defaultValue: true,
      },
      // === Transfer ===
      {
        name: "transferDays",
        type: "number",
        required: true,
        label: "Срок передачи объекта (дни)",
        defaultValue: 5,
        wordForms: ["календарный день", "календарных дня", "календарных дней"],
      },
      {
        name: "hiddenDefectDays",
        type: "number",
        required: true,
        label: "Срок уведомления о скрытых недостатках (дни)",
        defaultValue: 5,
        wordForms: ["рабочий день", "рабочих дня", "рабочих дней"],
      },
      // === Force Majeure ===
      {
        name: "forceMajeureNotifyDays",
        type: "number",
        required: true,
        label: "Уведомление о форс-мажоре (дни)",
        defaultValue: 3,
        wordForms: ["календарный день", "календарных дня", "календарных дней"],
      },
      {
        name: "forceMajeureDurationMonths",
        type: "number",
        required: true,
        label: "Длительность форс-мажора для расторжения (мес.)",
        defaultValue: 6,
      },
      {
        name: "forceMajeureTermNoticeDays",
        type: "number",
        required: true,
        label: "Уведомление о расторжении при форс-мажоре (дни)",
        defaultValue: 30,
        wordForms: ["рабочий день", "рабочих дня", "рабочих дней"],
      },
      // === Особые условия ===
      {
        name: "specialConditionsOption",
        type: "select",
        required: false,
        label: "Особые условия",
        options: ["Заполнить особые условия", "Без особых условий"],
      },
      {
        name: "specialConditionsText",
        type: "textarea",
        required: false,
        label: "Текст особых условий",
        dependsOn: {
          field: "specialConditionsOption",
          value: "Заполнить особые условия",
        },
      },
    ],
    typstContent: `#set document(title: "Договор аренды")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: true)

#align(center)[
  #text(size: 16pt, weight: "bold")[ДОГОВОР АРЕНДЫ]
]

#v(0.5em)

#grid(
  columns: (1fr, 1fr),
  align(left)[г. {{city}}],
  align(right)[{{contractDate}}]
)

#v(1em)

// === ПРЕАМБУЛА: АРЕНДОДАТЕЛЬ ===
#if "{{landlordType}}" == "Юридическое лицо" [
  {{landlordCompanyName}}, в лице {{landlordPosition}} {{landlordFIO}}, #if "{{landlordGender}}" == "Женский" [действующей] else [действующего] на основании #if "{{landlordAuthDocType}}" == "Доверенность" [Доверенности №{{landlordProxyNumber}} от {{landlordProxyDate}} сроком до {{landlordProxyValidUntil}}] else if "{{landlordAuthDocType}}" == "Иной документ" [{{landlordOtherDocName}} от {{landlordOtherDocDate}}] else [Устава], БИН {{landlordBIN}}, именуемое в дальнейшем «Арендодатель» с одной стороны,
] else if "{{landlordType}}" == "ИП" [
  ИП {{landlordIPName}}, в лице {{landlordPosition}} {{landlordFIO}}, #if "{{landlordGender}}" == "Женский" [действующей] else [действующего] на основании #if "{{landlordAuthDocTypeIP}}" == "Талон" [Талона №{{landlordTalonNumber}}, «{{landlordTalonOrgName}}», {{landlordTalonDate}}, входящий регистрационный номер уведомления {{landlordTalonRegNumber}}] else [Доверенности №{{landlordIPProxyNumber}} от {{landlordIPProxyDate}} сроком до {{landlordIPProxyValidUntil}}], ИИН {{landlordIIN}}, #if "{{landlordGender}}" == "Женский" [именуемая] else [именуемый] в дальнейшем «Арендодатель» с одной стороны,
] else [
  {{landlordFIO}}, ИИН {{landlordIIN}}, #if "{{landlordGender}}" == "Женский" [именуемая] else [именуемый] в дальнейшем «Арендодатель» с одной стороны,
]

и

// === ПРЕАМБУЛА: АРЕНДАТОР ===
#if "{{tenantType}}" == "Юридическое лицо" [
  {{tenantCompanyName}}, в лице {{tenantPosition}} {{tenantFIO}}, #if "{{tenantGender}}" == "Женский" [действующей] else [действующего] на основании #if "{{tenantAuthDocType}}" == "Доверенность" [Доверенности №{{tenantProxyNumber}} от {{tenantProxyDate}} сроком до {{tenantProxyValidUntil}}] else if "{{tenantAuthDocType}}" == "Иной документ" [{{tenantOtherDocName}} от {{tenantOtherDocDate}}] else [Устава], БИН {{tenantBIN}}, именуемое в дальнейшем «Арендатор» с другой стороны,
] else if "{{tenantType}}" == "ИП" [
  ИП {{tenantIPName}}, в лице {{tenantPosition}} {{tenantFIO}}, #if "{{tenantGender}}" == "Женский" [действующей] else [действующего] на основании #if "{{tenantAuthDocTypeIP}}" == "Талон" [Талона №{{tenantTalonNumber}}, «{{tenantTalonOrgName}}», {{tenantTalonDate}}, входящий регистрационный номер уведомления {{tenantTalonRegNumber}}] else [Доверенности №{{tenantIPProxyNumber}} от {{tenantIPProxyDate}} сроком до {{tenantIPProxyValidUntil}}], ИИН {{tenantIIN}}, #if "{{tenantGender}}" == "Женский" [именуемая] else [именуемый] в дальнейшем «Арендатор» с другой стороны,
] else [
  {{tenantFIO}}, ИИН {{tenantIIN}}, #if "{{tenantGender}}" == "Женский" [именуемая] else [именуемый] в дальнейшем «Арендатор» с другой стороны,
]

Арендодатель и Арендатор определены все вместе как «Стороны» и индивидуально как «Сторона», заключили настоящий Договор аренды (далее — Договор) о нижеследующем:

#v(0.5em)

// ============================================================
// 1. ПРЕДМЕТ ДОГОВОРА
// ============================================================
== 1. Предмет договора

1.1. Арендодатель обязуется предоставить, а Арендатор принять во временное возмездное владение и пользование:
#if "{{rentalObjectType}}" == "Офис" [
  офисное помещение, расположенное по адресу: {{objectAddress}}, общей площадью {{objectArea}} кв.м (далее — Объект), предназначенное для использования в целях размещения офиса Арендатора.
] else if "{{rentalObjectType}}" == "Квартира" [
  квартиру, расположенную по адресу: {{objectAddress}}, общей площадью {{objectArea}} кв.м, состоящую из {{roomCount}} комнат(ы), с принадлежащими ей помещениями (кухня, санузел, подсобные помещения и иное) (далее — Объект), для использования в целях проживания.
] else if "{{rentalObjectType}}" == "Земельный участок" [
  земельный участок площадью {{objectArea}} кв.м, кадастровый номер {{cadastralNumber}}, расположенный по адресу: {{objectAddress}} (далее — Объект), предоставляемый для целей {{landPurpose}}.
] else if "{{rentalObjectType}}" == "Транспортное средство" [
  транспортное средство: марка {{vehicleMake}}, модель {{vehicleModel}}, государственный регистрационный номер {{vehicleRegNumber}}, год выпуска {{vehicleYear}}, идентификационный номер (VIN) {{vehicleVIN}} (далее — Объект), предоставляемое #if "{{vehicleCrew}}" == "С экипажем" [с экипажем] else [без экипажа].
] else [
  оборудование (техника): наименование {{equipmentName}}, заводской номер {{equipmentSerial}}, год выпуска {{equipmentYear}}, техническое состояние: {{equipmentCondition}} (далее — Объект), предоставляемое для использования в целях {{equipmentPurpose}}.
]

1.2. Объект аренды передаётся Арендатору по акту приёма-передачи в срок, установленный настоящим Договором.

1.3. Объект аренды соответствует требованиям законодательства Республики Казахстан, техническим нормам и обеспечивает возможность его использования по целевому назначению.

1.4. Технические характеристики, комплектность и состояние передаваемого в аренду Объекта указаны в Приложении к настоящему Договору и являются его неотъемлемой частью.

// === 1.5. Субаренда ===
#if "{{subleasePolicy}}" == "Полный запрет" [
  1.5. Арендатор не вправе сдавать полученный в аренду Объект в субаренду.
] else if "{{subleasePolicy}}" == "С письменного согласия" [
  1.5. Арендатор вправе передавать Объект аренды или его часть в субаренду исключительно при наличии предварительного письменного согласия Арендодателя.
] else if "{{subleasePolicy}}" == "Свободно с уведомлением" [
  1.5. Арендатор вправе по своему усмотрению передавать Объект аренды или его часть в субаренду третьим лицам при условии письменного уведомления Арендодателя не позднее чем за {{subleaseNotifyDays}} рабочих дней до фактической передачи.
] else [
  1.5. Арендатор вправе без согласия и уведомления Арендодателя сдавать Объект аренды или его часть в субаренду третьим лицам на любых условиях.
]

1.6. Объект аренды предоставляется вместе с перечнем имущества, указанным в Приложении к настоящему Договору.

1.7. На момент заключения настоящего Договора Объект аренды принадлежит Арендодателю на праве собственности (либо на ином законном праве, позволяющем сдавать его в аренду), не обременён правами третьих лиц, не находится под арестом и не является предметом судебных или иных споров.

// === 1.8. Условные пункты по типу объекта ===
#if "{{rentalObjectType}}" == "Офис" [
  1.8. Арендатор в течение срока аренды имеет право пользоваться площадями общего пользования, в той мере, в которой это необходимо в связи с арендой Объекта, на общих основаниях и в соответствии с правилами и указаниями по их использованию, которые время от времени могут устанавливаться Арендодателем.
] else if "{{rentalObjectType}}" == "Транспортное средство" [
  1.8. Стороны определили местом эксплуатации ТС территорию {{vehicleTerritory}}.

  #if "{{vehicleCrew}}" == "С экипажем" [
    1.9. В течение всего срока аренды управление арендованным транспортным средством и его техническая эксплуатация обеспечиваются Арендодателем своими силами через экипаж транспортного средства. Арендатор отвечает за использование транспортного средства в коммерческих целях в соответствии с Договором.
  ] else [
    1.9. В течение всего срока аренды Арендатор своими силами и за свой счёт обеспечивает управление арендованным транспортным средством и его надлежащую техническую и коммерческую эксплуатацию.
  ]
] else if "{{rentalObjectType}}" == "Оборудование" [
  1.8. Арендодатель подтверждает, что передаваемое в аренду Оборудование введено в законный оборот, свободно от ограничений, препятствующих его эксплуатации, и снабжено всей необходимой технической и эксплуатационной документацией, а также обязательными разрешительными документами (при их наличии).
]

#v(0.5em)

// ============================================================
// 2. ПРАВА И ОБЯЗАННОСТИ СТОРОН
// ============================================================
== 2. Права и обязанности сторон

*2.1. Арендодатель обязуется:*

2.1.1. передать Арендатору Объект аренды в состоянии, пригодном для использования по назначению, с принадлежностями и документами, необходимыми для его эксплуатации;

2.1.2. не препятствовать Арендатору в пользовании Объектом аренды в пределах, установленных настоящим Договором и законодательством;

2.1.3. нести ответственность за скрытые недостатки Объекта аренды, которые препятствуют его использованию, даже если такие недостатки не были известны Арендодателю на момент передачи;

// === 2.1.4. Ремонт арендодателя ===
#if "{{landlordRepairScope}}" == "Все виды ремонта" [
  2.1.4. производить все виды ремонта (текущий и капитальный) за свой счёт;
] else [
  2.1.4. производить капитальный ремонт за свой счёт;
]

// === 2.1.5. Коммунальные расходы ===
#if "{{utilityCostBearer}}" == "Арендодатель" [
  2.1.5. самостоятельно и за свой счёт оплачивать коммунальные услуги и эксплуатационные расходы, связанные с использованием Объекта аренды;
]

// === 2.1.6. Страхование ===
#if "{{insuranceBearer}}" == "Арендодатель" [
  2.1.6. застраховать Объект аренды (или свою ответственность) на весь срок действия Договора;
]

// === 2.1.7. Улучшения ===
#if {{improvementsCompensation}} [
  2.1.7. возместить Арендатору в пределах фактически понесённых расходов стоимость произведённых в соответствии с условиями настоящего Договора и действующего законодательства неотделимых улучшений Объекта после прекращения Договора и возврата Объекта;
]

// === 2.1.8. ТС с экипажем — дополнительные обязанности арендодателя ===
#if "{{rentalObjectType}}" == "Транспортное средство" [
  #if "{{vehicleCrew}}" == "С экипажем" [
    2.1.8. обязуется своими силами и за свой счёт обеспечивать уплату сборов и иных платежей, связанных с использованием транспортного средства, а также оплату услуг и содержание экипажа;
  ]
]

*2.2. Арендодатель вправе:*

- получать арендную плату в размерах и сроки, установленные Договором;
- проверять сохранность Объекта аренды, условия его использования и техническое состояние без вмешательства в хозяйственную деятельность Арендатора;
- требовать возмещения убытков и/или неустойки при нарушении условий Договора Арендатором;
- требовать возврата Объекта аренды в состоянии, предусмотренном Договором и законом;
- расторгнуть Договор в случаях, прямо установленных ГК РК и Договором.

#v(0.3em)

*2.3. Арендатор обязуется:*

- пользоваться Объектом аренды исключительно в целях, указанных в настоящем Договоре;
- обеспечивать сохранность Объекта аренды, бережно относиться к нему, поддерживать его в надлежащем состоянии;
- возвратить Объект аренды по окончании срока действия Договора в состоянии, в котором он был получен, с учётом нормального износа;
- незамедлительно уведомлять Арендодателя о неисправностях, повреждениях или обстоятельствах, препятствующих нормальной эксплуатации Объекта аренды;

// === 2.3.4. Ремонт арендатора ===
#if "{{tenantRepairScope}}" == "Все виды ремонта" [
  - производить все виды ремонта (текущий и капитальный) за свой счёт;
] else [
  - производить текущий ремонт за свой счёт;
]

// === 2.3.5. Коммунальные расходы ===
#if "{{utilityCostBearer}}" == "Арендатор" [
  - самостоятельно и за свой счёт оплачивать коммунальные услуги и эксплуатационные расходы, связанные с использованием Объекта аренды;
]

// === 2.3.6. Страхование ===
#if "{{insuranceBearer}}" == "Арендатор" [
  - застраховать Объект аренды (или свою ответственность) на весь срок действия Договора;
]

// === ТС с экипажем — доп. обязанности арендатора ===
#if "{{rentalObjectType}}" == "Транспортное средство" [
  #if "{{vehicleCrew}}" == "С экипажем" [
    - обязуется своими силами и за свой счёт обеспечивать уплату сборов и иных платежей, связанных с использованием транспортного средства;
    - возместить Арендодателю причинённые убытки, если Арендодатель докажет, что гибель или повреждение транспортного средства произошли по обстоятельствам, за которые Арендатор отвечает в соответствии с законодательными актами или Договором;
  ]
]

*2.4. Арендатор вправе:*

- пользоваться Объектом аренды в течение всего срока Договора в соответствии с его назначением и условиями Договора;
- требовать от Арендодателя передачи Объекта аренды в пригодном для использования состоянии;
- требовать проведения капитального ремонта Объекта аренды;
- требовать уменьшения арендной платы при невозможности использования Объекта аренды по обстоятельствам, не зависящим от Арендатора;
- требовать возмещения стоимости согласованных и произведённых неотделимых улучшений Объекта аренды;
- по своему выбору потребовать от Арендодателя: безвозмездно устранить недостатки имущества; соразмерно уменьшить арендную плату; удержать сумму понесённых расходов по устранению недостатков из арендной платы, предварительно уведомив Арендодателя; досрочного расторжения Договора.

#v(0.5em)

// ============================================================
// 3. ПОРЯДОК ПЕРЕДАЧИ, ПРИЁМКИ И ВОЗВРАТА ОБЪЕКТА АРЕНДЫ
// ============================================================
== 3. Порядок передачи, приёмки и возврата Объекта аренды

3.1. Передача Объекта аренды осуществляется в течение {{transferDays}} {{transferDaysWord}} с даты подписания настоящего Договора, если иные сроки не установлены Сторонами.

3.2. Передача оформляется Актом приёма-передачи Объекта аренды (Приложение к настоящему Договору), подписываемым обеими Сторонами.

3.3. В Акте фиксируется:
- техническое и/или физическое состояние Объекта аренды;
- сведения о принадлежностях, комплектности, документах;
- состояние основных элементов (коммуникации, узлы, механизмы, счётчики, пробег ТС, дата последнего ТО и пр.);
- перечень выявленных недостатков и их характер.

3.4. Стороны вправе приложить к Договору: фотофиксацию состояния Объекта аренды; опись имущества и принадлежностей; показания приборов учёта.

3.5. В случае выявления скрытых недостатков Арендатор обязан уведомить Арендодателя в течение {{hiddenDefectDays}} {{hiddenDefectDaysWord}} с момента обнаружения.

3.6. По окончании срока действия Договора либо его досрочном прекращении Арендатор обязан возвратить Объект аренды в течение {{returnPeriodDays}} {{returnPeriodDaysWord}} с даты прекращения Договора.

3.7. Возврат оформляется Актом возврата Объекта аренды, подписываемым обеими Сторонами.

3.8. При возврате фиксируется: состояние Объекта аренды с учётом нормального износа; наличие всех принадлежностей и документов; показания счётчиков / пробег / состояние узлов и механизмов.

3.9. В случае ухудшения состояния Объекта аренды сверх нормального износа, отсутствия принадлежностей или документов Арендатор возмещает Арендодателю причинённый ущерб.

3.10. Уклонение Арендатора от подписания Акта возврата расценивается как неисполнение обязанности по возврату Объекта аренды.

3.11. Уклонение Арендодателя от подписания Акта возврата расценивается как отказ от приёмки Объекта аренды. В этом случае Арендатор вправе составить односторонний Акт возврата с приложением доказательств передачи.

// === 3.12. Расходы на возврат ===
3.12. Все расходы, связанные с возвратом Объекта аренды (включая транспортировку, демонтаж, оформление документации),
#if "{{returnCostBearer}}" == "Арендодатель" [
  несёт Арендодатель.
] else if "{{returnCostBearer}}" == "Арендатор" [
  несёт Арендатор.
] else [
  распределяются между Сторонами в соответствии с дополнительным соглашением.
]

#v(0.5em)

// ============================================================
// 4. РАСЧЁТЫ
// ============================================================
== 4. Расчёты

4.1. Размер арендной платы составляет {{rentAmount}} в месяц.

// === 4.2. Порядок оплаты ===
#if "{{paymentSchedule}}" == "Авансом" [
  4.2. Арендатор обязан вносить арендную плату авансом не позднее {{paymentDay}} числа месяца, предшествующего оплачиваемому периоду.
] else if "{{paymentSchedule}}" == "Единовременно" [
  4.2. Арендатор обязан уплатить арендную плату в полном размере единовременно, в течение {{paymentBankDays}} банковских дней с даты подписания настоящего Договора.
] else if "{{paymentSchedule}}" == "В рассрочку" [
  4.2. Арендатор уплачивает арендную плату частями, в размере и с периодичностью, определёнными Приложением к настоящему Договору, но не позднее {{paymentDay}} числа оплачиваемого периода.
] else if "{{paymentSchedule}}" == "В конце месяца" [
  4.2. Арендатор обязан внести арендную плату не позднее последнего календарного дня оплачиваемого месяца.
] else [
  4.2. Арендатор обязан внести арендную плату не позднее {{paymentDay}} числа месяца, следующего за оплачиваемым.
]

4.3. Оплата арендной платы осуществляется путём безналичного перечисления денежных средств на расчётный счёт Арендодателя, указанный в настоящем Договоре.

4.4. Датой оплаты по настоящему Договору считается дата зачисления денежных средств на расчётный счёт Арендодателя.

4.5. Арендная плата начинает начисляться с момента передачи Объекта аренды Арендатору (дата подписания акта приёма-передачи) и прекращает начисляться с момента возврата Объекта аренды Арендодателю (дата подписания акта возврата), но не ранее чем с момента прекращения Договора.

4.6. Арендатор вправе внести сумму арендной платы досрочно.

4.7. Арендодатель вправе в одностороннем порядке увеличивать размер арендной платы, но не чаще чем {{rentIncreaseFrequency}} и каждый раз не более чем на {{maxRentIncreasePercent}}% от первоначально установленного размера арендной платы. Первое увеличение размера арендной платы Арендодатель может осуществить не ранее чем через {{firstIncreaseDelay}} с момента заключения Договора.

4.8. Изменение размера арендной платы по соглашению Сторон допускается осуществлять с любой периодичностью.

4.9. В случае изменения тарифов за коммунальные услуги головными поставщиками этих услуг, Арендатор обязуется возмещать расходы Арендодателя на оплату этих услуг в изменённом размере без особого о том соглашения.

#v(0.5em)

// ============================================================
// 5. ОТВЕТСТВЕННОСТЬ СТОРОН
// ============================================================
== 5. Ответственность сторон

5.1. За неисполнение обязательств, предусмотренных Договором, Стороны несут ответственность в порядке, установленном законодательством Республики Казахстан.

5.2. За просрочку внесения арендной платы Арендатор уплачивает пеню в размере {{penaltyRate}}% за каждый день просрочки, но не более {{maxPenaltyPercent}}% от суммы просроченного платежа.

5.3. Уплата штрафных санкций (пеня, неустойка) не освобождает Стороны от исполнения обязательств в полном объёме.

5.4. При досрочном расторжении Договора по вине одной из Сторон виновная Сторона обязана возместить другой Стороне документально подтверждённые убытки.

// === 5.5. Ответственность за ТС перед третьими лицами ===
#if "{{rentalObjectType}}" == "Транспортное средство" [
  5.5. Арендатор обязуется самостоятельно нести ответственность за вред, причинённый им третьим лицам при использовании или ненадлежащем использовании ТС. В случае предъявления таких требований к Арендодателю и если Арендодатель будет вынужден удовлетворить данные требования, Арендатор обязан компенсировать понесённые Арендодателем расходы в течение {{thirdPartyLiabilityDays}} дней с момента предъявления требования о компенсации.
]

// === 5.6. Риск случайной гибели ===
#if "{{riskBearer}}" == "Арендатор" [
  5.6. Риск случайной гибели и повреждения Объекта аренды с момента его передачи по акту приёма-передачи несёт Арендатор, за исключением случаев, когда гибель или повреждение произошли по вине Арендодателя.
] else [
  5.6. Риск случайной гибели и повреждения Объекта аренды до окончания срока аренды сохраняется за Арендодателем, за исключением случаев умышленных действий или грубой неосторожности Арендатора.
]

#v(0.5em)

// ============================================================
// 6. СРОК ДЕЙСТВИЯ, ПОРЯДОК ИЗМЕНЕНИЯ И РАСТОРЖЕНИЯ ДОГОВОРА
// ============================================================
== 6. Срок действия, порядок изменения и расторжения Договора

6.1. Арендодатель передаёт Объект во временное пользование Арендатору на срок с {{leaseStartDate}} по {{leaseEndDate}}.

6.2. Договор аренды может быть расторгнут в любое время по взаимному письменному соглашению Сторон.

6.3. Договор аренды может быть расторгнут по иным основаниям, прямо предусмотренным Гражданским кодексом Республики Казахстан и иными законодательными актами.

6.4. Сторона, инициирующая расторжение, обязана уведомить другую Сторону за срок не менее {{noticePeriodDays}} {{noticePeriodDaysWord}}.

6.5. Арендатор обязан в срок не позднее {{returnPeriodDays}} {{returnPeriodDaysWord}} с даты прекращения Договора возвратить Объект аренды по акту приёма-передачи.

6.6. Обязательства Сторон по уплате начисленных арендных платежей, неустоек, возмещению убытков и расходов, возникших до даты расторжения, сохраняют силу до их полного исполнения.

// === 6.7. Пролонгация ===
#if "{{prolongation}}" == "Однократная" [
  6.7. Срок действия Договора может быть продлён (пролонгирован) один раз на срок, равный первоначальному сроку аренды, при условии письменного согласия обеих Сторон.
] else if "{{prolongation}}" == "Автоматическая без ограничений" [
  6.7. Договор подлежит автоматической пролонгации на каждый последующий аналогичный срок, если ни одна из Сторон не заявит о прекращении его действия за {{prolongationNoticeDays}} {{prolongationNoticeDaysWord}} до окончания очередного срока.
] else [
  6.7. Пролонгация срока действия настоящего Договора не допускается. По окончании установленного срока Договор прекращает своё действие.
]

// === 6.8. Преимущественное право ===
#if {{preferentialRight}} [
  6.8. Арендатор, исполнявший свои обязательства надлежащим образом, имеет по истечении срока аренды преимущественное перед другими лицами право на заключение договора аренды на новый срок на условиях, согласованных Сторонами.
] else [
  6.8. Арендатор не имеет преимущественного права на заключение договора аренды на новый срок. По окончании срока аренды Договор прекращает своё действие.
]

#v(0.5em)

// ============================================================
// 7. ПРОЧИЕ УСЛОВИЯ
// ============================================================
== 7. Прочие условия

7.1. Стороны обязуются соблюдать конфиденциальность при проведении коммерческих операций и не разглашать информацию, связанную с исполнением обязательств по данному Договору.

7.2. Стороны освобождаются от частичного или полного исполнения обязательств по настоящему Договору, если невозможность их исполнения явилась следствием обстоятельств непреодолимой силы, возникших после заключения настоящего Договора в результате событий чрезвычайного характера, которые Стороны не могли ни предвидеть, ни предотвратить разумными мерами.

7.3. Сторона, для которой создалась невозможность исполнения обязательств (форс-мажор) по настоящему Договору, должна письменно в течение {{forceMajeureNotifyDays}} {{forceMajeureNotifyDaysWord}} известить об этом другую Сторону и представить доказательства наступления подобных обстоятельств.

7.4. В случае возникновения обстоятельств непреодолимой силы срок выполнения обязательств по настоящему Договору отодвигается соразмерно времени, в течение которого действуют эти обстоятельства и их последствия. В случае, если форс-мажор продолжается более {{forceMajeureDurationMonths}} календарных месяцев после его наступления, любая из Сторон вправе прервать действие настоящего Договора, письменно уведомив об этом другую Сторону не позднее чем за {{forceMajeureTermNoticeDays}} рабочих дней, при этом Арендодатель обязуется незамедлительно возвратить Арендатору в полном объёме сумму неиспользованной части арендной платы.

7.5. Настоящий Договор составляет и выражает все договорные условия и понимание между участвующими здесь Сторонами в отношении всех упомянутых здесь вопросов, при этом все предыдущие обсуждения, обещания и представления между Сторонами, если таковые имелись, теряют силу.

7.6. Договор заключён и подписан уполномоченными представителями Сторон, имеющими все необходимые и достаточные полномочия для заключения и подписания Договора.

7.7. Арендодатель гарантирует Арендатору, что Объект передаётся в аренду с соблюдением положений законодательства Республики Казахстан.

7.8. Договор составлен в 2-х экземплярах, на русском языке, каждый из которых обладает одинаковой юридической силой.

7.9. Все изменения и дополнения к Договору оформляются в письменной форме и подписываются обеими Сторонами.

#v(0.5em)

// ============================================================
// 8. ОСОБЫЕ УСЛОВИЯ
// ============================================================
#if "{{specialConditionsOption}}" == "Заполнить особые условия" [
  == 8. Особые условия

  {{specialConditionsText}}

  #v(0.5em)
] else if "{{specialConditionsOption}}" != "Без особых условий" [
  == 8. Особые условия

  #v(0.3em)
  #line(length: 100%)
  #v(0.3em)
  #line(length: 100%)

  #v(0.5em)
]

// ============================================================
// 9. ЮРИДИЧЕСКИЕ АДРЕСА И ПОДПИСИ СТОРОН
// ============================================================
== 9. Юридические адреса и подписи сторон

#v(1em)

#grid(
  columns: (1fr, 1fr),
  gutter: 2em,
  [
    *«АРЕНДОДАТЕЛЬ»*
    #v(0.5em)
    #if "{{landlordType}}" == "Юридическое лицо" [
      {{landlordCompanyName}}\\
      БИН: {{landlordBIN}}\\
    ] else if "{{landlordType}}" == "ИП" [
      ИП {{landlordFIO}}\\
      ИИН: {{landlordIIN}}\\
    ] else [
      {{landlordFIO}}\\
      ИИН: {{landlordIIN}}\\
    ]
    #v(1.5em)
    #line(length: 80%)
    Подпись / ФИО
  ],
  [
    *«АРЕНДАТОР»*
    #v(0.5em)
    #if "{{tenantType}}" == "Юридическое лицо" [
      {{tenantCompanyName}}\\
      БИН: {{tenantBIN}}\\
    ] else if "{{tenantType}}" == "ИП" [
      ИП {{tenantFIO}}\\
      ИИН: {{tenantIIN}}\\
    ] else [
      {{tenantFIO}}\\
      ИИН: {{tenantIIN}}\\
    ]
    #v(1.5em)
    #line(length: 80%)
    Подпись / ФИО
  ]
)
`,
  },
  {
    id: "tpl_service_agreement_kz",
    title: "Договор оказания услуг (Казахстан)",
    description:
      "Договор возмездного оказания услуг для Казахстана. Поддерживает выбор типа сторон (юр. лицо, ИП, физ. лицо), различные режимы оказания услуг, варианты оплаты и гарантии качества.",
    price: 4999,
    currentVersion: 1,
    isPublished: true,
    variables: [
      // === General ===
      {
        name: "city",
        type: "text",
        required: true,
        label: "Город",
        defaultValue: "Алматы",
      },
      {
        name: "contractDate",
        type: "date",
        required: true,
        label: "Дата договора",
      },
      // === Client (Заказчик) ===
      {
        name: "clientType",
        type: "select",
        required: true,
        label: "Тип заказчика",
        options: ["Юридическое лицо", "ИП", "Физическое лицо"],
      },
      {
        name: "clientCompanyName",
        type: "text",
        required: false,
        label: "Наименование компании заказчика",
        dependsOn: { field: "clientType", value: "Юридическое лицо" },
      },
      {
        name: "clientIPName",
        type: "text",
        required: false,
        label: "Наименование ИП заказчика",
        dependsOn: { field: "clientType", value: "ИП" },
      },
      {
        name: "clientPosition",
        type: "text",
        required: false,
        label: "Должность представителя заказчика",
        dependsOn: {
          field: "clientType",
          value: ["Юридическое лицо", "ИП"],
          operator: "in",
        },
      },
      {
        name: "clientFIO",
        type: "text",
        required: true,
        label: "ФИО заказчика",
      },
      {
        name: "clientGender",
        type: "select",
        required: false,
        label: "Пол представителя заказчика",
        options: ["Мужской", "Женский"],
      },
      {
        name: "clientAuthDocType",
        type: "select",
        required: false,
        label: "Документ-основание (Заказчик, юрлицо)",
        options: ["Устав", "Доверенность", "Иной документ"],
        dependsOn: { field: "clientType", value: "Юридическое лицо" },
      },
      {
        name: "clientProxyNumber",
        type: "text",
        required: false,
        label: "№ доверенности (Заказчик)",
        dependsOn: { field: "clientAuthDocType", value: "Доверенность" },
      },
      {
        name: "clientProxyDate",
        type: "date",
        required: false,
        label: "Дата выдачи доверенности (Заказчик)",
        dependsOn: { field: "clientAuthDocType", value: "Доверенность" },
      },
      {
        name: "clientProxyValidUntil",
        type: "date",
        required: false,
        label: "Срок действия доверенности (Заказчик)",
        dependsOn: { field: "clientAuthDocType", value: "Доверенность" },
      },
      {
        name: "clientOtherDocName",
        type: "text",
        required: false,
        label: "Название документа (Заказчик)",
        dependsOn: { field: "clientAuthDocType", value: "Иной документ" },
      },
      {
        name: "clientOtherDocDate",
        type: "date",
        required: false,
        label: "Дата документа (Заказчик)",
        dependsOn: { field: "clientAuthDocType", value: "Иной документ" },
      },
      {
        name: "clientAuthDocTypeIP",
        type: "select",
        required: false,
        label: "Документ-основание (Заказчик, ИП)",
        options: ["Доверенность", "Талон"],
        dependsOn: { field: "clientType", value: "ИП" },
      },
      {
        name: "clientIPProxyNumber",
        type: "text",
        required: false,
        label: "№ доверенности (Заказчик, ИП)",
        dependsOn: { field: "clientAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "clientIPProxyDate",
        type: "date",
        required: false,
        label: "Дата выдачи доверенности (Заказчик, ИП)",
        dependsOn: { field: "clientAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "clientIPProxyValidUntil",
        type: "date",
        required: false,
        label: "Срок действия доверенности (Заказчик, ИП)",
        dependsOn: { field: "clientAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "clientTalonNumber",
        type: "text",
        required: false,
        label: "№ талона (Заказчик)",
        dependsOn: { field: "clientAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "clientTalonOrgName",
        type: "text",
        required: false,
        label: "Наименование принимающей организации (Заказчик)",
        dependsOn: { field: "clientAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "clientTalonDate",
        type: "date",
        required: false,
        label: "Дата талона (Заказчик)",
        dependsOn: { field: "clientAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "clientTalonRegNumber",
        type: "text",
        required: false,
        label: "Входящий рег. номер уведомления (Заказчик)",
        dependsOn: { field: "clientAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "clientBIN",
        type: "text",
        required: false,
        label: "БИН заказчика",
        dependsOn: { field: "clientType", value: "Юридическое лицо" },
      },
      {
        name: "clientIIN",
        type: "text",
        required: false,
        label: "ИИН заказчика",
        dependsOn: {
          field: "clientType",
          value: ["ИП", "Физическое лицо"],
          operator: "in",
        },
      },
      // === Contractor (Исполнитель) ===
      {
        name: "contractorType",
        type: "select",
        required: true,
        label: "Тип исполнителя",
        options: ["Юридическое лицо", "ИП", "Физическое лицо"],
      },
      {
        name: "contractorCompanyName",
        type: "text",
        required: false,
        label: "Наименование компании исполнителя",
        dependsOn: { field: "contractorType", value: "Юридическое лицо" },
      },
      {
        name: "contractorIPName",
        type: "text",
        required: false,
        label: "Наименование ИП исполнителя",
        dependsOn: { field: "contractorType", value: "ИП" },
      },
      {
        name: "contractorPosition",
        type: "text",
        required: false,
        label: "Должность представителя исполнителя",
        dependsOn: {
          field: "contractorType",
          value: ["Юридическое лицо", "ИП"],
          operator: "in",
        },
      },
      {
        name: "contractorFIO",
        type: "text",
        required: true,
        label: "ФИО исполнителя",
      },
      {
        name: "contractorGender",
        type: "select",
        required: false,
        label: "Пол представителя исполнителя",
        options: ["Мужской", "Женский"],
      },
      {
        name: "contractorAuthDocType",
        type: "select",
        required: false,
        label: "Документ-основание (Исполнитель, юрлицо)",
        options: ["Устав", "Доверенность", "Иной документ"],
        dependsOn: { field: "contractorType", value: "Юридическое лицо" },
      },
      {
        name: "contractorProxyNumber",
        type: "text",
        required: false,
        label: "№ доверенности (Исполнитель)",
        dependsOn: { field: "contractorAuthDocType", value: "Доверенность" },
      },
      {
        name: "contractorProxyDate",
        type: "date",
        required: false,
        label: "Дата выдачи доверенности (Исполнитель)",
        dependsOn: { field: "contractorAuthDocType", value: "Доверенность" },
      },
      {
        name: "contractorProxyValidUntil",
        type: "date",
        required: false,
        label: "Срок действия доверенности (Исполнитель)",
        dependsOn: { field: "contractorAuthDocType", value: "Доверенность" },
      },
      {
        name: "contractorOtherDocName",
        type: "text",
        required: false,
        label: "Название документа (Исполнитель)",
        dependsOn: { field: "contractorAuthDocType", value: "Иной документ" },
      },
      {
        name: "contractorOtherDocDate",
        type: "date",
        required: false,
        label: "Дата документа (Исполнитель)",
        dependsOn: { field: "contractorAuthDocType", value: "Иной документ" },
      },
      {
        name: "contractorAuthDocTypeIP",
        type: "select",
        required: false,
        label: "Документ-основание (Исполнитель, ИП)",
        options: ["Доверенность", "Талон"],
        dependsOn: { field: "contractorType", value: "ИП" },
      },
      {
        name: "contractorIPProxyNumber",
        type: "text",
        required: false,
        label: "№ доверенности (Исполнитель, ИП)",
        dependsOn: { field: "contractorAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "contractorIPProxyDate",
        type: "date",
        required: false,
        label: "Дата выдачи доверенности (Исполнитель, ИП)",
        dependsOn: { field: "contractorAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "contractorIPProxyValidUntil",
        type: "date",
        required: false,
        label: "Срок действия доверенности (Исполнитель, ИП)",
        dependsOn: { field: "contractorAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "contractorTalonNumber",
        type: "text",
        required: false,
        label: "№ талона (Исполнитель)",
        dependsOn: { field: "contractorAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "contractorTalonOrgName",
        type: "text",
        required: false,
        label: "Наименование принимающей организации (Исполнитель)",
        dependsOn: { field: "contractorAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "contractorTalonDate",
        type: "date",
        required: false,
        label: "Дата талона (Исполнитель)",
        dependsOn: { field: "contractorAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "contractorTalonRegNumber",
        type: "text",
        required: false,
        label: "Входящий рег. номер уведомления (Исполнитель)",
        dependsOn: { field: "contractorAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "contractorBIN",
        type: "text",
        required: false,
        label: "БИН исполнителя",
        dependsOn: { field: "contractorType", value: "Юридическое лицо" },
      },
      {
        name: "contractorIIN",
        type: "text",
        required: false,
        label: "ИИН исполнителя",
        dependsOn: {
          field: "contractorType",
          value: ["ИП", "Физическое лицо"],
          operator: "in",
        },
      },
      // === 1. Subject of Agreement ===
      {
        name: "serviceDescription",
        type: "text",
        required: true,
        label: "Описание услуг",
      },
      {
        name: "executionMode",
        type: "select",
        required: true,
        label: "Режим оказания услуг",
        options: [
          "Лично",
          "Лично с возможностью привлечения",
          "С правом привлечения третьих лиц",
        ],
      },
      {
        name: "servicePlace",
        type: "text",
        required: true,
        label: "Место оказания услуг",
      },
      {
        name: "serviceType",
        type: "select",
        required: true,
        label: "Тип услуг",
        options: ["Разовые услуги", "По графику", "По заявкам"],
      },
      {
        name: "serviceStartDate",
        type: "date",
        required: false,
        label: "Дата начала оказания услуг",
        dependsOn: { field: "serviceType", value: "Разовые услуги" },
      },
      {
        name: "serviceEndDate",
        type: "date",
        required: false,
        label: "Дата окончания оказания услуг",
        dependsOn: { field: "serviceType", value: "Разовые услуги" },
      },
      {
        name: "scheduleAppendix",
        type: "text",
        required: false,
        label: "Номер приложения с графиком",
        defaultValue: "2",
        dependsOn: { field: "serviceType", value: "По графику" },
      },
      {
        name: "applicationConfirmDays",
        type: "number",
        required: false,
        label: "Срок подтверждения заявки (дни)",
        defaultValue: 3,
        wordForms: ["рабочий день", "рабочих дня", "рабочих дней"],
        dependsOn: { field: "serviceType", value: "По заявкам" },
      },
      {
        name: "earlyDelivery",
        type: "select",
        required: true,
        label: "Досрочное оказание услуг",
        options: ["С согласия Заказчика", "Разрешено", "Запрещено"],
      },
      // === 2. Cost and Payment ===
      {
        name: "serviceAmount",
        type: "text",
        required: true,
        label: "Стоимость услуг",
      },
      {
        name: "isVatPayer",
        type: "boolean",
        required: true,
        label: "Исполнитель является плательщиком НДС",
        defaultValue: false,
      },
      {
        name: "materialsSource",
        type: "select",
        required: true,
        label: "Источник материалов",
        options: ["Исполнителя", "Заказчика", "Смешанный", "Не применимо"],
      },
      {
        name: "additionalExpenses",
        type: "select",
        required: true,
        label: "Дополнительные расходы",
        options: ["Включены в стоимость", "Оплачиваются отдельно"],
      },
      {
        name: "paymentType",
        type: "select",
        required: true,
        label: "Тип оплаты",
        options: [
          "Постоплата",
          "Предоплата",
          "Частичная предоплата",
          "Поэтапная оплата",
        ],
      },
      {
        name: "prepaymentDays",
        type: "number",
        required: false,
        label: "Срок предоплаты (банковских дней)",
        defaultValue: 5,
        dependsOn: { field: "paymentType", value: "Предоплата" },
      },
      {
        name: "advancePercent",
        type: "number",
        required: false,
        label: "Размер аванса (%)",
        defaultValue: 50,
        dependsOn: { field: "paymentType", value: "Частичная предоплата" },
      },
      // === 4. Obligations ===
      {
        name: "defectRemedy",
        type: "select",
        required: true,
        label: "Устранение недостатков",
        options: ["Заказчик устраняет", "Исполнитель устраняет"],
      },
      // === 5. Liability ===
      {
        name: "penaltyRate",
        type: "text",
        required: true,
        label: "Неустойка за просрочку (% в день)",
        defaultValue: "0,1",
      },
      {
        name: "materialRiskBearer",
        type: "select",
        required: true,
        label: "Риск повреждения материалов",
        options: ["Исполнитель", "Заказчик", "Смешанный"],
      },
      // === 6. Termination ===
      {
        name: "terminationNoticeDays",
        type: "number",
        required: true,
        label: "Срок уведомления о расторжении (дни)",
        defaultValue: 30,
        wordForms: ["календарный день", "календарных дня", "календарных дней"],
      },
      // === 7. Term ===
      {
        name: "contractStartDate",
        type: "date",
        required: true,
        label: "Дата начала действия договора",
      },
      {
        name: "contractEndDate",
        type: "date",
        required: true,
        label: "Дата окончания действия договора",
      },
      // === 8. Additional conditions ===
      {
        name: "disputeResolutionDays",
        type: "number",
        required: true,
        label: "Срок досудебного урегулирования (дни)",
        defaultValue: 15,
        wordForms: ["календарный день", "календарных дня", "календарных дней"],
      },
      {
        name: "disputeJurisdiction",
        type: "select",
        required: true,
        label: "Подсудность споров",
        options: [
          "По месту нахождения Заказчика",
          "По месту нахождения Исполнителя",
        ],
      },
      // === Особые условия ===
      {
        name: "specialConditionsOption",
        type: "select",
        required: false,
        label: "Особые условия",
        options: ["Заполнить особые условия", "Без особых условий"],
      },
      {
        name: "specialConditionsText",
        type: "textarea",
        required: false,
        label: "Текст особых условий",
        dependsOn: {
          field: "specialConditionsOption",
          value: "Заполнить особые условия",
        },
      },
    ],
    typstContent: `#set document(title: "Договор возмездного оказания услуг")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: true)

#align(center)[
  #text(size: 16pt, weight: "bold")[ДОГОВОР ВОЗМЕЗДНОГО ОКАЗАНИЯ УСЛУГ]
]

#v(0.5em)

#grid(
  columns: (1fr, 1fr),
  align(left)[г. {{city}}],
  align(right)[{{contractDate}}]
)

#v(1em)

// === ПРЕАМБУЛА: ЗАКАЗЧИК ===
#if "{{clientType}}" == "Юридическое лицо" [
  {{clientCompanyName}}, в лице {{clientPosition}} {{clientFIO}}, #if "{{clientGender}}" == "Женский" [действующей] else [действующего] на основании #if "{{clientAuthDocType}}" == "Доверенность" [Доверенности №{{clientProxyNumber}} от {{clientProxyDate}} сроком до {{clientProxyValidUntil}}] else if "{{clientAuthDocType}}" == "Иной документ" [{{clientOtherDocName}} от {{clientOtherDocDate}}] else [Устава], БИН {{clientBIN}}, именуемое в дальнейшем «Заказчик» с одной стороны,
] else if "{{clientType}}" == "ИП" [
  ИП {{clientIPName}}, в лице {{clientPosition}} {{clientFIO}}, #if "{{clientGender}}" == "Женский" [действующей] else [действующего] на основании #if "{{clientAuthDocTypeIP}}" == "Талон" [Талона №{{clientTalonNumber}}, «{{clientTalonOrgName}}», {{clientTalonDate}}, входящий регистрационный номер уведомления {{clientTalonRegNumber}}] else [Доверенности №{{clientIPProxyNumber}} от {{clientIPProxyDate}} сроком до {{clientIPProxyValidUntil}}], ИИН {{clientIIN}}, #if "{{clientGender}}" == "Женский" [именуемая] else [именуемый] в дальнейшем «Заказчик» с одной стороны,
] else [
  {{clientFIO}}, ИИН {{clientIIN}}, #if "{{clientGender}}" == "Женский" [именуемая] else [именуемый] в дальнейшем «Заказчик» с одной стороны,
]

и

// === ПРЕАМБУЛА: ИСПОЛНИТЕЛЬ ===
#if "{{contractorType}}" == "Юридическое лицо" [
  {{contractorCompanyName}}, в лице {{contractorPosition}} {{contractorFIO}}, #if "{{contractorGender}}" == "Женский" [действующей] else [действующего] на основании #if "{{contractorAuthDocType}}" == "Доверенность" [Доверенности №{{contractorProxyNumber}} от {{contractorProxyDate}} сроком до {{contractorProxyValidUntil}}] else if "{{contractorAuthDocType}}" == "Иной документ" [{{contractorOtherDocName}} от {{contractorOtherDocDate}}] else [Устава], БИН {{contractorBIN}}, именуемое в дальнейшем «Исполнитель» с другой стороны,
] else if "{{contractorType}}" == "ИП" [
  ИП {{contractorIPName}}, в лице {{contractorPosition}} {{contractorFIO}}, #if "{{contractorGender}}" == "Женский" [действующей] else [действующего] на основании #if "{{contractorAuthDocTypeIP}}" == "Талон" [Талона №{{contractorTalonNumber}}, «{{contractorTalonOrgName}}», {{contractorTalonDate}}, входящий регистрационный номер уведомления {{contractorTalonRegNumber}}] else [Доверенности №{{contractorIPProxyNumber}} от {{contractorIPProxyDate}} сроком до {{contractorIPProxyValidUntil}}], ИИН {{contractorIIN}}, #if "{{contractorGender}}" == "Женский" [именуемая] else [именуемый] в дальнейшем «Исполнитель» с другой стороны,
] else [
  {{contractorFIO}}, ИИН {{contractorIIN}}, #if "{{contractorGender}}" == "Женский" [именуемая] else [именуемый] в дальнейшем «Исполнитель» с другой стороны,
]

Заказчик и Исполнитель определены все вместе как «Стороны» и индивидуально как «Сторона», заключили настоящий Договор возмездного оказания услуг (далее — Договор) о нижеследующем:

#v(0.5em)

// ============================================================
// 1. ПРЕДМЕТ ДОГОВОРА
// ============================================================
== 1. Предмет договора

1.1. Исполнитель обязуется по заданию Заказчика оказать следующие услуги (далее — Услуги):

#block(inset: (left: 1em))[
  {{serviceDescription}}
]

а Заказчик обязуется принять и оплатить эти Услуги в порядке и на условиях, предусмотренных настоящим Договором.

1.2. Содержание, объём и требования к качеству Услуг определяются в Спецификации (Приложение №1 к настоящему Договору), являющейся его неотъемлемой частью.

// === 1.3. Режим оказания услуг ===
#if "{{executionMode}}" == "Лично" [
  1.3. Исполнитель обязан оказать Услуги лично, если иное не будет согласовано Сторонами в письменной форме.
] else if "{{executionMode}}" == "Лично с возможностью привлечения" [
  1.3. Исполнитель обязан оказать Услуги лично, если иное не будет согласовано Сторонами в письменной форме.
] else [
  1.3. Исполнитель вправе привлекать соисполнителей (субподрядчиков) для оказания Услуг по настоящему Договору, оставаясь ответственным перед Заказчиком за результат и качество оказания Услуг в полном объёме.
]

1.4. Место оказания Услуг: {{servicePlace}}.

// === 1.5. Тип услуг ===
#if "{{serviceType}}" == "Разовые услуги" [
  1.5. Услуга оказывается однократно. Срок оказания Услуг: с {{serviceStartDate}} по {{serviceEndDate}}.
] else if "{{serviceType}}" == "По графику" [
  1.5. Периодичность, объём и сроки оказания Услуг определяются в Графике оказания услуг (Приложение № {{scheduleAppendix}} к настоящему Договору), являющемся его неотъемлемой частью.
] else [
  1.5. Услуги оказываются на основании Заявок Заказчика. Исполнитель обязан подтвердить принятие Заявки в течение {{applicationConfirmDays}} {{applicationConfirmDaysWord}} с момента её получения. Содержание, объём и сроки оказания Услуг определяются в соответствии с согласованными Заявками.
]

// === 1.6. Досрочное оказание услуг ===
#if "{{earlyDelivery}}" == "С согласия Заказчика" [
  1.6. Исполнитель вправе оказать Услуги досрочно при условии предварительного письменного согласия Заказчика.
] else if "{{earlyDelivery}}" == "Разрешено" [
  1.6. Исполнитель вправе оказать Услуги досрочно без дополнительного согласования с Заказчиком.
] else [
  1.6. Оказание Услуг досрочно не допускается.
]

#v(0.5em)

// ============================================================
// 2. СТОИМОСТЬ И ПОРЯДОК РАСЧЁТОВ
// ============================================================
== 2. Стоимость и порядок расчётов

2.1. Стоимость Услуг по настоящему Договору составляет {{serviceAmount}} тенге.

#if {{isVatPayer}} [
  В том числе НДС в соответствии с действующим законодательством Республики Казахстан.
] else [
  НДС не облагается в связи с применением Исполнителем специального налогового режима.
]

// === 2.2. Материалы ===
#if "{{materialsSource}}" == "Исполнителя" [
  2.2. В стоимость Услуг включена стоимость необходимых материалов для оказания Услуги, приобретаемых Исполнителем.
] else if "{{materialsSource}}" == "Заказчика" [
  2.2. Необходимые для оказания Услуг материалы предоставляются Заказчиком. Стоимость материалов в цену Услуг не включена.
] else if "{{materialsSource}}" == "Смешанный" [
  2.2. В стоимость Услуг включена стоимость необходимых материалов, предоставляемых Исполнителем. Материалы, предоставляемые Заказчиком, в стоимость Услуг не включены и передаются по отдельному акту.
] else [
  2.2. Оказание Услуг по настоящему Договору не требует использования материалов.
]

// === 2.3. Дополнительные расходы ===
#if "{{additionalExpenses}}" == "Включены в стоимость" [
  2.3. Все дополнительные расходы Исполнителя, связанные с оказанием Услуг (транспортные, командировочные и иные), включены в стоимость Услуг.
] else [
  2.3. Дополнительные расходы Исполнителя, связанные с оказанием Услуг (транспортные, командировочные и иные), оплачиваются Заказчиком отдельно на основании документального подтверждения и предварительного согласования.
]

// === 2.4. Порядок оплаты ===
#if "{{paymentType}}" == "Постоплата" [
  2.4. Оплата Услуг производится в течение 10 (десяти) банковских дней после подписания обеими Сторонами Акта оказанных услуг.
] else if "{{paymentType}}" == "Предоплата" [
  2.4. Оплата Услуг производится в размере 100% (ста процентов) от стоимости Услуг в течение {{prepaymentDays}} банковских дней с даты подписания настоящего Договора.
] else if "{{paymentType}}" == "Частичная предоплата" [
  2.4. Заказчик уплачивает аванс в размере {{advancePercent}}% от стоимости Услуг в течение 5 (пяти) банковских дней с даты подписания Договора. Оставшаяся часть оплачивается в течение 10 (десяти) банковских дней после подписания обеими Сторонами Акта оказанных услуг.
] else [
  2.4. Оплата Услуг производится поэтапно в соответствии с этапами и суммами, указанными в Спецификации (Приложение №1 к настоящему Договору), на основании подписанных Сторонами Актов оказанных услуг по каждому этапу.
]

2.5. Оплата производится путём безналичного перечисления денежных средств на расчётный счёт Исполнителя, указанный в настоящем Договоре.

2.6. Датой оплаты считается дата зачисления денежных средств на расчётный счёт Исполнителя.

#v(0.5em)

// ============================================================
// 3. ГАРАНТИЯ КАЧЕСТВА
// ============================================================
== 3. Гарантия качества

3.1. Исполнитель гарантирует, что Услуги будут оказаны в полном объёме, качественно и в сроки, предусмотренные настоящим Договором.

3.2. Услуги должны соответствовать требованиям, указанным в Спецификации (Приложение №1), а также применимым стандартам и нормативным актам Республики Казахстан.

3.3. Результат оказания Услуг подтверждается Актом оказанных услуг, подписываемым обеими Сторонами.

3.4. Заказчик обязан рассмотреть Акт оказанных услуг и направить Исполнителю подписанный Акт либо мотивированный отказ от его подписания в течение 5 (пяти) рабочих дней с даты его получения.

3.5. В случае если Заказчик не подписал Акт и не направил мотивированный отказ в установленный срок, Услуги считаются принятыми без замечаний.

#v(0.5em)

// ============================================================
// 4. ОБЯЗАТЕЛЬСТВА СТОРОН
// ============================================================
== 4. Обязательства сторон

*4.1. Исполнитель обязуется:*

4.1.1. оказать Услуги надлежащего качества в полном объёме и в сроки, предусмотренные настоящим Договором;

4.1.2. незамедлительно информировать Заказчика о возникновении обстоятельств, препятствующих надлежащему оказанию Услуг;

4.1.3. по требованию Заказчика предоставлять информацию о ходе оказания Услуг;

4.1.4. обеспечить конфиденциальность информации, полученной от Заказчика в связи с исполнением Договора;

4.1.5. по завершении оказания Услуг передать Заказчику Акт оказанных услуг для подписания.

#v(0.3em)

*4.2. Заказчик обязуется:*

4.2.1. предоставить Исполнителю всю необходимую информацию, документы и материалы для надлежащего оказания Услуг;

4.2.2. оплатить Услуги в порядке и сроки, установленные настоящим Договором;

4.2.3. принять оказанные Услуги и подписать Акт оказанных услуг либо направить мотивированный отказ в установленный срок;

4.2.4. содействовать Исполнителю в оказании Услуг в мере, необходимой для их надлежащего выполнения.

#v(0.3em)

// === 4.3. Устранение недостатков ===
*4.3. Порядок устранения недостатков:*

#if "{{defectRemedy}}" == "Заказчик устраняет" [
  В случае обнаружения недостатков оказанных Услуг Заказчик вправе по своему выбору устранить недостатки собственными силами или с привлечением третьих лиц и потребовать от Исполнителя возмещения понесённых расходов на устранение таких недостатков.
] else [
  В случае обнаружения недостатков оказанных Услуг Исполнитель обязуется безвозмездно устранить выявленные недостатки в течение 5 (пяти) рабочих дней с момента получения мотивированной претензии Заказчика.
]

#v(0.5em)

// ============================================================
// 5. ОТВЕТСТВЕННОСТЬ СТОРОН
// ============================================================
== 5. Ответственность сторон

5.1. За неисполнение или ненадлежащее исполнение обязательств по настоящему Договору Стороны несут ответственность в соответствии с законодательством Республики Казахстан и условиями настоящего Договора.

5.2. За нарушение сроков оказания Услуг Исполнитель уплачивает Заказчику неустойку (пеню) в размере {{penaltyRate}}% от стоимости несвоевременно оказанных Услуг за каждый день просрочки.

5.3. За нарушение сроков оплаты Заказчик уплачивает Исполнителю неустойку (пеню) в размере {{penaltyRate}}% от суммы просроченного платежа за каждый день просрочки.

5.4. Уплата неустойки (пени) не освобождает Стороны от исполнения обязательств по настоящему Договору в полном объёме.

// === 5.5. Риск повреждения материалов ===
#if "{{materialRiskBearer}}" == "Исполнитель" [
  5.5. Риск случайной гибели или повреждения материалов, оборудования и иного имущества, используемого для оказания Услуг, несёт Исполнитель с момента их получения и до момента передачи результата Услуг Заказчику.
] else if "{{materialRiskBearer}}" == "Заказчик" [
  5.5. Риск случайной гибели или повреждения материалов, оборудования и иного имущества, переданного Заказчиком для оказания Услуг, несёт Заказчик, за исключением случаев умышленных действий или грубой неосторожности Исполнителя.
] else [
  5.5. Риск случайной гибели или повреждения материалов, предоставленных Заказчиком, несёт Заказчик. Риск случайной гибели или повреждения материалов, приобретённых Исполнителем, несёт Исполнитель. В случае гибели или повреждения материалов по вине одной из Сторон виновная Сторона возмещает другой Стороне понесённые убытки.
]

5.6. Стороны освобождаются от ответственности за неисполнение или ненадлежащее исполнение обязательств по настоящему Договору, если это явилось следствием обстоятельств непреодолимой силы (форс-мажор).

#v(0.5em)

// ============================================================
// 6. РАСТОРЖЕНИЕ И ИЗМЕНЕНИЕ ДОГОВОРА
// ============================================================
== 6. Расторжение и изменение Договора

6.1. Настоящий Договор может быть расторгнут по взаимному письменному соглашению Сторон.

6.2. Каждая из Сторон вправе в одностороннем порядке отказаться от исполнения настоящего Договора, уведомив другую Сторону в письменной форме не менее чем за {{terminationNoticeDays}} {{terminationNoticeDaysWord}} до предполагаемой даты расторжения.

6.3. Заказчик вправе отказаться от исполнения Договора при условии оплаты Исполнителю фактически понесённых расходов.

6.4. Исполнитель вправе отказаться от исполнения Договора лишь при условии полного возмещения Заказчику убытков.

6.5. Все изменения и дополнения к настоящему Договору действительны при условии, если они совершены в письменной форме и подписаны обеими Сторонами.

#v(0.5em)

// ============================================================
// 7. СРОК ДЕЙСТВИЯ ДОГОВОРА
// ============================================================
== 7. Срок действия Договора

7.1. Настоящий Договор вступает в силу с даты его подписания обеими Сторонами и действует до полного исполнения Сторонами своих обязательств.

7.2. Срок оказания Услуг: с {{contractStartDate}} по {{contractEndDate}}.

7.3. Истечение срока действия Договора не освобождает Стороны от ответственности за нарушение обязательств, допущенных в период действия Договора.

#v(0.5em)

// ============================================================
// 8. ДОПОЛНИТЕЛЬНЫЕ УСЛОВИЯ
// ============================================================
== 8. Дополнительные условия

8.1. Все споры и разногласия, возникающие между Сторонами по настоящему Договору или в связи с ним, разрешаются путём переговоров. Срок досудебного урегулирования составляет {{disputeResolutionDays}} {{disputeResolutionDaysWord}} с момента направления претензии.

8.2. В случае невозможности разрешения споров путём переговоров они подлежат рассмотрению в суде
#if "{{disputeJurisdiction}}" == "По месту нахождения Заказчика" [
  по месту нахождения Заказчика
] else [
  по месту нахождения Исполнителя
]
в соответствии с законодательством Республики Казахстан.

8.3. Стороны обязуются соблюдать конфиденциальность условий настоящего Договора и не раскрывать их третьим лицам без предварительного письменного согласия другой Стороны, за исключением случаев, предусмотренных законодательством.

8.4. Настоящий Договор составлен в 2 (двух) экземплярах на русском языке, по одному для каждой из Сторон, каждый из которых имеет одинаковую юридическую силу.

8.5. Приложения к настоящему Договору являются его неотъемлемой частью.

#v(0.5em)

// ============================================================
// ОСОБЫЕ УСЛОВИЯ
// ============================================================
#if "{{specialConditionsOption}}" == "Заполнить особые условия" [
  == Особые условия

  {{specialConditionsText}}

  #v(0.5em)
] else if "{{specialConditionsOption}}" != "Без особых условий" [
  == Особые условия

  #v(0.3em)
  #line(length: 100%)
  #v(0.3em)
  #line(length: 100%)

  #v(0.5em)
]

// ============================================================
// РЕКВИЗИТЫ И ПОДПИСИ СТОРОН
// ============================================================
== Реквизиты и подписи сторон

#v(1em)

#grid(
  columns: (1fr, 1fr),
  gutter: 2em,
  [
    *«ЗАКАЗЧИК»*
    #v(0.5em)
    #if "{{clientType}}" == "Юридическое лицо" [
      {{clientCompanyName}}\\
      БИН: {{clientBIN}}\\
    ] else if "{{clientType}}" == "ИП" [
      ИП {{clientFIO}}\\
      ИИН: {{clientIIN}}\\
    ] else [
      {{clientFIO}}\\
      ИИН: {{clientIIN}}\\
    ]
    #v(1.5em)
    #line(length: 80%)
    Подпись / ФИО
  ],
  [
    *«ИСПОЛНИТЕЛЬ»*
    #v(0.5em)
    #if "{{contractorType}}" == "Юридическое лицо" [
      {{contractorCompanyName}}\\
      БИН: {{contractorBIN}}\\
    ] else if "{{contractorType}}" == "ИП" [
      ИП {{contractorFIO}}\\
      ИИН: {{contractorIIN}}\\
    ] else [
      {{contractorFIO}}\\
      ИИН: {{contractorIIN}}\\
    ]
    #v(1.5em)
    #line(length: 80%)
    Подпись / ФИО
  ]
)
`,
  },
  {
    id: "tpl_supply_contract_kz",
    title: "Договор поставки (Казахстан)",
    description:
      "Договор поставки товаров между юридическими лицами и ИП в Казахстане. Поддерживает разовую и долгосрочную поставку, различные условия оплаты, доставки, упаковки и маркировки.",
    price: 5999,
    currentVersion: 1,
    isPublished: true,
    variables: [
      // === General ===
      {
        name: "city",
        type: "text",
        required: true,
        label: "Город",
        defaultValue: "Алматы",
      },
      {
        name: "contractDate",
        type: "date",
        required: true,
        label: "Дата договора",
      },
      // === Buyer ===
      {
        name: "buyerType",
        type: "select",
        required: true,
        label: "Тип покупателя",
        options: ["Юридическое лицо", "ИП", "Физическое лицо"],
      },
      {
        name: "buyerCompanyName",
        type: "text",
        required: false,
        label: "Наименование компании покупателя",
        dependsOn: { field: "buyerType", value: "Юридическое лицо" },
      },
      {
        name: "buyerIPName",
        type: "text",
        required: false,
        label: "Наименование ИП покупателя",
        dependsOn: { field: "buyerType", value: "ИП" },
      },
      {
        name: "buyerPosition",
        type: "text",
        required: false,
        label: "Должность представителя покупателя",
        dependsOn: { field: "buyerType", value: "Юридическое лицо" },
      },
      {
        name: "buyerFIO",
        type: "text",
        required: true,
        label: "ФИО представителя покупателя",
      },
      {
        name: "buyerGender",
        type: "select",
        required: false,
        label: "Пол представителя покупателя",
        options: ["Мужской", "Женский"],
      },
      {
        name: "buyerAuthDocType",
        type: "select",
        required: false,
        label: "Документ-основание (Покупатель, юрлицо)",
        options: ["Устав", "Доверенность", "Иной документ"],
        dependsOn: { field: "buyerType", value: "Юридическое лицо" },
      },
      {
        name: "buyerProxyNumber",
        type: "text",
        required: false,
        label: "№ доверенности (Покупатель)",
        dependsOn: { field: "buyerAuthDocType", value: "Доверенность" },
      },
      {
        name: "buyerProxyDate",
        type: "date",
        required: false,
        label: "Дата выдачи доверенности (Покупатель)",
        dependsOn: { field: "buyerAuthDocType", value: "Доверенность" },
      },
      {
        name: "buyerProxyValidUntil",
        type: "date",
        required: false,
        label: "Срок действия доверенности (Покупатель)",
        dependsOn: { field: "buyerAuthDocType", value: "Доверенность" },
      },
      {
        name: "buyerOtherDocName",
        type: "text",
        required: false,
        label: "Название документа (Покупатель)",
        dependsOn: { field: "buyerAuthDocType", value: "Иной документ" },
      },
      {
        name: "buyerOtherDocDate",
        type: "date",
        required: false,
        label: "Дата документа (Покупатель)",
        dependsOn: { field: "buyerAuthDocType", value: "Иной документ" },
      },
      {
        name: "buyerAuthDocTypeIP",
        type: "select",
        required: false,
        label: "Документ-основание (Покупатель, ИП)",
        options: ["Доверенность", "Талон"],
        dependsOn: { field: "buyerType", value: "ИП" },
      },
      {
        name: "buyerIPProxyNumber",
        type: "text",
        required: false,
        label: "№ доверенности (Покупатель, ИП)",
        dependsOn: { field: "buyerAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "buyerIPProxyDate",
        type: "date",
        required: false,
        label: "Дата выдачи доверенности (Покупатель, ИП)",
        dependsOn: { field: "buyerAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "buyerIPProxyValidUntil",
        type: "date",
        required: false,
        label: "Срок действия доверенности (Покупатель, ИП)",
        dependsOn: { field: "buyerAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "buyerTalonNumber",
        type: "text",
        required: false,
        label: "№ талона (Покупатель)",
        dependsOn: { field: "buyerAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "buyerTalonOrgName",
        type: "text",
        required: false,
        label: "Наименование принимающей организации (Покупатель)",
        dependsOn: { field: "buyerAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "buyerTalonDate",
        type: "date",
        required: false,
        label: "Дата талона (Покупатель)",
        dependsOn: { field: "buyerAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "buyerTalonRegNumber",
        type: "text",
        required: false,
        label: "Входящий рег. номер уведомления (Покупатель)",
        dependsOn: { field: "buyerAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "buyerBIN",
        type: "text",
        required: false,
        label: "БИН покупателя",
        dependsOn: { field: "buyerType", value: "Юридическое лицо" },
      },
      {
        name: "buyerIIN",
        type: "text",
        required: false,
        label: "ИИН покупателя",
        dependsOn: {
          field: "buyerType",
          value: ["ИП", "Физическое лицо"],
          operator: "in",
        },
      },
      // === Supplier ===
      {
        name: "supplierType",
        type: "select",
        required: true,
        label: "Тип поставщика",
        options: ["Юридическое лицо", "ИП", "Физическое лицо"],
      },
      {
        name: "supplierCompanyName",
        type: "text",
        required: false,
        label: "Наименование компании поставщика",
        dependsOn: { field: "supplierType", value: "Юридическое лицо" },
      },
      {
        name: "supplierIPName",
        type: "text",
        required: false,
        label: "Наименование ИП поставщика",
        dependsOn: { field: "supplierType", value: "ИП" },
      },
      {
        name: "supplierPosition",
        type: "text",
        required: false,
        label: "Должность представителя поставщика",
        dependsOn: { field: "supplierType", value: "Юридическое лицо" },
      },
      {
        name: "supplierFIO",
        type: "text",
        required: true,
        label: "ФИО представителя поставщика",
      },
      {
        name: "supplierGender",
        type: "select",
        required: false,
        label: "Пол представителя поставщика",
        options: ["Мужской", "Женский"],
      },
      {
        name: "supplierAuthDocType",
        type: "select",
        required: false,
        label: "Документ-основание (Поставщик, юрлицо)",
        options: ["Устав", "Доверенность", "Иной документ"],
        dependsOn: { field: "supplierType", value: "Юридическое лицо" },
      },
      {
        name: "supplierProxyNumber",
        type: "text",
        required: false,
        label: "№ доверенности (Поставщик)",
        dependsOn: { field: "supplierAuthDocType", value: "Доверенность" },
      },
      {
        name: "supplierProxyDate",
        type: "date",
        required: false,
        label: "Дата выдачи доверенности (Поставщик)",
        dependsOn: { field: "supplierAuthDocType", value: "Доверенность" },
      },
      {
        name: "supplierProxyValidUntil",
        type: "date",
        required: false,
        label: "Срок действия доверенности (Поставщик)",
        dependsOn: { field: "supplierAuthDocType", value: "Доверенность" },
      },
      {
        name: "supplierOtherDocName",
        type: "text",
        required: false,
        label: "Название документа (Поставщик)",
        dependsOn: { field: "supplierAuthDocType", value: "Иной документ" },
      },
      {
        name: "supplierOtherDocDate",
        type: "date",
        required: false,
        label: "Дата документа (Поставщик)",
        dependsOn: { field: "supplierAuthDocType", value: "Иной документ" },
      },
      {
        name: "supplierAuthDocTypeIP",
        type: "select",
        required: false,
        label: "Документ-основание (Поставщик, ИП)",
        options: ["Доверенность", "Талон"],
        dependsOn: { field: "supplierType", value: "ИП" },
      },
      {
        name: "supplierIPProxyNumber",
        type: "text",
        required: false,
        label: "№ доверенности (Поставщик, ИП)",
        dependsOn: { field: "supplierAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "supplierIPProxyDate",
        type: "date",
        required: false,
        label: "Дата выдачи доверенности (Поставщик, ИП)",
        dependsOn: { field: "supplierAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "supplierIPProxyValidUntil",
        type: "date",
        required: false,
        label: "Срок действия доверенности (Поставщик, ИП)",
        dependsOn: { field: "supplierAuthDocTypeIP", value: "Доверенность" },
      },
      {
        name: "supplierTalonNumber",
        type: "text",
        required: false,
        label: "№ талона (Поставщик)",
        dependsOn: { field: "supplierAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "supplierTalonOrgName",
        type: "text",
        required: false,
        label: "Наименование принимающей организации (Поставщик)",
        dependsOn: { field: "supplierAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "supplierTalonDate",
        type: "date",
        required: false,
        label: "Дата талона (Поставщик)",
        dependsOn: { field: "supplierAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "supplierTalonRegNumber",
        type: "text",
        required: false,
        label: "Входящий рег. номер уведомления (Поставщик)",
        dependsOn: { field: "supplierAuthDocTypeIP", value: "Талон" },
      },
      {
        name: "supplierBIN",
        type: "text",
        required: false,
        label: "БИН поставщика",
        dependsOn: { field: "supplierType", value: "Юридическое лицо" },
      },
      {
        name: "supplierIIN",
        type: "text",
        required: false,
        label: "ИИН поставщика",
        dependsOn: {
          field: "supplierType",
          value: ["ИП", "Физическое лицо"],
          operator: "in",
        },
      },
      // === 1. Subject ===
      {
        name: "goodsName",
        type: "text",
        required: true,
        label: "Наименование товара",
      },
      {
        name: "deliveryType",
        type: "select",
        required: true,
        label: "Тип поставки",
        options: [
          "Разовая",
          "Долгосрочная по графику",
          "Долгосрочная по заявкам",
        ],
      },
      {
        name: "appendixNumber",
        type: "text",
        required: false,
        label: "Номер приложения со спецификацией",
        defaultValue: "1",
        dependsOn: { field: "deliveryType", value: "Разовая" },
      },
      {
        name: "requestAdvanceDays",
        type: "number",
        required: false,
        label: "Дней для подачи заявки заранее",
        defaultValue: 10,
        wordForms: ["календарный день", "календарных дня", "календарных дней"],
        dependsOn: { field: "deliveryType", value: "Долгосрочная по заявкам" },
      },
      {
        name: "confirmationDays",
        type: "number",
        required: false,
        label: "Дней для подтверждения заявки",
        defaultValue: 3,
        wordForms: ["рабочий день", "рабочих дня", "рабочих дней"],
        dependsOn: { field: "deliveryType", value: "Долгосрочная по заявкам" },
      },
      {
        name: "requestMethod",
        type: "text",
        required: false,
        label: "Способ направления заявок",
        defaultValue: "электронная почта",
        dependsOn: { field: "deliveryType", value: "Долгосрочная по заявкам" },
      },
      {
        name: "changeCancellationDays",
        type: "number",
        required: false,
        label: "Дней для изменения/отмены заявки",
        defaultValue: 5,
        wordForms: ["рабочий день", "рабочих дня", "рабочих дней"],
        dependsOn: { field: "deliveryType", value: "Долгосрочная по заявкам" },
      },
      {
        name: "acknowledgmentDays",
        type: "number",
        required: false,
        label: "Дней для подтверждения получения заявки",
        defaultValue: 2,
        dependsOn: { field: "deliveryType", value: "Долгосрочная по заявкам" },
      },
      // === 2. Payment ===
      {
        name: "priceChangePolicy",
        type: "select",
        required: true,
        label: "Политика изменения цен",
        options: ["Не допускается", "По соглашению", "Одностороннее"],
      },
      {
        name: "priceNoticeCalendarDays",
        type: "number",
        required: false,
        label: "Дней уведомления об изменении цены",
        defaultValue: 30,
        dependsOn: { field: "priceChangePolicy", value: "Одностороннее" },
      },
      {
        name: "paymentType",
        type: "select",
        required: true,
        label: "Тип оплаты",
        options: ["Постоплата", "Предоплата"],
      },
      {
        name: "postpaymentBankDays",
        type: "number",
        required: false,
        label: "Банковских дней для постоплаты",
        defaultValue: 5,
        dependsOn: { field: "paymentType", value: "Постоплата" },
      },
      {
        name: "prepaymentPercent1",
        type: "number",
        required: false,
        label: "Первый платёж (%)",
        defaultValue: 50,
        dependsOn: { field: "paymentType", value: "Предоплата" },
      },
      {
        name: "prepaymentBankDays1",
        type: "number",
        required: false,
        label: "Банковских дней для первого платежа",
        defaultValue: 3,
        dependsOn: { field: "paymentType", value: "Предоплата" },
      },
      {
        name: "prepaymentPercent2",
        type: "number",
        required: false,
        label: "Второй платёж (%)",
        defaultValue: 50,
        dependsOn: { field: "paymentType", value: "Предоплата" },
      },
      {
        name: "prepaymentBankDays2",
        type: "number",
        required: false,
        label: "Банковских дней для второго платежа",
        defaultValue: 5,
        dependsOn: { field: "paymentType", value: "Предоплата" },
      },
      // === 3. Delivery Terms ===
      {
        name: "deliveryMoment",
        type: "text",
        required: true,
        label: "Момент исполнения обязанности по поставке",
        defaultValue: "момент передачи Товара Покупателю",
      },
      {
        name: "deliveryDeadline",
        type: "text",
        required: true,
        label: "Срок поставки",
      },
      {
        name: "acceptanceDeadline",
        type: "text",
        required: true,
        label: "Срок приёмки товара покупателем",
        defaultValue: "3 рабочих дня",
      },
      {
        name: "deliveryPlace",
        type: "text",
        required: true,
        label: "Место поставки",
      },
      {
        name: "deliveryDocuments",
        type: "text",
        required: true,
        label: "Сопроводительные документы",
        defaultValue: "товарная накладная, счёт-фактура, сертификат качества",
      },
      {
        name: "acceptanceClaimDays",
        type: "number",
        required: true,
        label: "Дней для предъявления претензий по качеству",
        defaultValue: 14,
      },
      {
        name: "transportChoice",
        type: "select",
        required: true,
        label: "Выбор транспорта",
        options: ["Определяется сторонами", "Определяет Поставщик"],
      },
      {
        name: "transportType",
        type: "text",
        required: false,
        label: "Вид транспорта",
        dependsOn: {
          field: "transportChoice",
          value: "Определяется сторонами",
        },
      },
      {
        name: "deliveryExpenses",
        type: "select",
        required: true,
        label: "Расходы по доставке несёт",
        options: ["Поставщик", "Покупатель"],
      },
      {
        name: "packagingType",
        type: "select",
        required: true,
        label: "Упаковка",
        options: ["По нормативу", "По спецификации", "Без упаковки"],
      },
      {
        name: "packagingCost",
        type: "select",
        required: true,
        label: "Стоимость упаковки",
        options: [
          "Включена в стоимость",
          "Оплачивается отдельно",
          "Возвратная тара",
        ],
      },
      {
        name: "returnTaraDays",
        type: "number",
        required: false,
        label: "Дней для возврата тары",
        defaultValue: 30,
        dependsOn: { field: "packagingCost", value: "Возвратная тара" },
      },
      {
        name: "returnTaraPenalty",
        type: "text",
        required: false,
        label: "Штраф за невозврат тары",
        defaultValue: "стоимость тары",
        dependsOn: { field: "packagingCost", value: "Возвратная тара" },
      },
      {
        name: "markingType",
        type: "select",
        required: true,
        label: "Маркировка",
        options: [
          "По законодательству РК",
          "По спецификации/ТУ",
          "По инструкции Покупателя",
          "Не требуется",
        ],
      },
      {
        name: "markingInstructionDays",
        type: "number",
        required: false,
        label: "Дней для предоставления инструкций по маркировке",
        defaultValue: 5,
        dependsOn: {
          field: "markingType",
          value: "По инструкции Покупателя",
        },
      },
      // === 4. Warranty ===
      {
        name: "warrantyProvided",
        type: "boolean",
        required: true,
        label: "Гарантия предоставляется",
        defaultValue: true,
      },
      {
        name: "warrantyPeriod",
        type: "text",
        required: false,
        label: "Гарантийный срок",
        defaultValue: "12 месяцев",
        dependsOn: { field: "warrantyProvided", value: true },
      },
      {
        name: "warrantyReplacementDays",
        type: "number",
        required: false,
        label: "Дней для замены по гарантии",
        defaultValue: 14,
        dependsOn: { field: "warrantyProvided", value: true },
      },
      // === 5. Liability ===
      {
        name: "supplierPenaltyRate",
        type: "text",
        required: true,
        label: "Неустойка поставщика (% за календарную неделю)",
        defaultValue: "0.5",
      },
      {
        name: "supplierPenaltyMax",
        type: "text",
        required: true,
        label: "Макс. неустойка поставщика",
        defaultValue: "10% от стоимости непоставленного Товара",
      },
      {
        name: "buyerPenaltyRate",
        type: "text",
        required: true,
        label: "Неустойка покупателя (% за календарный день)",
        defaultValue: "0.1",
      },
      {
        name: "buyerPenaltyMax",
        type: "text",
        required: true,
        label: "Макс. неустойка покупателя",
        defaultValue: "10% от суммы просроченного платежа",
      },
      // === 6. Termination ===
      {
        name: "terminationNoticePeriod",
        type: "text",
        required: true,
        label: "Срок уведомления о расторжении",
        defaultValue: "30 календарных дней",
      },
      // === 7. Confidentiality ===
      {
        name: "confidentialityYears",
        type: "number",
        required: true,
        label: "Срок конфиденциальности (лет)",
        defaultValue: 3,
      },
      // === 8. Force Majeure ===
      {
        name: "forceMajeureDuration",
        type: "text",
        required: true,
        label: "Длительность форс-мажора для расторжения",
        defaultValue: "6 месяцев",
      },
      {
        name: "forceMajeureNotifyDays",
        type: "number",
        required: true,
        label: "Дней для уведомления о форс-мажоре",
        defaultValue: 5,
      },
      // === 9. Term ===
      {
        name: "contractEndDate",
        type: "date",
        required: true,
        label: "Дата окончания договора",
      },
      {
        name: "autoRenewalEnabled",
        type: "boolean",
        required: true,
        label: "Автоматическая пролонгация",
        defaultValue: true,
      },
      // === Requisites: Buyer ===
      {
        name: "buyerAddress",
        type: "text",
        required: true,
        label: "Адрес покупателя",
      },
      {
        name: "buyerPhone",
        type: "text",
        required: true,
        label: "Телефон покупателя",
      },
      {
        name: "buyerIIK",
        type: "text",
        required: true,
        label: "ИИК покупателя",
      },
      {
        name: "buyerBankName",
        type: "text",
        required: true,
        label: "Банк покупателя",
      },
      {
        name: "buyerBIK",
        type: "text",
        required: true,
        label: "БИК покупателя",
      },
      {
        name: "buyerKBe",
        type: "text",
        required: true,
        label: "КБе покупателя",
      },
      // === Requisites: Supplier ===
      {
        name: "supplierAddress",
        type: "text",
        required: true,
        label: "Адрес поставщика",
      },
      {
        name: "supplierPhone",
        type: "text",
        required: true,
        label: "Телефон поставщика",
      },
      {
        name: "supplierIIK",
        type: "text",
        required: true,
        label: "ИИК поставщика",
      },
      {
        name: "supplierBankName",
        type: "text",
        required: true,
        label: "Банк поставщика",
      },
      {
        name: "supplierBIK",
        type: "text",
        required: true,
        label: "БИК поставщика",
      },
      {
        name: "supplierKBe",
        type: "text",
        required: true,
        label: "КБе поставщика",
      },
      // === Особые условия ===
      {
        name: "specialConditionsOption",
        type: "select",
        required: false,
        label: "Особые условия",
        options: ["Заполнить особые условия", "Без особых условий"],
      },
      {
        name: "specialConditionsText",
        type: "textarea",
        required: false,
        label: "Текст особых условий",
        dependsOn: {
          field: "specialConditionsOption",
          value: "Заполнить особые условия",
        },
      },
    ],
    typstContent: `#set document(title: "Договор поставки")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: true)

#align(center)[
  #text(size: 16pt, weight: "bold")[ДОГОВОР ПОСТАВКИ]
]

#v(0.5em)

#grid(
  columns: (1fr, 1fr),
  align(left)[г. {{city}}],
  align(right)[{{contractDate}}]
)

#v(1em)

// === ПРЕАМБУЛА: ПОКУПАТЕЛЬ ===
#if "{{buyerType}}" == "Юридическое лицо" [
  {{buyerCompanyName}}, в лице {{buyerPosition}} {{buyerFIO}}, #if "{{buyerGender}}" == "Женский" [действующей] else [действующего] на основании #if "{{buyerAuthDocType}}" == "Доверенность" [Доверенности №{{buyerProxyNumber}} от {{buyerProxyDate}} сроком до {{buyerProxyValidUntil}}] else if "{{buyerAuthDocType}}" == "Иной документ" [{{buyerOtherDocName}} от {{buyerOtherDocDate}}] else [Устава], БИН {{buyerBIN}}, именуемое в дальнейшем «Покупатель» с одной стороны,
] else if "{{buyerType}}" == "ИП" [
  ИП {{buyerIPName}}, в лице {{buyerPosition}} {{buyerFIO}}, #if "{{buyerGender}}" == "Женский" [действующей] else [действующего] на основании #if "{{buyerAuthDocTypeIP}}" == "Талон" [Талона №{{buyerTalonNumber}}, «{{buyerTalonOrgName}}», {{buyerTalonDate}}, входящий регистрационный номер уведомления {{buyerTalonRegNumber}}] else [Доверенности №{{buyerIPProxyNumber}} от {{buyerIPProxyDate}} сроком до {{buyerIPProxyValidUntil}}], ИИН {{buyerIIN}}, #if "{{buyerGender}}" == "Женский" [именуемая] else [именуемый] в дальнейшем «Покупатель» с одной стороны,
] else [
  {{buyerFIO}}, ИИН {{buyerIIN}}, #if "{{buyerGender}}" == "Женский" [именуемая] else [именуемый] в дальнейшем «Покупатель» с одной стороны,
]

и

// === ПРЕАМБУЛА: ПОСТАВЩИК ===
#if "{{supplierType}}" == "Юридическое лицо" [
  {{supplierCompanyName}}, в лице {{supplierPosition}} {{supplierFIO}}, #if "{{supplierGender}}" == "Женский" [действующей] else [действующего] на основании #if "{{supplierAuthDocType}}" == "Доверенность" [Доверенности №{{supplierProxyNumber}} от {{supplierProxyDate}} сроком до {{supplierProxyValidUntil}}] else if "{{supplierAuthDocType}}" == "Иной документ" [{{supplierOtherDocName}} от {{supplierOtherDocDate}}] else [Устава], БИН {{supplierBIN}}, именуемое в дальнейшем «Поставщик» с другой стороны,
] else if "{{supplierType}}" == "ИП" [
  ИП {{supplierIPName}}, в лице {{supplierPosition}} {{supplierFIO}}, #if "{{supplierGender}}" == "Женский" [действующей] else [действующего] на основании #if "{{supplierAuthDocTypeIP}}" == "Талон" [Талона №{{supplierTalonNumber}}, «{{supplierTalonOrgName}}», {{supplierTalonDate}}, входящий регистрационный номер уведомления {{supplierTalonRegNumber}}] else [Доверенности №{{supplierIPProxyNumber}} от {{supplierIPProxyDate}} сроком до {{supplierIPProxyValidUntil}}], ИИН {{supplierIIN}}, #if "{{supplierGender}}" == "Женский" [именуемая] else [именуемый] в дальнейшем «Поставщик» с другой стороны,
] else [
  {{supplierFIO}}, ИИН {{supplierIIN}}, #if "{{supplierGender}}" == "Женский" [именуемая] else [именуемый] в дальнейшем «Поставщик» с другой стороны,
]

Покупатель и Поставщик определены все вместе как «Стороны» и индивидуально как «Сторона», заключили настоящий Договор поставки (далее — Договор) о нижеследующем:

#v(0.5em)

// ============================================================
// 1. ПРЕДМЕТ ДОГОВОРА
// ============================================================
== 1. Предмет договора

1.1. Поставщик обязуется передать в собственность Покупателя {{goodsName}} далее по тексту – «Товар», а Покупатель обязуется оплатить и принять Товар согласно условиям настоящего Договора.

#if "{{deliveryType}}" == "Разовая" [
  1.2. Подробная спецификация товаров, включая наименование, количество, ассортимент, комплектность, единицу измерения и цену за единицу, указываются в Приложении №{{appendixNumber}}, которое является неотъемлемой частью настоящего Договора.
] else if "{{deliveryType}}" == "Долгосрочная по графику" [
  1.2. Поставка Товара осуществляется партиями в соответствии с графиком поставки, являющимся Приложением к настоящему Договору.

  1.3. График поставки определяет наименование, количество, ассортимент, комплектность, единицу измерения, цену за единицу и сроки поставки каждой партии Товара.

  1.4. Изменение графика поставки допускается по письменному соглашению Сторон.
] else [
  1.2. Поставка Товара осуществляется отдельными партиями на основании заявок Покупателя.

  1.3. Заявка должна содержать: наименование, количество, ассортимент, комплектность, единицу измерения, цену за единицу и желаемый срок поставки.

  1.4. Покупатель направляет заявку Поставщику не позднее чем за {{requestAdvanceDays}} {{requestAdvanceDaysWord}} до желаемой даты поставки.

  1.5. Поставщик обязан подтвердить или отклонить заявку в течение {{confirmationDays}} {{confirmationDaysWord}} с момента её получения.

  1.6. Заявки направляются посредством: {{requestMethod}}.

  1.7. Покупатель вправе изменить или отменить заявку не позднее чем за {{changeCancellationDays}} {{changeCancellationDaysWord}} до согласованной даты поставки.

  1.8. Поставщик обязан направить подтверждение получения заявки в течение {{acknowledgmentDays}} рабочих дней с момента её получения.
]

#v(0.5em)

// ============================================================
// 2. ПОРЯДОК РАСЧЁТОВ
// ============================================================
== 2. Порядок расчётов

2.1. Цена Товара включает стоимость Товара, НДС (при наличии), транспортные расходы (если не оговорено иное), расходы на упаковку и таможенные платежи (при необходимости).

// === Политика изменения цен ===
#if "{{priceChangePolicy}}" == "Не допускается" [
  2.2. Одностороннее изменение цены Товара не допускается.
] else if "{{priceChangePolicy}}" == "По соглашению" [
  2.2. Изменение цены Товара допускается исключительно по взаимному письменному соглашению Сторон.
] else [
  2.2. Поставщик вправе в одностороннем порядке изменить цену Товара, уведомив Покупателя не менее чем за {{priceNoticeCalendarDays}} календарных дней до вступления новой цены в силу. В случае несогласия Покупателя с новой ценой Покупатель вправе расторгнуть Договор в порядке, предусмотренном настоящим Договором.
]

// === Тип оплаты ===
#if "{{paymentType}}" == "Постоплата" [
  2.3. Оплата Товара осуществляется Покупателем в течение {{postpaymentBankDays}} банковских дней с даты подписания товарной накладной (акта приёма-передачи).
] else [
  2.3. Оплата Товара осуществляется Покупателем в следующем порядке:
  - первый платёж в размере {{prepaymentPercent1}}% от стоимости Товара — в течение {{prepaymentBankDays1}} банковских дней с даты подписания настоящего Договора;
  - второй платёж в размере {{prepaymentPercent2}}% от стоимости Товара — в течение {{prepaymentBankDays2}} банковских дней с даты получения Товара и подписания товарной накладной.
]

// === Сумма оплаты в зависимости от типа поставки ===
#if "{{deliveryType}}" == "Разовая" [
  2.4. Общая сумма оплаты определяется в соответствии с Приложением к настоящему Договору.
] else if "{{deliveryType}}" == "Долгосрочная по графику" [
  2.4. Сумма оплаты каждой партии определяется в соответствии с графиком поставки.
] else [
  2.4. Сумма оплаты каждой партии определяется в соответствии с согласованной заявкой.
]

2.5. Оплата производится путём безналичного перечисления денежных средств на расчётный счёт Поставщика, указанный в настоящем Договоре.

2.6. Датой оплаты считается дата зачисления денежных средств на расчётный счёт Поставщика.

#v(0.5em)

// ============================================================
// 3. УСЛОВИЯ ПЕРЕДАЧИ ТОВАРА
// ============================================================
== 3. Условия передачи товара

3.1. Обязанность Поставщика по поставке Товара считается исполненной в {{deliveryMoment}}.

3.2. Срок поставки Товара: {{deliveryDeadline}}.

3.3. Покупатель обязан принять Товар в течение {{acceptanceDeadline}} с момента его поступления в место поставки.

3.4. Место поставки: {{deliveryPlace}}.

3.5. Товар сопровождается следующими документами: {{deliveryDocuments}}.

3.6. Претензии по качеству Товара могут быть предъявлены Покупателем в течение {{acceptanceClaimDays}} календарных дней с момента приёмки Товара.

// === Транспорт ===
#if "{{transportChoice}}" == "Определяется сторонами" [
  3.7. Доставка Товара осуществляется транспортом: {{transportType}}.
] else [
  3.7. Вид транспорта и условия доставки определяются Поставщиком самостоятельно.
]

// === Расходы по доставке ===
#if "{{deliveryExpenses}}" == "Поставщик" [
  3.8. Расходы по доставке Товара несёт Поставщик.
] else [
  3.8. Расходы по доставке Товара несёт Покупатель.
]

// === Упаковка ===
#if "{{packagingType}}" == "По нормативу" [
  3.9. Упаковка Товара должна соответствовать требованиям нормативно-правовых актов и технических стандартов, обеспечивая сохранность Товара при транспортировке и хранении.
] else if "{{packagingType}}" == "По спецификации" [
  3.9. Упаковка Товара осуществляется в соответствии со спецификацией, согласованной Сторонами.
] else [
  3.9. Товар поставляется без упаковки.
]

// === Стоимость упаковки ===
#if "{{packagingCost}}" == "Включена в стоимость" [
  3.10. Стоимость упаковки включена в цену Товара.
] else if "{{packagingCost}}" == "Оплачивается отдельно" [
  3.10. Стоимость упаковки оплачивается Покупателем отдельно.
] else [
  3.10. Тара является возвратной. Покупатель обязан возвратить тару Поставщику в течение {{returnTaraDays}} календарных дней с даты получения Товара. В случае невозврата тары Покупатель уплачивает Поставщику штраф в размере {{returnTaraPenalty}}.
]

// === Маркировка ===
#if "{{markingType}}" == "По законодательству РК" [
  3.11. Маркировка Товара осуществляется в соответствии с требованиями законодательства Республики Казахстан.
] else if "{{markingType}}" == "По спецификации/ТУ" [
  3.11. Маркировка Товара осуществляется в соответствии со спецификацией и/или техническими условиями.
] else if "{{markingType}}" == "По инструкции Покупателя" [
  3.11. Маркировка Товара осуществляется в соответствии с инструкцией Покупателя. Покупатель обязан предоставить инструкцию по маркировке не позднее чем за {{markingInstructionDays}} рабочих дней до даты отгрузки Товара.
] else [
  3.11. Специальная маркировка Товара не требуется.
]

#v(0.5em)

// ============================================================
// 4. МОМЕНТ ПЕРЕХОДА ПРАВА СОБСТВЕННОСТИ И ГАРАНТИЯ
// ============================================================
== 4. Момент перехода права собственности и гарантия

4.1. Право собственности на Товар переходит от Поставщика к Покупателю в момент передачи Товара Покупателю и подписания товарной накладной (акта приёма-передачи).

4.2. Риск случайной гибели или повреждения Товара переходит к Покупателю одновременно с переходом права собственности.

#if {{warrantyProvided}} [
  4.3. Поставщик предоставляет гарантию на Товар сроком {{warrantyPeriod}} с даты передачи Товара Покупателю.

  4.4. В случае обнаружения дефектов Товара в течение гарантийного срока Поставщик обязан за свой счёт произвести замену дефектного Товара в течение {{warrantyReplacementDays}} календарных дней с момента получения письменной претензии Покупателя.

  4.5. Гарантия не распространяется на дефекты, возникшие вследствие нарушения Покупателем правил хранения, транспортировки или эксплуатации Товара.
]

#v(0.5em)

// ============================================================
// 5. ОТВЕТСТВЕННОСТЬ СТОРОН
// ============================================================
== 5. Ответственность сторон

5.1. За неисполнение или ненадлежащее исполнение обязательств по настоящему Договору Стороны несут ответственность в соответствии с законодательством Республики Казахстан и условиями настоящего Договора.

5.2. В случае нарушения Поставщиком сроков поставки Товара Покупатель вправе потребовать уплаты неустойки в размере {{supplierPenaltyRate}}% от стоимости непоставленного в срок Товара за каждую календарную неделю просрочки, но не более {{supplierPenaltyMax}}.

5.3. В случае нарушения Покупателем сроков оплаты Товара Поставщик вправе потребовать уплаты неустойки в размере {{buyerPenaltyRate}}% от суммы просроченного платежа за каждый календарный день просрочки, но не более {{buyerPenaltyMax}}.

5.4. Уплата неустойки не освобождает Стороны от исполнения обязательств по настоящему Договору.

5.5. Сторона, не исполнившая или ненадлежащим образом исполнившая свои обязательства, обязана возместить другой Стороне причинённые этим убытки в части, не покрытой неустойкой.

#v(0.5em)

// ============================================================
// 6. УСЛОВИЯ РАСТОРЖЕНИЯ
// ============================================================
== 6. Условия расторжения

6.1. Настоящий Договор может быть расторгнут по взаимному письменному соглашению Сторон.

6.2. Каждая из Сторон вправе расторгнуть настоящий Договор в одностороннем порядке, уведомив другую Сторону не менее чем за {{terminationNoticePeriod}} до предполагаемой даты расторжения.

6.3. Поставщик вправе расторгнуть Договор в одностороннем порядке в случае:
- систематической (более двух раз) просрочки оплаты Товара Покупателем;
- отказа Покупателя от приёмки Товара без обоснованных причин.

6.4. Покупатель вправе расторгнуть Договор в одностороннем порядке в случае:
- систематического (более двух раз) нарушения Поставщиком сроков поставки;
- поставки Товара ненадлежащего качества и неустранения недостатков в согласованные сроки.

6.5. Расторжение Договора не освобождает Стороны от исполнения обязательств, возникших до даты расторжения.

#v(0.5em)

// ============================================================
// 7. КОНФИДЕНЦИАЛЬНОСТЬ
// ============================================================
== 7. Конфиденциальность

7.1. Стороны обязуются не разглашать конфиденциальную информацию, ставшую им известной в связи с исполнением настоящего Договора, третьим лицам без предварительного письменного согласия другой Стороны.

7.2. К конфиденциальной информации относятся: условия настоящего Договора, коммерческая и финансовая информация, техническая документация и иная информация, обозначенная Сторонами как конфиденциальная.

7.3. Обязательства по конфиденциальности сохраняют силу в течение {{confidentialityYears}} лет после прекращения действия настоящего Договора.

7.4. Обязательства по конфиденциальности не распространяются на информацию, которая:
- стала общедоступной не по вине получившей Стороны;
- была известна получившей Стороне до момента раскрытия;
- получена от третьих лиц на законных основаниях;
- подлежит раскрытию в соответствии с требованиями законодательства.

#v(0.5em)

// ============================================================
// 8. ФОРС-МАЖОР
// ============================================================
== 8. Форс-мажор

8.1. Стороны освобождаются от ответственности за частичное или полное неисполнение обязательств по настоящему Договору, если оно явилось следствием обстоятельств непреодолимой силы (форс-мажор), возникших после заключения Договора.

8.2. К обстоятельствам непреодолимой силы относятся: стихийные бедствия, пожары, наводнения, землетрясения, эпидемии, военные действия, забастовки, акты государственных органов и иные обстоятельства, которые Стороны не могли предвидеть и предотвратить разумными мерами.

8.3. Сторона, для которой создалась невозможность исполнения обязательств, обязана уведомить другую Сторону в письменной форме в течение {{forceMajeureNotifyDays}} календарных дней с момента наступления таких обстоятельств.

8.4. В случае если обстоятельства непреодолимой силы продолжаются более {{forceMajeureDuration}}, каждая из Сторон вправе расторгнуть настоящий Договор, уведомив другую Сторону в письменной форме.

8.5. Наступление обстоятельств непреодолимой силы подтверждается заключением уполномоченного органа (торгово-промышленная палата или иной компетентный орган).

#v(0.5em)

// ============================================================
// 9. СРОК ДЕЙСТВИЯ ДОГОВОРА
// ============================================================
== 9. Срок действия договора

9.1. Настоящий Договор вступает в силу с даты его подписания обеими Сторонами и действует до {{contractEndDate}}.

#if {{autoRenewalEnabled}} [
  9.2. Если ни одна из Сторон не заявит о прекращении Договора не позднее чем за 30 календарных дней до окончания срока его действия, Договор считается продлённым на каждый последующий аналогичный период на тех же условиях.
] else [
  9.2. Настоящий Договор не подлежит автоматической пролонгации. По истечении срока действия Договор прекращает своё действие.
]

9.3. Прекращение действия Договора не освобождает Стороны от исполнения обязательств, возникших в период его действия.

#v(0.5em)

// ============================================================
// 10. РАЗРЕШЕНИЕ СПОРОВ
// ============================================================
== 10. Разрешение споров

10.1. Все споры и разногласия, возникающие из настоящего Договора или в связи с ним, Стороны будут стремиться разрешить путём переговоров.

10.2. В случае невозможности разрешения споров путём переговоров споры подлежат рассмотрению в судебном порядке в соответствии с законодательством Республики Казахстан по месту нахождения ответчика.

10.3. Претензионный порядок урегулирования споров является обязательным. Срок рассмотрения претензии составляет 15 рабочих дней с момента её получения.

#v(0.5em)

// ============================================================
// 11. ДОПОЛНИТЕЛЬНЫЕ УСЛОВИЯ
// ============================================================
== 11. Дополнительные условия

11.1. Настоящий Договор составляет и выражает все договорные условия и понимание между Сторонами в отношении предмета настоящего Договора.

11.2. Все изменения и дополнения к настоящему Договору действительны при условии, если они совершены в письменной форме и подписаны уполномоченными представителями обеих Сторон.

11.3. Настоящий Договор составлен в 2 (двух) экземплярах на русском языке, по одному экземпляру для каждой из Сторон, каждый из которых имеет одинаковую юридическую силу.

11.4. Приложения к настоящему Договору являются его неотъемлемой частью.

11.5. Во всём, что не предусмотрено настоящим Договором, Стороны руководствуются действующим законодательством Республики Казахстан.

#v(0.5em)

// ============================================================
// 12. ОСОБЫЕ УСЛОВИЯ
// ============================================================
#if "{{specialConditionsOption}}" == "Заполнить особые условия" [
  == 12. Особые условия

  {{specialConditionsText}}

  #v(0.5em)
] else if "{{specialConditionsOption}}" != "Без особых условий" [
  == 12. Особые условия

  #v(0.3em)
  #line(length: 100%)
  #v(0.3em)
  #line(length: 100%)

  #v(0.5em)
]

// ============================================================
// РЕКВИЗИТЫ СТОРОН
// ============================================================
== Реквизиты и подписи сторон

#v(1em)

#grid(
  columns: (1fr, 1fr),
  gutter: 2em,
  [
    *«ПОКУПАТЕЛЬ»*
    #v(0.5em)
    #if "{{buyerType}}" == "Юридическое лицо" [
      {{buyerCompanyName}}\\
      БИН: {{buyerBIN}}\\
    ] else if "{{buyerType}}" == "ИП" [
      ИП {{buyerFIO}}\\
      ИИН: {{buyerIIN}}\\
    ] else [
      {{buyerFIO}}\\
      ИИН: {{buyerIIN}}\\
    ]
    Адрес: {{buyerAddress}}\\
    Тел.: {{buyerPhone}}\\
    ИИК: {{buyerIIK}}\\
    Банк: {{buyerBankName}}\\
    БИК: {{buyerBIK}}\\
    КБе: {{buyerKBe}}\\
    #v(1.5em)
    #line(length: 80%)
    {{buyerFIO}}
  ],
  [
    *«ПОСТАВЩИК»*
    #v(0.5em)
    #if "{{supplierType}}" == "Юридическое лицо" [
      {{supplierCompanyName}}\\
      БИН: {{supplierBIN}}\\
    ] else if "{{supplierType}}" == "ИП" [
      ИП {{supplierFIO}}\\
      ИИН: {{supplierIIN}}\\
    ] else [
      {{supplierFIO}}\\
      ИИН: {{supplierIIN}}\\
    ]
    Адрес: {{supplierAddress}}\\
    Тел.: {{supplierPhone}}\\
    ИИК: {{supplierIIK}}\\
    Банк: {{supplierBankName}}\\
    БИК: {{supplierBIK}}\\
    КБе: {{supplierKBe}}\\
    #v(1.5em)
    #line(length: 80%)
    {{supplierFIO}}
  ]
)
`,
  },
  {
    id: "tpl_prilozhenie_specifikaciya",
    title: "Приложение (спецификация) к договору",
    description:
      "Спецификация (приложение) к договору поставки: перечень поставляемых товаров с наименованием, количеством, ценой и суммой, реквизиты основного договора и подписи сторон. Используется как неотъемлемая часть договора поставки для согласования конкретной номенклатуры и стоимости товара.",
    price: 2490,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "city",
        type: "text",
        required: true,
        label: "Город составления",
        defaultValue: "Алматы",
      },
      {
        name: "appendixDate",
        type: "date",
        required: true,
        label: "Дата спецификации",
      },
      {
        name: "appendixNumber",
        type: "text",
        required: true,
        label: "Номер приложения (спецификации)",
        defaultValue: "1",
      },
      {
        name: "baseContractNumber",
        type: "text",
        required: true,
        label: "Номер основного договора",
      },
      {
        name: "baseContractDate",
        type: "date",
        required: true,
        label: "Дата основного договора",
      },
      {
        name: "supplierName",
        type: "text",
        required: true,
        label: "Наименование Поставщика",
      },
      {
        name: "supplierBin",
        type: "text",
        required: true,
        label: "БИН/ИИН Поставщика",
      },
      {
        name: "supplierRepresentative",
        type: "text",
        required: true,
        label: "ФИО представителя Поставщика",
      },
      {
        name: "buyerName",
        type: "text",
        required: true,
        label: "Наименование Покупателя",
      },
      {
        name: "buyerBin",
        type: "text",
        required: true,
        label: "БИН/ИИН Покупателя",
      },
      {
        name: "buyerRepresentative",
        type: "text",
        required: true,
        label: "ФИО представителя Покупателя",
      },
      {
        name: "goodsTable",
        type: "textarea",
        required: true,
        label:
          "Перечень товаров (одна позиция в строке: наименование; ед. изм.; кол-во; цена; сумма)",
        defaultValue: "Товар 1; шт.; 10; 5 000; 50 000",
      },
      {
        name: "totalAmount",
        type: "number",
        required: true,
        label: "Итоговая сумма, тенге",
      },
      {
        name: "vatIncluded",
        type: "boolean",
        required: true,
        label: "Сумма включает НДС",
        defaultValue: true,
      },
      {
        name: "currency",
        type: "select",
        required: true,
        label: "Валюта расчётов",
        defaultValue: "тенге",
        options: ["тенге", "доллары США", "евро", "российские рубли"],
      },
      {
        name: "deliveryTerm",
        type: "text",
        required: true,
        label: "Срок поставки",
      },
    ],
    typstContent: `#set document(title: "Спецификация к договору")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: true)

#align(right)[
  Приложение № {{appendixNumber}}\\
  к Договору поставки № {{baseContractNumber}}\\
  от {{baseContractDate}}
]

#v(1em)

#align(center)[
  #text(size: 16pt, weight: "bold")[СПЕЦИФИКАЦИЯ № {{appendixNumber}}]
]

#v(0.5em)

#grid(
  columns: (1fr, 1fr),
  [г. {{city}}],
  [#align(right)[{{appendixDate}}]],
)

#v(1em)

Настоящая Спецификация является неотъемлемой частью Договора поставки № {{baseContractNumber}} от {{baseContractDate}} (далее — «Договор») и заключена между:

#v(0.5em)

*Поставщик:* {{supplierName}}, БИН/ИИН {{supplierBin}}, в лице {{supplierRepresentative}}, с одной стороны, и

*Покупатель:* {{buyerName}}, БИН/ИИН {{buyerBin}}, в лице {{buyerRepresentative}}, с другой стороны, совместно именуемые «Стороны», о нижеследующем.

#v(1em)

== 1. Предмет спецификации

Стороны согласовали наименование, количество, цену и общую стоимость поставляемого товара в соответствии с настоящей Спецификацией.

#v(0.5em)

*Перечень товаров:*

#v(0.5em)

#block(stroke: 0.5pt, inset: 8pt, width: 100%)[
  {{goodsTable}}
]

#v(0.5em)

#text(size: 9pt, style: "italic")[Формат позиции: наименование; единица измерения; количество; цена за единицу; сумма.]

#v(1em)

== 2. Цена и порядок расчётов

+ Общая стоимость товара по настоящей Спецификации составляет *{{totalAmount}}* ({{currency}}).
+ #if {{vatIncluded}} [
  Указанная сумма *включает* НДС в соответствии с законодательством Республики Казахстан.
] else [
  Указанная сумма *не включает* НДС; НДС начисляется дополнительно в соответствии с законодательством Республики Казахстан.
]
+ Расчёты производятся в валюте: {{currency}}.

== 3. Условия и срок поставки

+ Срок поставки товара: {{deliveryTerm}}.
+ Иные условия поставки определяются Договором № {{baseContractNumber}} от {{baseContractDate}}.

== 4. Заключительные положения

+ Настоящая Спецификация составлена в двух экземплярах, имеющих равную юридическую силу, по одному для каждой из Сторон.
+ Во всём остальном, что не предусмотрено настоящей Спецификацией, Стороны руководствуются условиями Договора и законодательством Республики Казахстан.

#v(2em)

#grid(
  columns: (1fr, 1fr),
  gutter: 2em,
  [
    *ПОСТАВЩИК*
    #v(0.5em)
    {{supplierName}}\\
    БИН/ИИН: {{supplierBin}}
    #v(2em)
    #line(length: 80%)
    {{supplierRepresentative}}\\
    М.П.
  ],
  [
    *ПОКУПАТЕЛЬ*
    #v(0.5em)
    {{buyerName}}\\
    БИН/ИИН: {{buyerBin}}
    #v(2em)
    #line(length: 80%)
    {{buyerRepresentative}}\\
    М.П.
  ],
)
`,
  },
  {
    id: "tpl_akt_vypolnennyh_rabot",
    title: "Акт выполненных работ (оказанных услуг)",
    description:
      "Акт сдачи-приёмки выполненных работ или оказанных услуг между Исполнителем и Заказчиком со ссылкой на договор, перечнем работ, итоговой суммой и НДС. Используется для подтверждения факта выполнения обязательств и отсутствия претензий сторон.",
    price: 1990,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "city",
        type: "text",
        required: true,
        label: "Город составления",
        defaultValue: "Алматы",
      },
      { name: "actNumber", type: "text", required: true, label: "Номер акта" },
      {
        name: "actDate",
        type: "date",
        required: true,
        label: "Дата составления акта",
      },
      {
        name: "contractNumber",
        type: "text",
        required: true,
        label: "Номер договора",
      },
      {
        name: "contractDate",
        type: "date",
        required: true,
        label: "Дата договора",
      },
      {
        name: "contractorName",
        type: "text",
        required: true,
        label: "Наименование Исполнителя",
      },
      {
        name: "contractorBin",
        type: "text",
        required: true,
        label: "БИН/ИИН Исполнителя",
      },
      {
        name: "contractorRepresentative",
        type: "text",
        required: true,
        label: "ФИО представителя Исполнителя",
      },
      {
        name: "customerName",
        type: "text",
        required: true,
        label: "Наименование Заказчика",
      },
      {
        name: "customerBin",
        type: "text",
        required: true,
        label: "БИН/ИИН Заказчика",
      },
      {
        name: "customerRepresentative",
        type: "text",
        required: true,
        label: "ФИО представителя Заказчика",
      },
      {
        name: "workDescription",
        type: "textarea",
        required: true,
        label: "Перечень выполненных работ (оказанных услуг)",
      },
      {
        name: "totalAmount",
        type: "number",
        required: true,
        label: "Общая стоимость, тенге",
      },
      {
        name: "vatIncluded",
        type: "boolean",
        required: true,
        label: "Стоимость включает НДС",
        defaultValue: true,
      },
      {
        name: "vatRate",
        type: "number",
        required: false,
        label: "Ставка НДС, %",
        defaultValue: 12,
        dependsOn: { field: "vatIncluded", value: "true" },
      },
      {
        name: "vatAmount",
        type: "number",
        required: false,
        label: "Сумма НДС, тенге",
        dependsOn: { field: "vatIncluded", value: "true" },
      },
    ],
    typstContent: `#set document(title: "Акт выполненных работ")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: true)

#align(center)[
  #text(size: 16pt, weight: "bold")[АКТ ВЫПОЛНЕННЫХ РАБОТ (ОКАЗАННЫХ УСЛУГ)]
]

#v(0.5em)

#align(center)[
  № {{actNumber}} от {{actDate}}
]

#v(1em)

#grid(
  columns: (1fr, 1fr),
  gutter: 1em,
  align(left)[г. {{city}}],
  align(right)[{{actDate}}],
)

#v(1em)

Настоящий акт составлен в том, что *{{contractorName}}* (БИН/ИИН {{contractorBin}}), именуемое в дальнейшем «Исполнитель», в лице {{contractorRepresentative}}, с одной стороны, и *{{customerName}}* (БИН/ИИН {{customerBin}}), именуемое в дальнейшем «Заказчик», в лице {{customerRepresentative}}, с другой стороны, составили настоящий акт о нижеследующем.

#v(1em)

== 1. Основание

Работы (услуги) выполнены (оказаны) в соответствии с договором № {{contractNumber}} от {{contractDate}}.

== 2. Перечень выполненных работ (оказанных услуг)

#block(inset: (left: 1em))[
  {{workDescription}}
]

== 3. Стоимость

Общая стоимость выполненных работ (оказанных услуг) составляет *{{totalAmount}} тенге*.

#if {{vatIncluded}} [
  В том числе НДС по ставке {{vatRate}}% в размере *{{vatAmount}} тенге*.
] else [
  Без учёта НДС (Исполнитель не является плательщиком НДС).
]

== 4. Заключение

+ Вышеуказанные работы (услуги) выполнены (оказаны) Исполнителем в полном объёме и в установленные сроки.
+ Заказчик принял выполненные работы (оказанные услуги) и претензий по объёму, качеству и срокам не имеет.
+ Настоящий акт составлен в двух экземплярах, имеющих равную юридическую силу, по одному для каждой из Сторон.

#v(2em)

#grid(
  columns: (1fr, 1fr),
  gutter: 2em,
  [
    *ИСПОЛНИТЕЛЬ*
    #v(0.5em)
    {{contractorName}}\\
    БИН/ИИН: {{contractorBin}}
    #v(2em)
    #line(length: 80%)
    {{contractorRepresentative}}\\
    М.П.
  ],
  [
    *ЗАКАЗЧИК*
    #v(0.5em)
    {{customerName}}\\
    БИН/ИИН: {{customerBin}}
    #v(2em)
    #line(length: 80%)
    {{customerRepresentative}}\\
    М.П.
  ]
)
`,
  },
  {
    id: "tpl_reshenie_uchastnika",
    title: "Решение единственного участника ТОО",
    description:
      "Решение единственного участника товарищества с ограниченной ответственностью по ключевым вопросам деятельности: утверждение документов, назначение или смена директора, распределение чистого дохода, изменение устава или уставного капитала. Применяется в Республике Казахстан, когда в ТОО один участник и общее собрание не проводится.",
    price: 2490,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "city",
        type: "text",
        required: true,
        label: "Город",
        defaultValue: "Алматы",
      },
      {
        name: "decisionDate",
        type: "date",
        required: true,
        label: "Дата принятия решения",
      },
      {
        name: "decisionNumber",
        type: "text",
        required: true,
        label: "Номер решения",
        defaultValue: "1",
      },
      {
        name: "companyName",
        type: "text",
        required: true,
        label: "Полное наименование ТОО",
      },
      {
        name: "companyBIN",
        type: "text",
        required: true,
        label: "БИН товарищества",
      },
      {
        name: "companyAddress",
        type: "text",
        required: true,
        label: "Юридический адрес ТОО",
      },
      {
        name: "participantType",
        type: "select",
        required: true,
        label: "Тип участника",
        options: ["Физическое лицо", "Юридическое лицо"],
      },
      {
        name: "participantFIO",
        type: "text",
        required: true,
        label: "ФИО участника / ФИО представителя",
      },
      {
        name: "participantGender",
        type: "select",
        required: true,
        label: "Пол участника (для согласования текста)",
        options: ["Мужской", "Женский"],
      },
      {
        name: "participantIIN",
        type: "text",
        required: false,
        label: "ИИН участника (физлицо)",
        dependsOn: { field: "participantType", value: "Физическое лицо" },
      },
      {
        name: "participantCompanyName",
        type: "text",
        required: false,
        label: "Наименование участника-юрлица",
        dependsOn: { field: "participantType", value: "Юридическое лицо" },
      },
      {
        name: "participantBIN",
        type: "text",
        required: false,
        label: "БИН участника-юрлица",
        dependsOn: { field: "participantType", value: "Юридическое лицо" },
      },
      {
        name: "decisionSubject",
        type: "select",
        required: true,
        label: "Предмет решения",
        options: [
          "Назначение директора",
          "Утверждение годовой финансовой отчётности",
          "Распределение чистого дохода",
          "Изменение устава",
          "Увеличение уставного капитала",
          "Иной вопрос",
        ],
      },
      {
        name: "directorFIO",
        type: "text",
        required: false,
        label: "ФИО назначаемого директора",
        dependsOn: { field: "decisionSubject", value: "Назначение директора" },
      },
      {
        name: "directorTermYears",
        type: "number",
        required: false,
        label: "Срок полномочий директора (лет)",
        defaultValue: 3,
        dependsOn: { field: "decisionSubject", value: "Назначение директора" },
      },
      {
        name: "reportingYear",
        type: "text",
        required: false,
        label: "Отчётный год",
        dependsOn: {
          field: "decisionSubject",
          value: "Утверждение годовой финансовой отчётности",
        },
      },
      {
        name: "netIncomeAmount",
        type: "number",
        required: false,
        label: "Сумма распределяемого чистого дохода (тенге)",
        dependsOn: {
          field: "decisionSubject",
          value: "Распределение чистого дохода",
        },
      },
      {
        name: "capitalNewAmount",
        type: "number",
        required: false,
        label: "Новый размер уставного капитала (тенге)",
        dependsOn: {
          field: "decisionSubject",
          value: "Увеличение уставного капитала",
        },
      },
      {
        name: "decisionText",
        type: "textarea",
        required: true,
        label: "Текст постановляющей части (что именно решено)",
      },
    ],
    typstContent: `#set document(title: "Решение единственного участника ТОО")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: true)

#align(center)[
  #text(size: 16pt, weight: "bold")[РЕШЕНИЕ №{{decisionNumber}}]
]

#align(center)[
  #text(size: 12pt)[единственного участника {{companyName}}]
]

#v(0.5em)

#grid(
  columns: (1fr, 1fr),
  align(left)[г. {{city}}],
  align(right)[{{decisionDate}}]
)

#v(1em)

// === ПРЕАМБУЛА: УЧАСТНИК ===
#if "{{participantType}}" == "Юридическое лицо" [
  Единственный участник Товарищества с ограниченной ответственностью {{companyName}} (БИН {{companyBIN}}, место нахождения: {{companyAddress}}) — {{participantCompanyName}}, БИН {{participantBIN}}, в лице {{participantFIO}}, #if "{{participantGender}}" == "Женский" [действующей] else [действующего] от имени участника,
] else [
  Единственный участник Товарищества с ограниченной ответственностью {{companyName}} (БИН {{companyBIN}}, место нахождения: {{companyAddress}}) — {{participantFIO}}, ИИН {{participantIIN}},
]
руководствуясь Законом Республики Казахстан «О товариществах с ограниченной и дополнительной ответственностью» и Уставом Товарищества, единолично рассмотрев вопрос повестки дня,

#v(0.5em)

== Повестка дня

+ #if "{{decisionSubject}}" == "Назначение директора" [О назначении директора Товарищества.] else if "{{decisionSubject}}" == "Утверждение годовой финансовой отчётности" [Об утверждении годовой финансовой отчётности Товарищества.] else if "{{decisionSubject}}" == "Распределение чистого дохода" [О распределении чистого дохода Товарищества.] else if "{{decisionSubject}}" == "Изменение устава" [О внесении изменений в Устав Товарищества.] else if "{{decisionSubject}}" == "Увеличение уставного капитала" [Об увеличении уставного капитала Товарищества.] else [По вопросу деятельности Товарищества.]

#v(0.5em)

== Решил

#if "{{decisionSubject}}" == "Назначение директора" [
  + Назначить директором Товарищества {{directorFIO}} сроком на {{directorTermYears}} (#if "{{directorTermYears}}" == "1" [один] else [указанное количество]) лет с даты принятия настоящего Решения.

  + Предоставить директору право действовать от имени Товарищества без доверенности, заключать сделки, открывать банковские счета и совершать иные действия в пределах полномочий, установленных Уставом и законодательством Республики Казахстан.
] else if "{{decisionSubject}}" == "Утверждение годовой финансовой отчётности" [
  + Утвердить годовую финансовую отчётность Товарищества за {{reportingYear}} год.

  + Признать результаты финансово-хозяйственной деятельности Товарищества за указанный период удовлетворительными.
] else if "{{decisionSubject}}" == "Распределение чистого дохода" [
  + Распределить чистый доход Товарищества в размере {{netIncomeAmount}} тенге в пользу единственного участника.

  + Выплату распределённого чистого дохода произвести в порядке и сроки, установленные законодательством Республики Казахстан.
] else if "{{decisionSubject}}" == "Изменение устава" [
  + Внести изменения в Устав Товарищества и утвердить Устав в новой редакции.

  + Поручить директору Товарищества осуществить государственную регистрацию изменений в установленном законом порядке.
] else if "{{decisionSubject}}" == "Увеличение уставного капитала" [
  + Увеличить уставный капитал Товарищества и установить его новый размер в сумме {{capitalNewAmount}} тенге.

  + Поручить директору Товарищества внести соответствующие изменения в учредительные документы и обеспечить их государственную регистрацию.
] else [
  + Принять решение по вопросу повестки дня согласно постановляющей части настоящего Решения.
]

#v(0.5em)

== Постановляющая часть

#block(inset: (left: 1em))[
  {{decisionText}}
]

#v(0.5em)

== Заключительные положения

+ Настоящее Решение вступает в силу с момента его подписания единственным участником Товарищества.

+ Контроль за исполнением настоящего Решения возложить на директора Товарищества.

+ Настоящее Решение составлено в письменной форме на русском языке и хранится в делах Товарищества.

#v(2em)

#align(left)[
  *Единственный участник Товарищества*
  #v(2em)
  #line(length: 50%)
  #if "{{participantType}}" == "Юридическое лицо" [
    {{participantCompanyName}}, в лице {{participantFIO}}\\
    БИН: {{participantBIN}}
  ] else [
    {{participantFIO}}\\
    ИИН: {{participantIIN}}
  ]
]
`,
  },
  {
    id: "tpl_protokol_sobraniya",
    title: "Протокол общего собрания участников ТОО",
    description:
      "Протокол общего собрания участников товарищества с ограниченной ответственностью (Республика Казахстан): фиксирует дату и место проведения, состав присутствующих участников, повестку дня, ход голосования и принятые решения. Используется для документального оформления решений участников ТОО — например, об утверждении финансовой отчётности, распределении прибыли, смене директора или внесении изменений в устав.",
    price: 2490,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "companyName",
        type: "text",
        required: true,
        label: "Полное наименование ТОО",
        defaultValue: "ТОО «»",
      },
      {
        name: "companyBin",
        type: "text",
        required: true,
        label: "БИН товарищества",
      },
      {
        name: "city",
        type: "text",
        required: true,
        label: "Город (место проведения)",
        defaultValue: "Алматы",
      },
      {
        name: "meetingDate",
        type: "date",
        required: true,
        label: "Дата проведения собрания",
      },
      {
        name: "protocolNumber",
        type: "text",
        required: true,
        label: "Номер протокола",
        defaultValue: "1",
      },
      {
        name: "meetingForm",
        type: "select",
        required: true,
        label: "Форма проведения собрания",
        defaultValue: "Очная",
        options: ["Очная", "Заочная (опросным путём)"],
      },
      {
        name: "meetingTime",
        type: "text",
        required: false,
        label: "Время начала собрания",
        defaultValue: "10:00",
        dependsOn: { field: "meetingForm", value: "Очная" },
      },
      {
        name: "totalParticipants",
        type: "number",
        required: true,
        label: "Общее число участников ТОО",
        defaultValue: 2,
      },
      {
        name: "presentParticipants",
        type: "textarea",
        required: true,
        label: "Присутствующие участники (ФИО, ИИН, доля в %)",
        defaultValue:
          "1. Иванов Иван Иванович, ИИН 000000000000, доля 50%;\n2. Петров Пётр Петрович, ИИН 000000000000, доля 50%.",
      },
      {
        name: "totalVotesPercent",
        type: "number",
        required: true,
        label: "Доля голосов присутствующих, %",
        defaultValue: 100,
      },
      {
        name: "chairmanName",
        type: "text",
        required: true,
        label: "ФИО председателя собрания",
      },
      {
        name: "secretaryName",
        type: "text",
        required: true,
        label: "ФИО секретаря собрания",
      },
      {
        name: "agendaItems",
        type: "textarea",
        required: true,
        label: "Повестка дня (по пунктам)",
        defaultValue:
          "1. Утверждение годовой финансовой отчётности.\n2. Распределение чистого дохода.",
      },
      {
        name: "decisions",
        type: "textarea",
        required: true,
        label: "Принятые решения по вопросам повестки",
        defaultValue:
          "1. Утвердить годовую финансовую отчётность за отчётный период.\n2. Направить чистый доход на развитие товарищества.",
      },
      {
        name: "votingResult",
        type: "select",
        required: true,
        label: "Итог голосования",
        defaultValue: "Единогласно",
        options: ["Единогласно", "Большинством голосов"],
      },
      {
        name: "votesFor",
        type: "number",
        required: false,
        label: "Голосов «За», %",
        defaultValue: 60,
        dependsOn: { field: "votingResult", value: "Большинством голосов" },
      },
      {
        name: "votesAgainst",
        type: "number",
        required: false,
        label: "Голосов «Против», %",
        defaultValue: 40,
        dependsOn: { field: "votingResult", value: "Большинством голосов" },
      },
    ],
    typstContent: `#set document(title: "Протокол общего собрания участников ТОО")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: true)

#align(center)[
  #text(size: 16pt, weight: "bold")[ПРОТОКОЛ №{{protocolNumber}}]
]

#align(center)[
  #text(size: 12pt, weight: "bold")[общего собрания участников {{companyName}} (БИН {{companyBin}})]
]

#v(0.5em)

#grid(
  columns: (1fr, 1fr),
  align(left)[г. {{city}}],
  align(right)[{{meetingDate}}]
)

#v(1em)

== Сведения о собрании

- Форма проведения собрания: {{meetingForm}}.
#if "{{meetingForm}}" == "Очная" [
- Время начала собрания: {{meetingTime}}.
]
- Общее число участников товарищества: {{totalParticipants}}.
- На собрании присутствуют участники, обладающие в совокупности {{totalVotesPercent}}% голосов, что составляет кворум, необходимый для принятия решений по вопросам повестки дня.

#v(0.5em)

== Присутствующие участники

{{presentParticipants}}

#v(0.5em)

== Председатель и секретарь собрания

+ Председателем собрания избран(а): {{chairmanName}}.
+ Секретарём собрания избран(а): {{secretaryName}}.

#v(0.5em)

== Повестка дня

{{agendaItems}}

#v(0.5em)

== Рассмотрение вопросов и голосование

По вопросам повестки дня выступили присутствующие участники товарищества. По итогам обсуждения проведено голосование.

#if "{{votingResult}}" == "Единогласно" [
Решения по всем вопросам повестки дня приняты *единогласно* — «За» проголосовали участники, обладающие 100% голосов от числа присутствующих.
] else [
Решения приняты *большинством голосов*: «За» — {{votesFor}}%, «Против» — {{votesAgainst}}% от числа голосов присутствующих участников.
]

#v(0.5em)

== Принятые решения

{{decisions}}

#v(0.5em)

Настоящий протокол составлен в соответствии с законодательством Республики Казахстан о товариществах с ограниченной и дополнительной ответственностью, отражает действительный ход и результаты общего собрания участников {{companyName}}.

#v(2em)

#grid(
  columns: (1fr, 1fr),
  gutter: 2em,
  [
    Председатель собрания
    #v(2em)
    #line(length: 80%)
    {{chairmanName}}
  ],
  [
    Секретарь собрания
    #v(2em)
    #line(length: 80%)
    {{secretaryName}}
  ]
)`,
  },
  {
    id: "tpl_prikaz_priem",
    title: "Приказ о приёме на работу",
    description:
      "Приказ (распоряжение) работодателя о приёме работника на работу в соответствии с Трудовым кодексом Республики Казахстан. Оформляется на основании заключённого трудового договора и фиксирует должность, размер оклада, дату начала работы и иные условия приёма.",
    price: 1990,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "companyName",
        type: "text",
        required: true,
        label: "Наименование работодателя (организации)",
      },
      {
        name: "companyBIN",
        type: "text",
        required: true,
        label: "БИН работодателя",
      },
      {
        name: "orderNumber",
        type: "text",
        required: true,
        label: "Номер приказа",
      },
      {
        name: "city",
        type: "text",
        required: true,
        label: "Город (место издания приказа)",
      },
      {
        name: "orderDate",
        type: "date",
        required: true,
        label: "Дата приказа",
      },
      {
        name: "contractNumber",
        type: "text",
        required: true,
        label: "Номер трудового договора",
      },
      {
        name: "contractDate",
        type: "date",
        required: true,
        label: "Дата трудового договора",
      },
      {
        name: "employeeFIO",
        type: "text",
        required: true,
        label: "ФИО работника",
      },
      {
        name: "employeeIIN",
        type: "text",
        required: true,
        label: "ИИН работника",
      },
      { name: "position", type: "text", required: true, label: "Должность" },
      {
        name: "department",
        type: "text",
        required: false,
        label: "Структурное подразделение (необязательно)",
      },
      {
        name: "startDate",
        type: "date",
        required: true,
        label: "Дата начала работы",
      },
      {
        name: "employmentType",
        type: "select",
        required: true,
        label: "Характер работы",
        defaultValue: "Постоянная",
        options: [
          "Постоянная",
          "На определённый срок",
          "На время выполнения определённой работы",
        ],
      },
      {
        name: "contractEndDate",
        type: "date",
        required: false,
        label: "Срок окончания трудового договора",
        dependsOn: { field: "employmentType", value: "На определённый срок" },
      },
      {
        name: "salaryAmount",
        type: "number",
        required: true,
        label: "Должностной оклад (тенге в месяц)",
      },
      {
        name: "hasProbation",
        type: "boolean",
        required: true,
        label: "Установить испытательный срок",
        defaultValue: false,
      },
      {
        name: "probationMonths",
        type: "number",
        required: false,
        label: "Продолжительность испытательного срока (месяцев)",
        defaultValue: 3,
        dependsOn: { field: "hasProbation", value: "true" },
      },
      {
        name: "directorPosition",
        type: "text",
        required: true,
        label: "Должность подписанта (руководителя)",
      },
      {
        name: "directorFIO",
        type: "text",
        required: true,
        label: "ФИО подписанта (руководителя)",
      },
    ],
    typstContent: `#set document(title: "Приказ о приёме на работу")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: true)

#align(center)[
  #text(size: 16pt, weight: "bold")[ПРИКАЗ О ПРИЁМЕ НА РАБОТУ]
]

#v(0.5em)

#align(center)[
  {{companyName}}, БИН {{companyBIN}}
]

#v(0.5em)

#grid(
  columns: (1fr, 1fr),
  align(left)[№ {{orderNumber}}],
  align(right)[г. {{city}}, {{orderDate}}]
)

#v(1em)

На основании трудового договора № {{contractNumber}} от {{contractDate}}, в соответствии с Трудовым кодексом Республики Казахстан,

#v(0.5em)

#align(center)[ *ПРИКАЗЫВАЮ:* ]

#v(0.5em)

+ Принять на работу {{employeeFIO}} (ИИН {{employeeIIN}}) на должность {{position}}#if "{{department}}" != "" [ в структурное подразделение: {{department}}].

+ Установить дату начала работы: {{startDate}}.

+ Определить характер работы как: #if "{{employmentType}}" == "Постоянная" [постоянную (трудовой договор заключён на неопределённый срок)] else if "{{employmentType}}" == "На определённый срок" [работу на определённый срок — по {{contractEndDate}}] else [работу на время выполнения определённой работы].

+ Установить работнику должностной оклад в размере {{salaryAmount}} (сумма прописью) тенге в месяц.

#if {{hasProbation}} [
  + Установить работнику испытательный срок продолжительностью {{probationMonths}} (прописью) месяца(ев) с даты начала работы.
] else [
  + Принять работника без установления испытательного срока.
]

+ Главному бухгалтеру (бухгалтеру) обеспечить начисление и выплату заработной платы работнику в соответствии с условиями настоящего приказа и трудового договора.

+ Контроль за исполнением настоящего приказа оставляю за собой.

#v(0.5em)

== Основание

- Трудовой договор № {{contractNumber}} от {{contractDate}}.

#v(2em)

#grid(
  columns: (1fr, 1fr),
  align(left)[
    {{directorPosition}}
    #v(2em)
    #line(length: 80%)
    {{directorFIO}}
    #v(0.3em)
    подпись / расшифровка
  ],
  align(right)[ ]
)

#v(2em)

С приказом ознакомлен(а):

#v(2em)

#line(length: 60%)
{{employeeFIO}}, ИИН {{employeeIIN}}

#v(0.3em)
подпись / дата`,
  },
  {
    id: "tpl_uvedomlenie_rastorzhenie",
    title: "Уведомление о расторжении договора",
    description:
      "Уведомление одной стороны о расторжении договора в одностороннем порядке с указанием реквизитов договора, основания, даты расторжения и требований к другой стороне. Используется, когда одна из сторон намерена прекратить договорные отношения в порядке, предусмотренном договором или законодательством Республики Казахстан.",
    price: 2490,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "city",
        type: "text",
        required: true,
        label: "Город",
        defaultValue: "Алматы",
      },
      {
        name: "noticeDate",
        type: "date",
        required: true,
        label: "Дата уведомления",
      },
      {
        name: "senderType",
        type: "select",
        required: true,
        label: "Тип отправителя",
        defaultValue: "Юридическое лицо",
        options: ["Юридическое лицо", "ИП", "Физическое лицо"],
      },
      {
        name: "senderName",
        type: "text",
        required: true,
        label: "Наименование / ФИО отправителя",
      },
      {
        name: "senderRequisite",
        type: "text",
        required: true,
        label: "БИН/ИИН отправителя",
      },
      {
        name: "senderAddress",
        type: "text",
        required: true,
        label: "Адрес отправителя",
      },
      {
        name: "senderSignatoryFIO",
        type: "text",
        required: true,
        label: "ФИО подписанта (отправитель)",
      },
      {
        name: "recipientType",
        type: "select",
        required: true,
        label: "Тип получателя",
        defaultValue: "Юридическое лицо",
        options: ["Юридическое лицо", "ИП", "Физическое лицо"],
      },
      {
        name: "recipientName",
        type: "text",
        required: true,
        label: "Наименование / ФИО получателя",
      },
      {
        name: "recipientRequisite",
        type: "text",
        required: true,
        label: "БИН/ИИН получателя",
      },
      {
        name: "recipientAddress",
        type: "text",
        required: true,
        label: "Адрес получателя",
      },
      {
        name: "contractName",
        type: "text",
        required: true,
        label: "Наименование договора",
        defaultValue: "Договор оказания услуг",
      },
      {
        name: "contractNumber",
        type: "text",
        required: true,
        label: "Номер договора",
      },
      {
        name: "contractDate",
        type: "date",
        required: true,
        label: "Дата заключения договора",
      },
      {
        name: "terminationGround",
        type: "select",
        required: true,
        label: "Основание расторжения",
        defaultValue: "Существенное нарушение условий договора",
        options: [
          "Существенное нарушение условий договора",
          "Односторонний отказ по условиям договора",
          "Односторонний отказ по закону",
          "Иное основание",
        ],
      },
      {
        name: "groundDescription",
        type: "textarea",
        required: true,
        label: "Описание основания / нарушения",
      },
      {
        name: "contractClause",
        type: "text",
        required: false,
        label: "Пункт договора (основание расторжения)",
        dependsOn: {
          field: "terminationGround",
          value: "Односторонний отказ по условиям договора",
        },
      },
      {
        name: "lawArticle",
        type: "text",
        required: false,
        label: "Статья закона (основание расторжения)",
        dependsOn: {
          field: "terminationGround",
          value: "Односторонний отказ по закону",
        },
      },
      {
        name: "terminationDate",
        type: "date",
        required: true,
        label: "Дата расторжения договора",
      },
      {
        name: "hasMonetaryClaim",
        type: "boolean",
        required: false,
        label: "Имеются денежные требования",
        defaultValue: true,
      },
      {
        name: "claimAmount",
        type: "number",
        required: false,
        label: "Сумма требований (тенге)",
        dependsOn: { field: "hasMonetaryClaim", value: "true" },
      },
      {
        name: "responseDays",
        type: "number",
        required: true,
        label: "Срок для ответа (дней)",
        defaultValue: 10,
      },
    ],
    typstContent: `#set document(title: "Уведомление о расторжении договора")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: true)

#align(center)[
  #text(size: 16pt, weight: "bold")[УВЕДОМЛЕНИЕ О РАСТОРЖЕНИИ ДОГОВОРА]
]

#v(0.5em)

#grid(
  columns: (1fr, 1fr),
  align(left)[г. {{city}}],
  align(right)[{{noticeDate}}]
)

#v(1em)

// === ШАПКА: ОТ КОГО / КОМУ ===
#grid(
  columns: (1fr, 1fr),
  gutter: 2em,
  [
    *От:*
    #v(0.3em)
    #if "{{senderType}}" == "Юридическое лицо" [
      {{senderName}}\\
      БИН: {{senderRequisite}}\\
    ] else if "{{senderType}}" == "ИП" [
      ИП {{senderName}}\\
      ИИН: {{senderRequisite}}\\
    ] else [
      {{senderName}}\\
      ИИН: {{senderRequisite}}\\
    ]
    Адрес: {{senderAddress}}
  ],
  [
    *Кому:*
    #v(0.3em)
    #if "{{recipientType}}" == "Юридическое лицо" [
      {{recipientName}}\\
      БИН: {{recipientRequisite}}\\
    ] else if "{{recipientType}}" == "ИП" [
      ИП {{recipientName}}\\
      ИИН: {{recipientRequisite}}\\
    ] else [
      {{recipientName}}\\
      ИИН: {{recipientRequisite}}\\
    ]
    Адрес: {{recipientAddress}}
  ]
)

#v(1em)

Настоящим уведомляем Вас о том, что между Сторонами был заключён {{contractName}} № {{contractNumber}} от {{contractDate}} (далее — «Договор»).

#v(0.5em)

== 1. Основание расторжения

#if "{{terminationGround}}" == "Существенное нарушение условий договора" [
  В связи с существенным нарушением условий Договора, выразившимся в следующем:
  #block(inset: (left: 1em))[
    {{groundDescription}}
  ]
  руководствуясь положениями действующего законодательства Республики Казахстан, отправитель принял решение о расторжении Договора.
] else if "{{terminationGround}}" == "Односторонний отказ по условиям договора" [
  В соответствии с пунктом {{contractClause}} Договора отправитель реализует право на односторонний отказ от исполнения Договора по следующему основанию:
  #block(inset: (left: 1em))[
    {{groundDescription}}
  ]
] else if "{{terminationGround}}" == "Односторонний отказ по закону" [
  В соответствии со статьёй {{lawArticle}} действующего законодательства Республики Казахстан отправитель реализует право на односторонний отказ от исполнения Договора по следующему основанию:
  #block(inset: (left: 1em))[
    {{groundDescription}}
  ]
] else [
  Договор подлежит расторжению по следующему основанию:
  #block(inset: (left: 1em))[
    {{groundDescription}}
  ]
]

#v(0.5em)

== 2. Дата расторжения

Договор считается расторгнутым с {{terminationDate}}. С указанной даты Стороны прекращают исполнение взаимных обязательств по Договору, за исключением обязательств, срок исполнения которых наступил до его расторжения.

#v(0.5em)

== 3. Требования

В связи с расторжением Договора требуем:

+ Прекратить исполнение обязательств по Договору с даты его расторжения.
+ Произвести окончательные взаиморасчёты по Договору в полном объёме.
#if {{hasMonetaryClaim}} [
  + Погасить имеющуюся задолженность в размере {{claimAmount}} тенге в течение {{responseDays}} (прописью) дней с момента получения настоящего уведомления.
]
+ Возвратить переданное по Договору имущество и документацию (при наличии).

#v(0.5em)

Просим в течение {{responseDays}} дней с момента получения настоящего уведомления направить отправителю письменный ответ по адресу: {{senderAddress}}.

Непредставление ответа в указанный срок не препятствует расторжению Договора в порядке, предусмотренном Договором и законодательством Республики Казахстан.

#v(2em)

С уважением,

#v(1.5em)

{{senderName}}

#v(1em)

#line(length: 50%)
{{senderSignatoryFIO}}
#v(0.3em)
Подпись / ФИО
`,
  },
  {
    id: "tpl_pretenziya_oplata",
    title: "Претензия об оплате задолженности",
    description:
      "Досудебная претензия об оплате задолженности по договору: указываются сумма основного долга, период и дни просрочки, начисленная пеня, срок для добровольного исполнения и предупреждение об обращении в суд. Используется кредитором для соблюдения досудебного порядка урегулирования спора перед подачей иска.",
    price: 2490,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "city",
        type: "text",
        required: true,
        label: "Город",
        defaultValue: "Алматы",
      },
      {
        name: "claimDate",
        type: "date",
        required: true,
        label: "Дата претензии",
      },
      {
        name: "creditorType",
        type: "select",
        required: true,
        label: "Тип кредитора",
        defaultValue: "Юридическое лицо",
        options: ["Юридическое лицо", "ИП", "Физическое лицо"],
      },
      {
        name: "creditorName",
        type: "text",
        required: true,
        label: "Наименование / ФИО кредитора",
      },
      {
        name: "creditorRequisites",
        type: "textarea",
        required: true,
        label: "Реквизиты кредитора (БИН/ИИН, адрес, банковские реквизиты)",
      },
      {
        name: "creditorSignatory",
        type: "text",
        required: true,
        label: "Подписант со стороны кредитора (должность, ФИО)",
      },
      {
        name: "debtorType",
        type: "select",
        required: true,
        label: "Тип должника",
        defaultValue: "Юридическое лицо",
        options: ["Юридическое лицо", "ИП", "Физическое лицо"],
      },
      {
        name: "debtorName",
        type: "text",
        required: true,
        label: "Наименование / ФИО должника",
      },
      {
        name: "debtorRequisites",
        type: "textarea",
        required: true,
        label: "Реквизиты должника (БИН/ИИН, адрес)",
      },
      {
        name: "contractName",
        type: "text",
        required: true,
        label: "Наименование договора",
        defaultValue: "Договор оказания услуг",
      },
      {
        name: "contractNumber",
        type: "text",
        required: true,
        label: "Номер договора",
      },
      {
        name: "contractDate",
        type: "date",
        required: true,
        label: "Дата заключения договора",
      },
      {
        name: "obligationDescription",
        type: "textarea",
        required: true,
        label: "Описание обязательства (за что возник долг)",
      },
      {
        name: "paymentDueDate",
        type: "date",
        required: true,
        label: "Срок оплаты по договору",
      },
      {
        name: "overdueDays",
        type: "number",
        required: true,
        label: "Количество дней просрочки",
      },
      {
        name: "debtAmount",
        type: "text",
        required: true,
        label: "Сумма основного долга (тенге)",
      },
      {
        name: "hasPenalty",
        type: "boolean",
        required: false,
        label: "Начислять пеню (неустойку)",
        defaultValue: true,
      },
      {
        name: "penaltyRate",
        type: "text",
        required: false,
        label: "Размер пени (например, 0,1% за день)",
        dependsOn: { field: "hasPenalty", value: "true" },
      },
      {
        name: "penaltyAmount",
        type: "text",
        required: false,
        label: "Сумма начисленной пени (тенге)",
        dependsOn: { field: "hasPenalty", value: "true" },
      },
      {
        name: "voluntaryDays",
        type: "number",
        required: true,
        label: "Срок для добровольного исполнения (дней)",
        defaultValue: 10,
      },
    ],
    typstContent: `#set document(title: "Претензия об оплате задолженности")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: true)

#grid(
  columns: (1fr, 1fr),
  align(left)[
    *От:*\\
    #if "{{creditorType}}" == "Юридическое лицо" [{{creditorName}}] else if "{{creditorType}}" == "ИП" [ИП {{creditorName}}] else [{{creditorName}}]\\
    {{creditorRequisites}}
  ],
  align(left)[
    *Кому:*\\
    #if "{{debtorType}}" == "Юридическое лицо" [{{debtorName}}] else if "{{debtorType}}" == "ИП" [ИП {{debtorName}}] else [{{debtorName}}]\\
    {{debtorRequisites}}
  ]
)

#v(1em)

#grid(
  columns: (1fr, 1fr),
  align(left)[г. {{city}}],
  align(right)[{{claimDate}}]
)

#v(0.5em)

#align(center)[
  #text(size: 16pt, weight: "bold")[ПРЕТЕНЗИЯ]
]

#align(center)[
  #text(size: 12pt)[об оплате задолженности по договору]
]

#v(1em)

Между #if "{{creditorType}}" == "ИП" [ИП {{creditorName}}] else [{{creditorName}}] (далее — «Кредитор») и #if "{{debtorType}}" == "ИП" [ИП {{debtorName}}] else [{{debtorName}}] (далее — «Должник») заключён {{contractName}} №{{contractNumber}} от {{contractDate}} (далее — Договор).

#v(0.5em)

== 1. Основания возникновения задолженности

1.1. В соответствии с условиями Договора у Должника возникло следующее обязательство: {{obligationDescription}}

1.2. Должник обязан был произвести оплату в срок до {{paymentDueDate}}, однако в установленный срок оплата не поступила.

1.3. По состоянию на дату направления настоящей претензии обязательство Должником не исполнено, период просрочки составляет {{overdueDays}} дней.

#v(0.5em)

== 2. Размер задолженности

2.1. Сумма основного долга составляет {{debtAmount}} тенге.

#if {{hasPenalty}} [
  2.2. За нарушение сроков оплаты в соответствии с условиями Договора и законодательством Республики Казахстан начисляется пеня в размере {{penaltyRate}} от суммы задолженности за каждый день просрочки.

  2.3. Сумма начисленной пени за {{overdueDays}} дней просрочки составляет {{penaltyAmount}} тенге.

  2.4. Общая сумма задолженности, подлежащая оплате, складывается из суммы основного долга и пени.
] else [
  2.2. Требование об уплате пени (неустойки) Кредитором не заявляется. Должник обязан погасить сумму основного долга в полном объёме.
]

#v(0.5em)

== 3. Требования Кредитора

На основании изложенного и руководствуясь нормами Гражданского кодекса Республики Казахстан, *требую* в течение {{voluntaryDays}} календарных дней с момента получения настоящей претензии:

+ погасить сумму основного долга в размере {{debtAmount}} тенге;
#if {{hasPenalty}} [
+ уплатить начисленную пеню в размере {{penaltyAmount}} тенге;
]
+ произвести оплату по банковским реквизитам Кредитора, указанным в настоящей претензии.

#v(0.5em)

== 4. Последствия неисполнения

4.1. В случае неисполнения настоящих требований в добровольном порядке в указанный срок Кредитор будет вынужден обратиться в суд за принудительным взысканием задолженности.

4.2. При обращении в суд на Должника дополнительно будут отнесены судебные расходы, в том числе государственная пошлина и расходы на оплату услуг представителя, а также пеня, начисленная по день фактического исполнения обязательства.

4.3. Настоящая претензия направляется в целях соблюдения досудебного порядка урегулирования спора.

#v(1em)

С уважением,

#v(1.5em)

#line(length: 60%)
{{creditorSignatory}}

#if "{{creditorType}}" != "Физическое лицо" [
  #v(0.3em)
  М.П.
]
`,
  },
  {
    id: "tpl_zayavlenie_uvolnenie",
    title: "Заявление об увольнении",
    description:
      "Заявление работника об увольнении по собственному желанию (расторжение трудового договора по инициативе работника согласно Трудовому кодексу РК). Подаётся на имя руководителя организации с указанием желаемой даты прекращения трудовых отношений.",
    price: 1490,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "managerPosition",
        type: "text",
        required: true,
        label: "Должность руководителя (адресата)",
        defaultValue: "Генеральному директору",
      },
      {
        name: "companyName",
        type: "text",
        required: true,
        label: "Наименование организации",
      },
      {
        name: "managerFIO",
        type: "text",
        required: true,
        label: "Ф.И.О. руководителя (в дательном падеже)",
      },
      {
        name: "employeePosition",
        type: "text",
        required: true,
        label: "Должность работника",
      },
      {
        name: "employeeFIO",
        type: "text",
        required: true,
        label: "Ф.И.О. работника",
      },
      {
        name: "employeeIIN",
        type: "text",
        required: false,
        label: "ИИН работника",
      },
      {
        name: "contractNumber",
        type: "text",
        required: false,
        label: "Номер трудового договора",
      },
      {
        name: "contractDate",
        type: "date",
        required: false,
        label: "Дата заключения трудового договора",
      },
      {
        name: "dismissalDate",
        type: "date",
        required: true,
        label: "Дата увольнения (последний рабочий день)",
      },
      {
        name: "reason",
        type: "select",
        required: true,
        label: "Основание увольнения",
        defaultValue: "По собственному желанию",
        options: [
          "По собственному желанию",
          "По соглашению сторон",
          "В связи с выходом на пенсию",
          "По состоянию здоровья",
        ],
      },
      {
        name: "reasonDetails",
        type: "textarea",
        required: false,
        label: "Дополнительное пояснение причины",
        dependsOn: { field: "reason", value: "По состоянию здоровья" },
      },
      {
        name: "withoutWorkout",
        type: "boolean",
        required: false,
        label: "Просить уволить без отработки",
        defaultValue: false,
      },
      {
        name: "transferDuties",
        type: "boolean",
        required: false,
        label: "Обязуюсь передать дела по акту приёма-передачи",
        defaultValue: true,
      },
      {
        name: "applicationDate",
        type: "date",
        required: true,
        label: "Дата подачи заявления",
      },
    ],
    typstContent: `#set document(title: "Заявление об увольнении")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: true)

#grid(
  columns: (1fr, 1fr),
  [],
  align(left)[
    {{managerPosition}} \\
    {{companyName}} \\
    {{managerFIO}} \\
    #v(0.5em)
    от {{employeePosition}} \\
    {{employeeFIO}}#if "{{employeeIIN}}" != "" [, ИИН {{employeeIIN}}]
  ]
)

#v(1.5em)

#align(center)[
  #text(size: 16pt, weight: "bold")[ЗАЯВЛЕНИЕ]
]

#v(1.5em)

#if "{{reason}}" == "По собственному желанию" [
  Прошу расторгнуть заключённый со мной трудовой договор#if "{{contractNumber}}" != "" [ №{{contractNumber}}]#if "{{contractDate}}" != "" [ от {{contractDate}}] и уволить меня с занимаемой должности {{employeePosition}} по собственному желанию (по инициативе работника) с {{dismissalDate}} в соответствии с Трудовым кодексом Республики Казахстан.
] else if "{{reason}}" == "По соглашению сторон" [
  Прошу расторгнуть заключённый со мной трудовой договор#if "{{contractNumber}}" != "" [ №{{contractNumber}}]#if "{{contractDate}}" != "" [ от {{contractDate}}] и уволить меня с занимаемой должности {{employeePosition}} по соглашению сторон с {{dismissalDate}} в соответствии с Трудовым кодексом Республики Казахстан.
] else if "{{reason}}" == "В связи с выходом на пенсию" [
  Прошу расторгнуть заключённый со мной трудовой договор#if "{{contractNumber}}" != "" [ №{{contractNumber}}]#if "{{contractDate}}" != "" [ от {{contractDate}}] и уволить меня с занимаемой должности {{employeePosition}} по собственному желанию в связи с выходом на пенсию с {{dismissalDate}}.
] else [
  Прошу расторгнуть заключённый со мной трудовой договор#if "{{contractNumber}}" != "" [ №{{contractNumber}}]#if "{{contractDate}}" != "" [ от {{contractDate}}] и уволить меня с занимаемой должности {{employeePosition}} по состоянию здоровья с {{dismissalDate}}. {{reasonDetails}}
]

#v(0.5em)

#if {{withoutWorkout}} [
  Прошу произвести увольнение без отработки установленного законодательством срока предупреждения.
] else [
  С установленным законодательством сроком предупреждения об увольнении ознакомлен(а) и согласен(а).
]

#if {{transferDuties}} [
  #v(0.5em)
  Обязуюсь передать находящиеся в моём ведении дела, документы и материальные ценности по акту приёма-передачи до даты увольнения.
]

#v(0.5em)

Прошу произвести окончательный расчёт и выдать трудовую книжку (при наличии), а также иные документы, связанные с трудовой деятельностью, в день увольнения.

#v(3em)

#grid(
  columns: (1fr, 1fr),
  align(left)[
    {{applicationDate}}
  ],
  align(right)[
    #line(length: 5cm) \\
    {{employeeFIO}} \\
    #text(size: 9pt)[(подпись, Ф.И.О.)]
  ]
)`,
  },
  {
    id: "tpl_iskovoe_zayavlenie",
    title: "Исковое заявление о взыскании задолженности",
    description:
      "Исковое заявление в суд Республики Казахстан о взыскании задолженности с должника. Используется кредитором (истцом) для обращения в суд с требованием о взыскании основного долга, неустойки и судебных расходов с ответчика, не исполнившего денежное обязательство.",
    price: 2990,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "courtName",
        type: "text",
        required: true,
        label: "Наименование суда",
        defaultValue:
          "Специализированный межрайонный экономический суд города Алматы",
      },
      {
        name: "city",
        type: "text",
        required: true,
        label: "Город (место составления)",
        defaultValue: "Алматы",
      },
      {
        name: "statementDate",
        type: "date",
        required: true,
        label: "Дата составления заявления",
      },
      {
        name: "plaintiffType",
        type: "select",
        required: true,
        label: "Тип истца",
        defaultValue: "Юридическое лицо",
        options: ["Юридическое лицо", "ИП", "Физическое лицо"],
      },
      {
        name: "plaintiffName",
        type: "text",
        required: true,
        label: "Наименование / ФИО истца",
      },
      {
        name: "plaintiffBINIIN",
        type: "text",
        required: true,
        label: "БИН/ИИН истца",
      },
      {
        name: "plaintiffAddress",
        type: "text",
        required: true,
        label: "Адрес истца",
      },
      {
        name: "plaintiffPhone",
        type: "text",
        required: false,
        label: "Телефон истца",
      },
      {
        name: "defendantType",
        type: "select",
        required: true,
        label: "Тип ответчика",
        defaultValue: "Юридическое лицо",
        options: ["Юридическое лицо", "ИП", "Физическое лицо"],
      },
      {
        name: "defendantName",
        type: "text",
        required: true,
        label: "Наименование / ФИО ответчика",
      },
      {
        name: "defendantBINIIN",
        type: "text",
        required: true,
        label: "БИН/ИИН ответчика",
      },
      {
        name: "defendantAddress",
        type: "text",
        required: true,
        label: "Адрес ответчика",
      },
      {
        name: "basisDocument",
        type: "text",
        required: true,
        label: "Документ-основание возникновения долга",
        defaultValue: "Договор поставки № 12 от 10.01.2026",
      },
      {
        name: "circumstances",
        type: "textarea",
        required: true,
        label: "Обстоятельства дела",
      },
      {
        name: "principalDebt",
        type: "text",
        required: true,
        label: "Сумма основного долга (тенге)",
      },
      {
        name: "hasPenalty",
        type: "boolean",
        required: true,
        label: "Требовать неустойку (пеню)",
        defaultValue: true,
      },
      {
        name: "penaltyAmount",
        type: "text",
        required: false,
        label: "Сумма неустойки (тенге)",
        dependsOn: { field: "hasPenalty", value: "true" },
      },
      {
        name: "penaltyCalculation",
        type: "textarea",
        required: false,
        label: "Расчёт неустойки",
        dependsOn: { field: "hasPenalty", value: "true" },
      },
      {
        name: "stateDuty",
        type: "text",
        required: true,
        label: "Сумма государственной пошлины (тенге)",
      },
      {
        name: "claimPrice",
        type: "text",
        required: true,
        label: "Цена иска (тенге)",
      },
      {
        name: "preTrialClaim",
        type: "select",
        required: true,
        label: "Досудебная претензия направлялась",
        defaultValue: "Да",
        options: ["Да", "Нет"],
      },
      {
        name: "preTrialClaimDetails",
        type: "text",
        required: false,
        label: "Реквизиты претензии (№, дата)",
        dependsOn: { field: "preTrialClaim", value: "Да" },
      },
      {
        name: "attachments",
        type: "textarea",
        required: true,
        label: "Перечень приложений",
      },
    ],
    typstContent: `#set document(title: "Исковое заявление")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: true)

#align(right)[
  В {{courtName}}

  #v(0.5em)
  *Истец:* {{plaintiffName}}\\
  #if "{{plaintiffType}}" == "Физическое лицо" [ИИН: {{plaintiffBINIIN}}\\] else [БИН/ИИН: {{plaintiffBINIIN}}\\]
  Адрес: {{plaintiffAddress}}\\
  #if "{{plaintiffPhone}}" != "" [Телефон: {{plaintiffPhone}}\\]

  #v(0.5em)
  *Ответчик:* {{defendantName}}\\
  #if "{{defendantType}}" == "Физическое лицо" [ИИН: {{defendantBINIIN}}\\] else [БИН/ИИН: {{defendantBINIIN}}\\]
  Адрес: {{defendantAddress}}\\

  #v(0.5em)
  *Цена иска:* {{claimPrice}} тенге\\
  *Государственная пошлина:* {{stateDuty}} тенге
]

#v(1em)

#align(center)[
  #text(size: 16pt, weight: "bold")[ИСКОВОЕ ЗАЯВЛЕНИЕ]
]

#align(center)[
  о взыскании задолженности
]

#v(0.5em)

#grid(
  columns: (1fr, 1fr),
  align(left)[г. {{city}}],
  align(right)[{{statementDate}}]
)

#v(1em)

== 1. Обстоятельства дела

Между Истцом и Ответчиком возникли правоотношения на основании следующего документа: {{basisDocument}}.

{{circumstances}}

В нарушение принятых на себя обязательств Ответчик свои обязательства надлежащим образом не исполнил, в результате чего за ним образовалась задолженность перед Истцом.

#v(0.5em)

== 2. Расчёт суммы иска

Сумма основного долга Ответчика перед Истцом составляет *{{principalDebt}} тенге*.

#if {{hasPenalty}} [
  В связи с просрочкой исполнения денежного обязательства Истцом начислена неустойка (пеня) в размере *{{penaltyAmount}} тенге*.

  Расчёт неустойки: {{penaltyCalculation}}
]

Общая цена иска составляет *{{claimPrice}} тенге*.

#v(0.5em)

== 3. Досудебный порядок урегулирования

#if "{{preTrialClaim}}" == "Да" [
  Истцом в адрес Ответчика была направлена досудебная претензия ({{preTrialClaimDetails}}) с требованием погасить образовавшуюся задолженность. Требования претензии Ответчиком в добровольном порядке не исполнены.
] else [
  В силу характера спора и положений законодательства Республики Казахстан обязательный досудебный порядок урегулирования для данного требования не предусмотрен.
]

#v(0.5em)

== 4. Правовое обоснование

В соответствии со статьями 268, 272, 349 Гражданского кодекса Республики Казахстан обязательства должны исполняться надлежащим образом в соответствии с условиями обязательства и требованиями законодательства, а односторонний отказ от исполнения обязательства не допускается. Согласно статье 293 Гражданского кодекса Республики Казахстан в случае неисполнения или ненадлежащего исполнения обязательства должник обязан уплатить кредитору неустойку.

#v(0.5em)

На основании изложенного и руководствуясь статьями 148, 149 Гражданского процессуального кодекса Республики Казахстан,

#align(center)[*ПРОШУ:*]

+ Взыскать с Ответчика {{defendantName}} в пользу Истца {{plaintiffName}} сумму основного долга в размере {{principalDebt}} тенге.
#if {{hasPenalty}} [
  + Взыскать с Ответчика в пользу Истца неустойку (пеню) в размере {{penaltyAmount}} тенге.
]
+ Взыскать с Ответчика в пользу Истца расходы по оплате государственной пошлины в размере {{stateDuty}} тенге.

#v(0.5em)

== Приложения:

{{attachments}}

#v(2em)

#align(left)[
  «{{statementDate}}»

  #v(1.5em)
  #line(length: 50%)
  {{plaintiffName}} (подпись)
]
`,
  },
  {
    id: "tpl_hodataystvo",
    title: "Ходатайство в суд",
    description:
      "Ходатайство, подаваемое в суд по гражданскому или административному делу (об отложении судебного заседания, об истребовании или приобщении доказательств и т. п.) с указанием реквизитов дела, существа просьбы и её обоснования. Используется участником процесса для обращения к суду с процессуальной просьбой в ходе рассмотрения дела.",
    price: 1990,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "courtName",
        type: "text",
        required: true,
        label: "Наименование суда",
        defaultValue:
          "Специализированный межрайонный экономический суд г. Алматы",
      },
      {
        name: "applicationDate",
        type: "date",
        required: true,
        label: "Дата подачи ходатайства",
      },
      {
        name: "applicantType",
        type: "select",
        required: true,
        label: "Заявитель является",
        defaultValue: "Физическое лицо",
        options: ["Юридическое лицо", "Физическое лицо"],
      },
      {
        name: "applicantName",
        type: "text",
        required: true,
        label: "ФИО / наименование заявителя",
      },
      {
        name: "applicantRole",
        type: "select",
        required: true,
        label: "Процессуальное положение заявителя",
        defaultValue: "Истец",
        options: ["Истец", "Ответчик", "Третье лицо", "Представитель"],
      },
      {
        name: "applicantBIN",
        type: "text",
        required: false,
        label: "БИН заявителя",
        dependsOn: { field: "applicantType", value: "Юридическое лицо" },
      },
      {
        name: "applicantIIN",
        type: "text",
        required: false,
        label: "ИИН заявителя",
        dependsOn: { field: "applicantType", value: "Физическое лицо" },
      },
      {
        name: "applicantAddress",
        type: "text",
        required: true,
        label: "Адрес и телефон заявителя",
      },
      { name: "caseNumber", type: "text", required: true, label: "Номер дела" },
      {
        name: "caseParties",
        type: "text",
        required: true,
        label: "Стороны по делу (Истец / Ответчик)",
      },
      {
        name: "caseSubject",
        type: "text",
        required: true,
        label: "Предмет иска (о чём дело)",
      },
      {
        name: "motionType",
        type: "select",
        required: true,
        label: "Вид ходатайства",
        defaultValue: "Об отложении судебного заседания",
        options: [
          "Об отложении судебного заседания",
          "Об истребовании доказательств",
          "О приобщении документов к материалам дела",
          "Иное",
        ],
      },
      {
        name: "motionSubject",
        type: "textarea",
        required: true,
        label: "Суть ходатайства (что именно просите)",
      },
      {
        name: "motionGrounds",
        type: "textarea",
        required: true,
        label: "Обоснование ходатайства (причины и обстоятельства)",
      },
      {
        name: "hearingDate",
        type: "date",
        required: false,
        label: "Дата текущего судебного заседания",
        dependsOn: {
          field: "motionType",
          value: "Об отложении судебного заседания",
        },
      },
      {
        name: "evidenceHolder",
        type: "text",
        required: false,
        label: "У кого находится доказательство",
        dependsOn: {
          field: "motionType",
          value: "Об истребовании доказательств",
        },
      },
      {
        name: "hasAttachments",
        type: "boolean",
        required: false,
        label: "Приложить документы к ходатайству",
        defaultValue: true,
      },
      {
        name: "attachmentsList",
        type: "textarea",
        required: false,
        label: "Перечень приложений",
        dependsOn: { field: "hasAttachments", value: "true" },
      },
    ],
    typstContent: `#set document(title: "Ходатайство в суд")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: true)

#grid(
  columns: (1fr, 1fr),
  [],
  align(left)[
    В {{courtName}}
    #v(0.5em)
    #if "{{applicantType}}" == "Юридическое лицо" [
      Заявитель ({{applicantRole}}): {{applicantName}}\\
      БИН: {{applicantBIN}}\\
    ] else [
      Заявитель ({{applicantRole}}): {{applicantName}}\\
      ИИН: {{applicantIIN}}\\
    ]
    Адрес, телефон: {{applicantAddress}}\\
    #v(0.5em)
    Дело № {{caseNumber}}\\
    Стороны: {{caseParties}}
  ]
)

#v(1em)

#align(center)[
  #text(size: 16pt, weight: "bold")[ХОДАТАЙСТВО]
]

#align(center)[
  #text(size: 11pt)[{{motionType}}]
]

#v(1em)

В производстве {{courtName}} находится гражданское дело № {{caseNumber}} по иску {{caseParties}} о {{caseSubject}}, в котором {{applicantName}} участвует в качестве {{applicantRole}}.

#if "{{motionType}}" == "Об отложении судебного заседания" [
  Рассмотрение дела назначено на {{hearingDate}}. В связи с изложенными ниже обстоятельствами участие в указанном судебном заседании в назначенную дату является невозможным.
] else if "{{motionType}}" == "Об истребовании доказательств" [
  Для всестороннего и полного рассмотрения дела необходимо истребовать доказательства, которые находятся у {{evidenceHolder}} и не могут быть получены заявителем самостоятельно.
] else if "{{motionType}}" == "О приобщении документов к материалам дела" [
  Для подтверждения обстоятельств, имеющих значение для дела, заявитель считает необходимым приобщить к материалам дела дополнительные документы.
] else [
  В ходе рассмотрения настоящего дела у заявителя возникла необходимость обратиться к суду с настоящим ходатайством.
]

#v(0.5em)

== Существо ходатайства

{{motionSubject}}

#v(0.5em)

== Обоснование

{{motionGrounds}}

#v(0.5em)

== Просительная часть

На основании изложенного и руководствуясь нормами Гражданского процессуального кодекса Республики Казахстан,

#v(0.5em)

*ПРОШУ:*

+ #if "{{motionType}}" == "Об отложении судебного заседания" [
    Отложить судебное заседание по делу № {{caseNumber}}, назначенное на {{hearingDate}}, на другой срок.
  ] else if "{{motionType}}" == "Об истребовании доказательств" [
    Истребовать у {{evidenceHolder}} доказательства, имеющие значение для рассмотрения дела № {{caseNumber}}.
  ] else if "{{motionType}}" == "О приобщении документов к материалам дела" [
    Приобщить представленные документы к материалам дела № {{caseNumber}}.
  ] else [
    Удовлетворить настоящее ходатайство по делу № {{caseNumber}}.
  ]

#v(0.5em)

#if {{hasAttachments}} [
  == Приложения

  {{attachmentsList}}

  #v(0.5em)
] else [
  Приложения к настоящему ходатайству не представляются.

  #v(0.5em)
]

#v(1.5em)

#grid(
  columns: (1fr, 1fr),
  align(left)[
    {{applicationDate}}
  ],
  align(right)[
    #line(length: 60%)
    {{applicantName}}\\
    (подпись)
  ]
)
`,
  },
  {
    id: "tpl_zhaloba",
    title: "Жалоба в государственный орган",
    description:
      "Жалоба (обращение) в государственный орган или на действия (бездействие) должностного лица: содержит данные заявителя и органа, описание нарушения, требования заявителя и ссылку на нормы законодательства. Применяется для защиты прав и законных интересов в порядке, установленном Административным процедурно-процессуальным кодексом Республики Казахстан.",
    price: 1990,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "authorityName",
        type: "text",
        required: true,
        label: "Наименование государственного органа (адресат)",
        defaultValue: "Акимат города Алматы",
      },
      {
        name: "authorityAddress",
        type: "text",
        required: false,
        label: "Адрес государственного органа",
      },
      {
        name: "applicantType",
        type: "select",
        required: true,
        label: "Заявитель",
        defaultValue: "Физическое лицо",
        options: ["Физическое лицо", "Юридическое лицо"],
      },
      {
        name: "applicantFIO",
        type: "text",
        required: false,
        label: "ФИО заявителя",
        dependsOn: { field: "applicantType", value: "Физическое лицо" },
      },
      {
        name: "applicantIIN",
        type: "text",
        required: false,
        label: "ИИН заявителя",
        dependsOn: { field: "applicantType", value: "Физическое лицо" },
      },
      {
        name: "applicantCompanyName",
        type: "text",
        required: false,
        label: "Наименование организации",
        dependsOn: { field: "applicantType", value: "Юридическое лицо" },
      },
      {
        name: "applicantBIN",
        type: "text",
        required: false,
        label: "БИН организации",
        dependsOn: { field: "applicantType", value: "Юридическое лицо" },
      },
      {
        name: "applicantRepFIO",
        type: "text",
        required: false,
        label: "ФИО представителя (руководителя)",
        dependsOn: { field: "applicantType", value: "Юридическое лицо" },
      },
      {
        name: "applicantAddress",
        type: "text",
        required: true,
        label: "Адрес заявителя для корреспонденции",
      },
      {
        name: "applicantPhone",
        type: "text",
        required: false,
        label: "Контактный телефон заявителя",
      },
      {
        name: "officialName",
        type: "text",
        required: false,
        label: "Должностное лицо, чьи действия обжалуются (если есть)",
      },
      {
        name: "violationSubject",
        type: "text",
        required: true,
        label: "Суть нарушения (краткая формулировка)",
      },
      {
        name: "circumstances",
        type: "textarea",
        required: true,
        label: "Обстоятельства и факты нарушения",
        defaultValue:
          "Изложите хронологию событий, даты обращений, реквизиты документов и существо нарушения ваших прав.",
      },
      {
        name: "legalBasis",
        type: "textarea",
        required: false,
        label: "Ссылки на нормы законодательства",
        defaultValue:
          "Административный процедурно-процессуальный кодекс Республики Казахстан",
      },
      {
        name: "demands",
        type: "textarea",
        required: true,
        label: "Требования заявителя",
        defaultValue:
          "Рассмотреть настоящую жалобу, признать действия (бездействие) незаконными и принять меры по восстановлению нарушенных прав.",
      },
      {
        name: "attachments",
        type: "textarea",
        required: false,
        label: "Перечень приложений (по одному в строке)",
      },
      {
        name: "responseRequested",
        type: "boolean",
        required: false,
        label: "Просить направить письменный ответ",
        defaultValue: true,
      },
      {
        name: "city",
        type: "text",
        required: true,
        label: "Город (место подачи)",
        defaultValue: "Алматы",
      },
      {
        name: "complaintDate",
        type: "date",
        required: true,
        label: "Дата подачи жалобы",
      },
    ],
    typstContent: `#set document(title: "Жалоба в государственный орган")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: true)

// === АДРЕСНЫЙ БЛОК ===
#align(right)[
  #block(width: 60%)[
    #align(left)[
      В {{authorityName}}\\
      #if "{{authorityAddress}}" != "" [Адрес: {{authorityAddress}}\\ ]
      #v(0.5em)
      От #if "{{applicantType}}" == "Юридическое лицо" [{{applicantCompanyName}}, БИН {{applicantBIN}}, в лице {{applicantRepFIO}}] else [{{applicantFIO}}, ИИН {{applicantIIN}}]\\
      Адрес: {{applicantAddress}}\\
      #if "{{applicantPhone}}" != "" [Тел.: {{applicantPhone}}]
    ]
  ]
]

#v(1.5em)

#align(center)[
  #text(size: 16pt, weight: "bold")[ЖАЛОБА]
]

#align(center)[
  на {{violationSubject}}#if "{{officialName}}" != "" [ (должностное лицо: {{officialName}})]
]

#v(1em)

== 1. Обстоятельства дела

{{circumstances}}

#v(0.5em)

#if "{{officialName}}" != "" [
  Указанные нарушения допущены должностным лицом — {{officialName}}, в результате чего нарушены права и законные интересы заявителя.
] else [
  В результате указанных действий (бездействия) государственного органа нарушены права и законные интересы заявителя.
]

#v(0.5em)

== 2. Правовое обоснование

#if "{{legalBasis}}" != "" [
  Считаю, что описанные действия (бездействие) противоречат требованиям законодательства Республики Казахстан, в том числе: {{legalBasis}}.
] else [
  Считаю, что описанные действия (бездействие) противоречат требованиям законодательства Республики Казахстан.
]

#v(0.5em)

На основании изложенного и руководствуясь нормами Административного процедурно-процессуального кодекса Республики Казахстан,

== 3. Прошу

{{demands}}

#if {{responseRequested}} [
  #v(0.5em)
  Прошу рассмотреть настоящую жалобу в установленный законом срок и направить мотивированный письменный ответ по адресу заявителя, указанному выше.
]

#v(0.5em)

#if "{{attachments}}" != "" [
  == Приложения

  {{attachments}}

  #v(0.5em)
]

#v(2em)

#grid(
  columns: (1fr, 1fr),
  align(left)[г. {{city}}],
  align(right)[{{complaintDate}}]
)

#v(2em)

#align(left)[
  #if "{{applicantType}}" == "Юридическое лицо" [
    {{applicantCompanyName}}\\
    {{applicantRepFIO}}
  ] else [
    {{applicantFIO}}
  ]
  #v(2em)
  #line(length: 50%)
  Подпись заявителя
]
`,
  },
  {
    id: "tpl_doverennost",
    title: "Доверенность",
    description:
      "Доверенность от имени физического или юридического лица, которой доверитель уполномочивает поверенного совершать определённые действия и сделки от его имени. Используется для представления интересов в государственных органах, банках, судах, при заключении сделок и в иных случаях, когда требуется письменное подтверждение полномочий представителя.",
    price: 1990,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "city",
        type: "text",
        required: true,
        label: "Город (место составления)",
        defaultValue: "Алматы",
      },
      {
        name: "issueDate",
        type: "date",
        required: true,
        label: "Дата выдачи доверенности",
      },
      {
        name: "principalType",
        type: "select",
        required: true,
        label: "Тип доверителя",
        defaultValue: "Физическое лицо",
        options: ["Физическое лицо", "Юридическое лицо"],
      },
      {
        name: "principalFIO",
        type: "text",
        required: true,
        label: "ФИО доверителя (или представителя юрлица)",
      },
      {
        name: "principalIIN",
        type: "text",
        required: true,
        label: "ИИН доверителя",
      },
      {
        name: "principalDocDetails",
        type: "text",
        required: true,
        label:
          "Паспорт / удостоверение личности доверителя (№, кем и когда выдан)",
        dependsOn: { field: "principalType", value: "Физическое лицо" },
      },
      {
        name: "principalAddress",
        type: "text",
        required: true,
        label: "Адрес проживания доверителя",
      },
      {
        name: "principalCompanyName",
        type: "text",
        required: false,
        label: "Наименование юридического лица (доверитель)",
        dependsOn: { field: "principalType", value: "Юридическое лицо" },
      },
      {
        name: "principalBIN",
        type: "text",
        required: false,
        label: "БИН юридического лица",
        dependsOn: { field: "principalType", value: "Юридическое лицо" },
      },
      {
        name: "principalPosition",
        type: "text",
        required: false,
        label: "Должность представителя юрлица (на основании Устава)",
        dependsOn: { field: "principalType", value: "Юридическое лицо" },
      },
      {
        name: "attorneyFIO",
        type: "text",
        required: true,
        label: "ФИО поверенного",
      },
      {
        name: "attorneyIIN",
        type: "text",
        required: true,
        label: "ИИН поверенного",
      },
      {
        name: "attorneyDocDetails",
        type: "text",
        required: true,
        label:
          "Паспорт / удостоверение личности поверенного (№, кем и когда выдан)",
      },
      {
        name: "attorneyAddress",
        type: "text",
        required: true,
        label: "Адрес проживания поверенного",
      },
      {
        name: "powersList",
        type: "textarea",
        required: true,
        label: "Перечень полномочий (каждое с новой строки)",
      },
      {
        name: "validityPeriod",
        type: "select",
        required: true,
        label: "Срок действия доверенности",
        defaultValue: "До конкретной даты",
        options: ["До конкретной даты", "В течение определённого срока"],
      },
      {
        name: "validUntilDate",
        type: "date",
        required: false,
        label: "Доверенность действительна до (дата)",
        dependsOn: { field: "validityPeriod", value: "До конкретной даты" },
      },
      {
        name: "validityTerm",
        type: "text",
        required: false,
        label: "Срок действия (например: один год с даты выдачи)",
        dependsOn: {
          field: "validityPeriod",
          value: "В течение определённого срока",
        },
      },
      {
        name: "subdelegationAllowed",
        type: "boolean",
        required: true,
        label: "Право передоверия предоставляется",
        defaultValue: false,
      },
    ],
    typstContent: `#set document(title: "Доверенность")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: true)

#align(center)[
  #text(size: 16pt, weight: "bold")[ДОВЕРЕННОСТЬ]
]

#v(0.5em)

#grid(
  columns: (1fr, 1fr),
  align(left)[г. {{city}}],
  align(right)[{{issueDate}}]
)

#v(1em)

// === ДОВЕРИТЕЛЬ ===
#if "{{principalType}}" == "Юридическое лицо" [
  {{principalCompanyName}}, БИН {{principalBIN}}, юридический адрес: {{principalAddress}}, в лице {{principalPosition}} {{principalFIO}} (ИИН {{principalIIN}}), действующего на основании Устава, именуемое в дальнейшем «Доверитель»,
] else [
  Я, {{principalFIO}}, ИИН {{principalIIN}}, документ, удостоверяющий личность: {{principalDocDetails}}, проживающий(ая) по адресу: {{principalAddress}}, именуемый(ая) в дальнейшем «Доверитель»,
]

#v(0.5em)

настоящей доверенностью уполномочиваю:

#v(0.5em)

{{attorneyFIO}}, ИИН {{attorneyIIN}}, документ, удостоверяющий личность: {{attorneyDocDetails}}, проживающий(ая) по адресу: {{attorneyAddress}}, именуемый(ая) в дальнейшем «Поверенный»,

#v(0.5em)

совершать от имени и в интересах Доверителя следующие действия:

#v(0.5em)

// ============================================================
// 1. ПОЛНОМОЧИЯ
// ============================================================
== 1. Полномочия поверенного

{{powersList}}

#v(0.5em)

Для выполнения указанных полномочий Поверенный вправе подавать и получать от имени Доверителя необходимые заявления, справки, документы и иные сведения, расписываться и совершать иные юридически значимые и фактические действия, связанные с исполнением настоящего поручения, в пределах предоставленных ему полномочий.

#v(0.5em)

// ============================================================
// 2. СРОК ДЕЙСТВИЯ
// ============================================================
== 2. Срок действия доверенности

#if "{{validityPeriod}}" == "До конкретной даты" [
  2.1. Настоящая доверенность выдана и действительна по {{validUntilDate}} включительно.
] else [
  2.1. Настоящая доверенность выдана сроком на {{validityTerm}}.
]

2.2. Доверенность может быть в любое время отменена Доверителем, а Поверенный вправе отказаться от неё, о чём другая сторона должна быть уведомлена в порядке, предусмотренном законодательством Республики Казахстан.

#v(0.5em)

// ============================================================
// 3. ПЕРЕДОВЕРИЕ
// ============================================================
== 3. Право передоверия

#if {{subdelegationAllowed}} [
  3.1. Поверенному предоставляется право передоверия предоставленных по настоящей доверенности полномочий другим лицам с соблюдением требований законодательства Республики Казахстан.
] else [
  3.1. Полномочия по настоящей доверенности не могут быть переданы (передоверены) другим лицам.
]

#v(1em)

Настоящая доверенность составлена в соответствии с требованиями Гражданского кодекса Республики Казахстан. Содержание статей законодательства о полномочиях, сроке действия и прекращении доверенности Доверителю разъяснено и понятно.

#v(2em)

// === ПОДПИСЬ ДОВЕРИТЕЛЯ ===
*Доверитель:*

#v(2em)

#line(length: 60%)
#if "{{principalType}}" == "Юридическое лицо" [
  {{principalPosition}} {{principalFIO}} / подпись / М.П.
] else [
  {{principalFIO}} / подпись
]
`,
  },
  {
    id: "tpl_garantiynoe_pismo",
    title: "Гарантийное письмо",
    description:
      "Гарантийное письмо об оплате или исполнении обязательства, в котором отправитель официально подтверждает получателю свои намерения и гарантирует исполнение в указанный срок. Используется в деловой переписке для подтверждения платёжеспособности, намерения заключить договор или своевременной оплаты задолженности.",
    price: 1990,
    currentVersion: 1,
    isPublished: true,
    variables: [
      {
        name: "city",
        type: "text",
        required: true,
        label: "Город составления",
        defaultValue: "Алматы",
      },
      {
        name: "letterDate",
        type: "date",
        required: true,
        label: "Дата письма",
      },
      {
        name: "outgoingNumber",
        type: "text",
        required: false,
        label: "Исходящий номер",
      },
      {
        name: "senderType",
        type: "select",
        required: true,
        label: "Тип отправителя",
        defaultValue: "Юридическое лицо",
        options: ["Юридическое лицо", "ИП", "Физическое лицо"],
      },
      {
        name: "senderName",
        type: "text",
        required: true,
        label: "Наименование / ФИО отправителя",
        defaultValue: "ТОО «Компания»",
      },
      {
        name: "senderBIN",
        type: "text",
        required: false,
        label: "БИН/ИИН отправителя",
        dependsOn: { field: "senderType", value: "Юридическое лицо" },
      },
      {
        name: "senderAddress",
        type: "text",
        required: true,
        label: "Адрес отправителя",
      },
      {
        name: "directorPosition",
        type: "text",
        required: true,
        label: "Должность подписанта",
        defaultValue: "Директор",
      },
      {
        name: "directorName",
        type: "text",
        required: true,
        label: "ФИО руководителя (подписанта)",
      },
      {
        name: "recipientName",
        type: "text",
        required: true,
        label: "Наименование / ФИО получателя",
      },
      {
        name: "recipientAddress",
        type: "text",
        required: false,
        label: "Адрес получателя",
      },
      {
        name: "guaranteeSubject",
        type: "select",
        required: true,
        label: "Предмет гарантии",
        defaultValue: "Оплата задолженности",
        options: [
          "Оплата задолженности",
          "Оплата по договору",
          "Исполнение обязательства",
        ],
      },
      {
        name: "obligationDescription",
        type: "textarea",
        required: true,
        label: "Описание обязательства / основание",
      },
      {
        name: "guaranteeAmount",
        type: "number",
        required: true,
        label: "Сумма гарантии (тенге)",
      },
      {
        name: "fulfillmentDate",
        type: "date",
        required: true,
        label: "Срок исполнения / оплаты",
      },
      {
        name: "addPenaltyClause",
        type: "boolean",
        required: false,
        label: "Добавить пункт о пене за просрочку",
        defaultValue: false,
      },
      {
        name: "penaltyRate",
        type: "number",
        required: false,
        label: "Размер пени, % за день просрочки",
        defaultValue: 0.1,
        dependsOn: { field: "addPenaltyClause", value: "true" },
      },
    ],
    typstContent: `#set document(title: "Гарантийное письмо")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: true)

#grid(
  columns: (1fr, 1fr),
  align(left)[
    #if "{{senderType}}" == "Юридическое лицо" [
      {{senderName}}\\
      #if "{{senderBIN}}" != "" [БИН: {{senderBIN}}\\ ]
    ] else if "{{senderType}}" == "ИП" [
      ИП {{senderName}}\\
    ] else [
      {{senderName}}\\
    ]
    {{senderAddress}}\\
    #if "{{outgoingNumber}}" != "" [Исх. № {{outgoingNumber}} от {{letterDate}}]
  ],
  align(right)[
    Кому: {{recipientName}}\\
    #if "{{recipientAddress}}" != "" [{{recipientAddress}}]
  ]
)

#v(1em)

#align(center)[
  #text(size: 16pt, weight: "bold")[ГАРАНТИЙНОЕ ПИСЬМО]
]

#v(0.5em)

#grid(
  columns: (1fr, 1fr),
  align(left)[г. {{city}}],
  align(right)[{{letterDate}}]
)

#v(1em)

Уважаемый(ая) представитель {{recipientName}}!

#v(0.5em)

#if "{{guaranteeSubject}}" == "Оплата задолженности" [
  Настоящим письмом
  #if "{{senderType}}" == "Юридическое лицо" [ {{senderName}} ]
  else if "{{senderType}}" == "ИП" [ ИП {{senderName}} ]
  else [ {{senderName}} ]
  гарантирует оплату имеющейся перед Вами задолженности по следующему основанию: {{obligationDescription}}.
] else if "{{guaranteeSubject}}" == "Оплата по договору" [
  Настоящим письмом
  #if "{{senderType}}" == "Юридическое лицо" [ {{senderName}} ]
  else if "{{senderType}}" == "ИП" [ ИП {{senderName}} ]
  else [ {{senderName}} ]
  гарантирует оплату по принятым на себя обязательствам, а именно: {{obligationDescription}}.
] else [
  Настоящим письмом
  #if "{{senderType}}" == "Юридическое лицо" [ {{senderName}} ]
  else if "{{senderType}}" == "ИП" [ ИП {{senderName}} ]
  else [ {{senderName}} ]
  гарантирует надлежащее исполнение принятого на себя обязательства, а именно: {{obligationDescription}}.
]

#v(0.5em)

== Условия гарантии

+ Сумма, в отношении которой предоставляется настоящая гарантия, составляет {{guaranteeAmount}} (сумма прописью) тенге.

+ #if "{{guaranteeSubject}}" == "Исполнение обязательства" [
  Указанное обязательство будет исполнено в полном объёме в срок до *{{fulfillmentDate}}*.
] else [
  Указанная сумма будет перечислена (оплачена) в полном объёме в срок до *{{fulfillmentDate}}*.
]

+ Платёжные реквизиты получателя должны быть предоставлены отправителю по адресу: {{senderAddress}}, либо иным согласованным Сторонами способом.

#if {{addPenaltyClause}} [
  + В случае нарушения указанного срока отправитель обязуется уплатить пеню в размере {{penaltyRate}}% от суммы неисполненного обязательства за каждый день просрочки.
]

#v(0.5em)

Настоящее гарантийное письмо составлено в соответствии с законодательством Республики Казахстан и подтверждает действительные намерения отправителя по исполнению указанного обязательства.

#v(2em)

С уважением,

#v(0.5em)

{{directorPosition}}
#if "{{senderType}}" == "Юридическое лицо" [ {{senderName}} ]

#v(2em)

#line(length: 40%)
{{directorName}}

#v(0.5em)
М.П.
`,
  },
];

async function seed() {
  console.log("Seeding templates...");

  for (const t of templates) {
    const taxonomy = TEMPLATE_TAXONOMY[t.id] ?? EMPTY_TAXONOMY;
    const [existing] = await db
      .select({ id: template.id })
      .from(template)
      .where(eq(template.id, t.id))
      .limit(1);

    if (existing) {
      await db
        .update(template)
        .set({
          title: t.title,
          description: t.description,
          price: t.price,
          typstContent: t.typstContent,
          variables: t.variables,
          currentVersion: t.currentVersion,
          isPublished: t.isPublished,
          categories: taxonomy.categories,
          documentType: taxonomy.documentType,
          downloadPrice: Math.round(t.price / 2),
        })
        .where(eq(template.id, t.id));

      console.log(`  Updated template: ${t.title}`);
    } else {
      await db.insert(template).values({
        id: t.id,
        title: t.title,
        description: t.description,
        price: t.price,
        typstContent: t.typstContent,
        variables: t.variables,
        currentVersion: t.currentVersion,
        isPublished: t.isPublished,
        categories: taxonomy.categories,
        documentType: taxonomy.documentType,
        downloadPrice: Math.round(t.price / 2),
      });

      await db.insert(templateVersion).values({
        id: `${t.id}_v1`,
        templateId: t.id,
        version: 1,
        typstContent: t.typstContent,
        variables: t.variables,
        changelog: "Initial version",
      });

      console.log(`  Created template: ${t.title}`);
    }
  }

  console.log(`Seeded ${templates.length} templates successfully!`);

  for (const plan of subscriptionPlans) {
    const [existing] = await db
      .select({ id: subscriptionPlan.id })
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.id, plan.id))
      .limit(1);
    if (existing) {
      await db
        .update(subscriptionPlan)
        .set(plan)
        .where(eq(subscriptionPlan.id, plan.id));
      console.log(`  Updated plan: ${plan.name}`);
    } else {
      await db.insert(subscriptionPlan).values(plan);
      console.log(`  Created plan: ${plan.name}`);
    }
  }
  console.log(`Seeded ${subscriptionPlans.length} subscription plans!`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
