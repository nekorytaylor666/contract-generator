import dotenv from "dotenv";

dotenv.config({
  path: "../../apps/server/.env",
});

const { db } = await import("./index");
const { template, templateVersion } = await import("./schema/template");
const { eq } = await import("drizzle-orm");

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
        name: "landlordAuthDocument",
        type: "text",
        required: false,
        label: "Документ-основание арендодателя",
        defaultValue: "Устав",
        dependsOn: {
          field: "landlordType",
          value: ["Юридическое лицо", "ИП"],
          operator: "in",
        },
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
        name: "tenantAuthDocument",
        type: "text",
        required: false,
        label: "Документ-основание арендатора",
        defaultValue: "Устав",
        dependsOn: {
          field: "tenantType",
          value: ["Юридическое лицо", "ИП"],
          operator: "in",
        },
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
      },
      {
        name: "returnPeriodDays",
        type: "number",
        required: true,
        label: "Срок возврата объекта (дни)",
        defaultValue: 5,
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
      },
      {
        name: "hiddenDefectDays",
        type: "number",
        required: true,
        label: "Срок уведомления о скрытых недостатках (дни)",
        defaultValue: 5,
      },
      // === Force Majeure ===
      {
        name: "forceMajeureNotifyDays",
        type: "number",
        required: true,
        label: "Уведомление о форс-мажоре (дни)",
        defaultValue: 3,
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
      },
    ],
    typstContent: `#set document(title: "Договор аренды")
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 11pt)

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
  {{landlordCompanyName}}, в лице {{landlordPosition}} {{landlordFIO}}, действующего на основании {{landlordAuthDocument}}, БИН {{landlordBIN}}, именуемое в дальнейшем «Арендодатель» с одной стороны,
] else if "{{landlordType}}" == "ИП" [
  Индивидуальный предприниматель {{landlordFIO}}, действующий на основании {{landlordAuthDocument}}, ИИН {{landlordIIN}}, именуемый в дальнейшем «Арендодатель» с одной стороны,
] else [
  {{landlordFIO}}, ИИН {{landlordIIN}}, именуемый в дальнейшем «Арендодатель» с одной стороны,
]

и

// === ПРЕАМБУЛА: АРЕНДАТОР ===
#if "{{tenantType}}" == "Юридическое лицо" [
  {{tenantCompanyName}}, в лице {{tenantPosition}} {{tenantFIO}}, действующего на основании {{tenantAuthDocument}}, БИН {{tenantBIN}}, именуемое в дальнейшем «Арендатор» с другой стороны,
] else if "{{tenantType}}" == "ИП" [
  Индивидуальный предприниматель {{tenantFIO}}, действующий на основании {{tenantAuthDocument}}, ИИН {{tenantIIN}}, именуемый в дальнейшем «Арендатор» с другой стороны,
] else [
  {{tenantFIO}}, ИИН {{tenantIIN}}, именуемый в дальнейшем «Арендатор» с другой стороны,
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

3.1. Передача Объекта аренды осуществляется в течение {{transferDays}} календарных дней с даты подписания настоящего Договора, если иные сроки не установлены Сторонами.

3.2. Передача оформляется Актом приёма-передачи Объекта аренды (Приложение к настоящему Договору), подписываемым обеими Сторонами.

3.3. В Акте фиксируется:
- техническое и/или физическое состояние Объекта аренды;
- сведения о принадлежностях, комплектности, документах;
- состояние основных элементов (коммуникации, узлы, механизмы, счётчики, пробег ТС, дата последнего ТО и пр.);
- перечень выявленных недостатков и их характер.

3.4. Стороны вправе приложить к Договору: фотофиксацию состояния Объекта аренды; опись имущества и принадлежностей; показания приборов учёта.

3.5. В случае выявления скрытых недостатков Арендатор обязан уведомить Арендодателя в течение {{hiddenDefectDays}} рабочих дней с момента обнаружения.

3.6. По окончании срока действия Договора либо его досрочном прекращении Арендатор обязан возвратить Объект аренды в течение {{returnPeriodDays}} календарных дней с даты прекращения Договора.

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

6.4. Сторона, инициирующая расторжение, обязана уведомить другую Сторону за срок не менее {{noticePeriodDays}} календарных дней.

6.5. Арендатор обязан в срок не позднее {{returnPeriodDays}} дней с даты прекращения Договора возвратить Объект аренды по акту приёма-передачи.

6.6. Обязательства Сторон по уплате начисленных арендных платежей, неустоек, возмещению убытков и расходов, возникших до даты расторжения, сохраняют силу до их полного исполнения.

// === 6.7. Пролонгация ===
#if "{{prolongation}}" == "Однократная" [
  6.7. Срок действия Договора может быть продлён (пролонгирован) один раз на срок, равный первоначальному сроку аренды, при условии письменного согласия обеих Сторон.
] else if "{{prolongation}}" == "Автоматическая без ограничений" [
  6.7. Договор подлежит автоматической пролонгации на каждый последующий аналогичный срок, если ни одна из Сторон не заявит о прекращении его действия за {{prolongationNoticeDays}} дней до окончания очередного срока.
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

7.3. Сторона, для которой создалась невозможность исполнения обязательств (форс-мажор) по настоящему Договору, должна письменно в течение {{forceMajeureNotifyDays}} календарных дней известить об этом другую Сторону и представить доказательства наступления подобных обстоятельств.

7.4. В случае возникновения обстоятельств непреодолимой силы срок выполнения обязательств по настоящему Договору отодвигается соразмерно времени, в течение которого действуют эти обстоятельства и их последствия. В случае, если форс-мажор продолжается более {{forceMajeureDurationMonths}} календарных месяцев после его наступления, любая из Сторон вправе прервать действие настоящего Договора, письменно уведомив об этом другую Сторону не позднее чем за {{forceMajeureTermNoticeDays}} рабочих дней, при этом Арендодатель обязуется незамедлительно возвратить Арендатору в полном объёме сумму неиспользованной части арендной платы.

7.5. Настоящий Договор составляет и выражает все договорные условия и понимание между участвующими здесь Сторонами в отношении всех упомянутых здесь вопросов, при этом все предыдущие обсуждения, обещания и представления между Сторонами, если таковые имелись, теряют силу.

7.6. Договор заключён и подписан уполномоченными представителями Сторон, имеющими все необходимые и достаточные полномочия для заключения и подписания Договора.

7.7. Арендодатель гарантирует Арендатору, что Объект передаётся в аренду с соблюдением положений законодательства Республики Казахстан.

7.8. Договор составлен в 2-х экземплярах, на русском языке, каждый из которых обладает одинаковой юридической силой.

7.9. Все изменения и дополнения к Договору оформляются в письменной форме и подписываются обеими Сторонами.

#v(0.5em)

// ============================================================
// 8. ЮРИДИЧЕСКИЕ АДРЕСА И ПОДПИСИ СТОРОН
// ============================================================
== 8. Юридические адреса и подписи сторон

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
];

async function seed() {
  console.log("Seeding templates...");

  for (const t of templates) {
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
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
