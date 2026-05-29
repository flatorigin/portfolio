export const HOMEOWNER_CHECK_STORAGE_KEY = "flatorigin_project_check_homeowner";
export const CONTRACTOR_CHECK_STORAGE_KEY = "flatorigin_project_check_contractor";
export const PROJECT_CHECK_TRANSFER_KEY = "flatorigin_project_check_transfer";

export const PROJECT_CATEGORIES = [
  {
    slug: "deck",
    name: "Deck",
    questions: [
      {
        id: "project_type",
        label: "Is this a new deck or an existing deck project?",
        type: "select",
        required: true,
        options: ["New deck", "Resurface existing deck", "Repair existing deck", "Expand existing deck"],
      },
      { id: "deck_sqf", label: "Approximate square footage", type: "number", required: true },
      {
        id: "material",
        label: "Preferred material",
        type: "select",
        required: true,
        options: ["Pressure treated", "Cedar", "Trex", "Composite", "Not sure"],
      },
      { id: "stairs", label: "Include stairs?", type: "select", options: ["Yes", "No", "Not sure"] },
      { id: "railings", label: "Include railings?", type: "select", options: ["Yes", "No", "Not sure"] },
    ],
  },
  {
    slug: "painting",
    name: "Painting",
    questions: [
      { id: "paint_location", label: "Interior or exterior?", type: "select", required: true, options: ["Interior", "Exterior", "Both"] },
      { id: "room_count", label: "Number of rooms or areas", type: "number", required: true },
      { id: "wall_repair", label: "Wall repair needed?", type: "select", options: ["Yes", "No", "Not sure"] },
      { id: "paint_supply", label: "Who supplies paint?", type: "select", options: ["Homeowner", "Contractor", "Not sure"] },
    ],
  },
  {
    slug: "flooring",
    name: "Flooring",
    questions: [
      { id: "flooring_type", label: "Flooring type", type: "select", required: true, options: ["Hardwood", "Laminate", "Vinyl", "Tile", "Carpet", "Other"] },
      { id: "sqf", label: "Approximate square footage", type: "number", required: true },
      { id: "remove_existing", label: "Remove existing flooring?", type: "select", options: ["Yes", "No", "Not sure"] },
    ],
  },
  {
    slug: "hvac",
    name: "HVAC",
    questions: [
      { id: "service_type", label: "Repair or replacement?", type: "select", required: true, options: ["Repair", "Replacement", "Maintenance", "Not sure"] },
      { id: "system_type", label: "System type", type: "select", required: true, options: ["Central air", "Heat pump", "Mini split", "Furnace", "Boiler", "Not sure"] },
      { id: "problem_description", label: "Describe the issue", type: "textarea", required: true },
    ],
  },
  {
    slug: "plumbing",
    name: "Plumbing",
    questions: [
      { id: "plumbing_type", label: "Repair or installation?", type: "select", required: true, options: ["Repair", "Install", "Replacement"] },
      { id: "fixture_type", label: "Fixture or system", type: "text", required: true },
      { id: "active_leak", label: "Active leak?", type: "select", options: ["Yes", "No", "Not sure"] },
    ],
  },
  {
    slug: "electrical",
    name: "Electrical",
    questions: [
      { id: "electrical_type", label: "Repair or new installation?", type: "select", required: true, options: ["Repair", "Install", "Upgrade"] },
      { id: "panel_work", label: "Panel work involved?", type: "select", options: ["Yes", "No", "Not sure"] },
      { id: "fixture_count", label: "Approximate number of fixtures/outlets", type: "number" },
    ],
  },
  {
    slug: "roofing",
    name: "Roofing",
    questions: [
      { id: "roof_project_type", label: "Repair or replacement?", type: "select", required: true, options: ["Repair", "Replacement", "Inspection"] },
      { id: "leak_present", label: "Leak present?", type: "select", required: true, options: ["Yes", "No"] },
      { id: "roof_age", label: "Approximate roof age", type: "text" },
    ],
  },
  {
    slug: "landscaping",
    name: "Landscaping",
    questions: [
      { id: "landscape_type", label: "Maintenance or new installation?", type: "select", required: true, options: ["Maintenance", "New installation", "Hardscaping"] },
      { id: "area_size", label: "Approximate area size", type: "text" },
      { id: "drainage_issue", label: "Drainage concerns?", type: "select", options: ["Yes", "No", "Not sure"] },
    ],
  },
  {
    slug: "kitchen",
    name: "Kitchen",
    questions: [
      { id: "remodel_type", label: "Full remodel or partial update?", type: "select", required: true, options: ["Full remodel", "Partial remodel"] },
      { id: "cabinets", label: "Cabinets included?", type: "select", options: ["Yes", "No"] },
      { id: "countertops", label: "Countertops included?", type: "select", options: ["Yes", "No"] },
    ],
  },
  {
    slug: "bathroom",
    name: "Bathroom",
    questions: [
      { id: "bathroom_scope", label: "Full remodel or partial update?", type: "select", required: true, options: ["Full remodel", "Partial remodel"] },
      { id: "tub_shower", label: "Tub or shower work included?", type: "select", options: ["Yes", "No"] },
      { id: "tile_work", label: "Tile work included?", type: "select", options: ["Yes", "No"] },
    ],
  },
  {
    slug: "other",
    name: "Other",
    questions: [
      { id: "scope_type", label: "What kind of work is this?", type: "text", required: true },
      { id: "size", label: "Approximate size or area", type: "text" },
      { id: "main_unknown", label: "What is the biggest unknown?", type: "textarea" },
    ],
  },
];

