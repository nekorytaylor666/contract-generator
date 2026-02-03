import dotenv from "dotenv";

dotenv.config({
  path: "../../apps/server/.env",
});

const { db } = await import("./index");
const { template, templateVersion } = await import("./schema/template");

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
];

async function seed() {
  console.log("Seeding templates...");

  for (const t of templates) {
    console.log(`  Creating template: ${t.title}`);

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
  }

  console.log(`Seeded ${templates.length} templates successfully!`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
