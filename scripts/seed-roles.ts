import "dotenv/config";
import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { RecruitmentRole, RecruitmentRoleSection, RecruitmentRoleField } from "../lib/types/recruitment";

const serviceAccount: ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);

const WHATSAPP_LINK = "https://chat.whatsapp.com/EnIx8a3HL4u0JXND6otEkl?s=sw&p=a&mlu=4&ilr=4";
const INFO_BLOCK: RecruitmentRoleField = {
  name: "whatsapp_group",
  label: "Join WhatsApp Group",
  type: "info",
  section: 2,
  required: false,
  order: 99,
  content: "Please join our WhatsApp group for the latest updates regarding the recruitment process.",
  links: [{ label: "Join WhatsApp Group", url: WHATSAPP_LINK }]
};

const RESUME_FIELD: RecruitmentRoleField = {
  name: "resume",
  label: "Resume",
  type: "file",
  section: 2,
  required: true,
  order: 98,
  accept: ".pdf,.doc,.docx",
  allowedExtensions: [".pdf", ".doc", ".docx"],
  maxSizeMB: 5,
  driveFolderId: "" // Needs to be filled in admin dashboard later
};

const SECTIONS: RecruitmentRoleSection[] = [
  {
    number: 1,
    title: "Personal Info",
    description: "Your basic details",
    borderColor: "#EA4335"
  },
  {
    number: 2,
    title: "Professional Information",
    description: "Please provide details about your experience and skills.",
    borderColor: "#4285F4"
  }
];

const SECTION_1_FIELDS: RecruitmentRoleField[] = [
  {
    name: "fullName",
    label: "Full Name",
    type: "text",
    section: 1,
    required: true,
    order: 0,
    placeholder: "Enter your full name",
    helpText: "Autofilled from your profile"
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    section: 1,
    required: true,
    order: 1,
    placeholder: "you@vishnu.edu.in",
    helpText: "Autofilled from your profile"
  },
  {
    name: "department",
    label: "Department",
    type: "select",
    section: 1,
    required: true,
    order: 2,
    options: [
      { label: "CSE", value: "CSE" },
      { label: "ECE", value: "ECE" },
      { label: "AI&ML", value: "AI&ML" },
      { label: "AI&DS", value: "AI&DS" },
      { label: "CS&BS", value: "CS&BS" },
      { label: "IT", value: "IT" },
      { label: "ME", value: "ME" },
      { label: "CE", value: "CE" },
      { label: "EEE", value: "EEE" }
    ]
    
  }
];

function createRole(id: string, title: string, color: string, icon: string, customFields: Omit<RecruitmentRoleField, "section" | "order">[]) {
  const fields: RecruitmentRoleField[] = [
    ...SECTION_1_FIELDS,
    ...customFields.map((f, i) => ({ ...f, section: 2, order: i } as RecruitmentRoleField)),
    { ...RESUME_FIELD, order: customFields.length },
    { ...INFO_BLOCK, order: customFields.length + 1 }
  ];

  const role: Omit<RecruitmentRole, "createdAt" | "updatedAt"> & { createdAt: any, updatedAt: any } = {
    id,
    title,
    description: `Recruitment for the ${title} team.`,
    icon,
    color,
    status: "draft",
    maxApplications: null,
    applicationStart: null,
    applicationEnd: null,
    sections: SECTIONS,
    fields,
    createdBy: "devadmin@gdgvitb.in",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  return role;
}

const roles = [
  createRole("marketing-outreach", "Marketing & Outreach", "#FBBC04", "campaign", [
    { name: "linkedin", label: "LinkedIn URL", type: "url", required: true },
    { name: "past_experience", label: "Past Experience in Marketing", type: "text", required: false, minLength: 0, maxLength: 1000 },
    { name: "why_marketing", label: "Why do you want to join Marketing?", type: "text", required: true, minLength: 50, maxLength: 2000 }
  ]),
  createRole("design", "Design", "#EA4335", "palette", [
    { name: "portfolio", label: "Portfolio Link (Behance / Dribbble / Drive)", type: "url", required: true },
    { name: "design_tools", label: "Preferred Design Tools (Figma, Illustrator, etc.)", type: "text", required: true, maxLength: 500 }
  ]),
  createRole("communication", "Communication", "#34A853", "forum", [
    { name: "linkedin", label: "LinkedIn URL", type: "url", required: true },
    { name: "writing_sample", label: "Writing sample / Blog link", type: "url", required: false },
    { name: "why_communication", label: "Why are you a good fit for Communication?", type: "text", required: true, minLength: 50, maxLength: 2000 }
  ]),
  createRole("cloud", "Cloud", "#4285F4", "cloud", [
    { name: "github", label: "GitHub Profile Link", type: "url", required: true },
    { name: "linkedin", label: "LinkedIn URL", type: "url", required: true },
    { name: "qwiklabs", label: "Qwiklabs Public Profile URL", type: "url", required: false },
    { name: "cloud_experience", label: "Experience with Cloud platforms (AWS/GCP/Azure)", type: "text", required: true, maxLength: 1000 }
  ]),
  createRole("ai-journalist", "AI Journalist", "#EA4335", "article", [
    { name: "linkedin", label: "LinkedIn URL", type: "url", required: true },
    { name: "published_articles", label: "Link to published articles/blogs on AI", type: "url", required: false },
    { name: "ai_trend", label: "Briefly describe a recent AI trend you find fascinating", type: "text", required: true, minLength: 100, maxLength: 3000 }
  ]),
  createRole("web-dev", "Full Stack Web Development", "#4285F4", "code", [
    { name: "github", label: "GitHub Profile Link", type: "url", required: true },
    { name: "linkedin", label: "LinkedIn URL", type: "url", required: true },
    { name: "tech_stack", label: "Tech Stack", type: "text", required: true, maxLength: 500 },
    { name: "experience_months", label: "Experience (in months)", type: "number", required: true }
  ]),
  createRole("video-editing", "Videography & Editing", "#FBBC04", "videocam", [
    { name: "portfolio", label: "Portfolio / Drive link of past edits", type: "url", required: true },
    { name: "software", label: "Editing Software Used", type: "text", required: true, maxLength: 200 },
    { name: "gear", label: "Gear used (optional)", type: "text", required: false, maxLength: 500 }
  ]),
  createRole("event-management", "Event Management", "#34A853", "event", [
    { name: "linkedin", label: "LinkedIn URL", type: "url", required: true },
    { name: "past_events", label: "Past events organized/managed", type: "text", required: false, maxLength: 2000 },
    { name: "high_pressure", label: "How do you handle high-pressure situations?", type: "text", required: true, minLength: 50, maxLength: 2000 }
  ])
];

async function seedRoles() {
  console.log("Seeding recruitment roles...");
  for (const role of roles) {
    await db.collection("recruitment_roles").doc(role.id).set(role);
    console.log(`Seeded role: ${role.title}`);
  }
  console.log("Finished seeding roles.");
}

seedRoles().catch(console.error).finally(() => process.exit(0));