export const HOMEOWNER_GENERAL_FIELDS = [
  { id: "category", label: "Project category", type: "category", weight: 10, missingLabel: "Project category" },
  { id: "description", label: "Project description", type: "textarea", weight: 12, missingLabel: "Project description" },
  { id: "location", label: "Location area / ZIP", type: "text", weight: 8, missingLabel: "Location area or ZIP" },
  { id: "budget", label: "Approximate budget", type: "text", weight: 8, missingLabel: "Approximate budget" },
  { id: "timeline", label: "Desired timeline", type: "text", weight: 8, missingLabel: "Desired timeline" },
  { id: "photos", label: "Photos attached?", type: "yesno", weight: 12, missingLabel: "Photos" },
  { id: "condition", label: "Existing condition described?", type: "yesno", weight: 8, missingLabel: "Existing condition" },
  { id: "measurements", label: "Measurements included?", type: "yesno", weight: 12, missingLabel: "Approximate measurements" },
  { id: "materials", label: "Material preference selected?", type: "yesno", weight: 8, missingLabel: "Material preference" },
  { id: "demo", label: "Demo/removal included?", type: "yesno_unsure", weight: 5, missingLabel: "Demo/removal details" },
  { id: "cleanup", label: "Cleanup/debris removal included?", type: "yesno_unsure", weight: 5, missingLabel: "Cleanup/removal details" },
  { id: "permit", label: "Permit may be needed?", type: "yesno_unsure", weight: 4, missingLabel: "Permit question" },
  { id: "access", label: "Access issues?", type: "yesno_unsure", weight: 4, missingLabel: "Access details" },
  { id: "damage", label: "Any known damage or hidden issues?", type: "yesno_unsure", weight: 4, missingLabel: "Known damage or hidden issues" },
  { id: "notes", label: "Notes", type: "textarea", weight: 0, missingLabel: "Notes" },
];

export const CONTRACTOR_LEAD_FIELDS = [
  { id: "category", label: "Project category", type: "category", weight: 8, missingLabel: "Project category" },
  { id: "scope", label: "Does the homeowner describe the scope clearly?", type: "yesno", weight: 13, missingLabel: "Clear scope" },
  { id: "photos", label: "Are photos available?", type: "yesno", weight: 13, missingLabel: "Photos" },
  { id: "measurements", label: "Are measurements or size included?", type: "yesno", weight: 13, missingLabel: "Measurements or size" },
  { id: "budget", label: "Is budget mentioned?", type: "yesno", weight: 8, missingLabel: "Budget" },
  { id: "timeline", label: "Is timeline mentioned?", type: "yesno", weight: 8, missingLabel: "Timeline" },
  { id: "materials", label: "Are materials selected?", type: "yesno_unsure", weight: 7, missingLabel: "Material selection" },
  { id: "access", label: "Is access to the work area clear?", type: "yesno_unsure", weight: 6, missingLabel: "Access to work area" },
  { id: "demo", label: "Are demo/removal expectations clear?", type: "yesno_unsure", weight: 6, missingLabel: "Demo/removal expectations" },
  { id: "cleanup", label: "Is cleanup included or discussed?", type: "yesno_unsure", weight: 6, missingLabel: "Cleanup/disposal expectations" },
  { id: "permit", label: "Are permits or code issues mentioned?", type: "yesno_unsure", weight: 5, missingLabel: "Permits or code issues" },
  { id: "hidden", label: "Are possible hidden issues mentioned?", type: "yesno_unsure", weight: 5, missingLabel: "Hidden issues" },
  { id: "contact", label: "Is the homeowner's contact information complete?", type: "yesno", weight: 6, missingLabel: "Contact information" },
  { id: "location", label: "Is the project location clear?", type: "yesno", weight: 6, missingLabel: "Project location" },
  { id: "notes", label: "Notes", type: "textarea", weight: 0, missingLabel: "Notes" },
];

export const HOMEOWNER_QUESTIONS = [
  "Is debris removal included?",
  "Are materials included in the quote?",
  "What could change the final price?",
  "What is not included in this estimate?",
  "Do you expect permits or inspections?",
  "What information would help you price this more accurately?",
];

export const CONTRACTOR_FOLLOW_UP_QUESTIONS = [
  "Can you send photos of the current condition?",
  "What size or measurements are involved?",
  "Are materials already selected?",
  "Is cleanup or disposal expected?",
  "What is your target timeline?",
  "Are there any known issues or previous repairs?",
];
