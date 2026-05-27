export const MAX_CONTRACTOR_CATEGORIES = 10;

export const CONTRACTOR_CATEGORY_GROUPS = [
  {
    title: "General Construction",
    options: [
      "General Contractor",
      "Residential Builder",
      "Commercial Builder",
      "Custom Home Builder",
      "Remodeling Contractor",
      "Renovation Contractor",
      "Design-Build Contractor",
    ],
  },
  {
    title: "Structural & Framing",
    options: [
      "Framing Contractor",
      "Concrete Contractor",
      "Foundation Contractor",
      "Masonry Contractor",
      "Structural Steel Contractor",
      "Rebar Contractor",
      "Demolition Contractor",
    ],
  },
  {
    title: "Exterior & Roofing",
    options: [
      "Roofing Contractor",
      "Siding Contractor",
      "Stucco Contractor",
      "Exterior Painting Contractor",
      "Window Installer",
      "Door Installer",
      "Gutter Contractor",
      "Deck Builder",
      "Fence Contractor",
      "Garage Door Installer",
    ],
  },
  {
    title: "Interior Trades",
    options: [
      "Drywall Contractor",
      "Insulation Contractor",
      "Interior Painter",
      "Flooring Contractor",
      "Tile Contractor",
      "Carpet Installer",
      "Finish Carpenter",
      "Cabinet Maker / Installer",
      "Countertop Installer",
      "Wallpaper Installer",
      "Trim & Millwork Contractor",
    ],
  },
  {
    title: "Mechanical / Utility Trades",
    options: [
      "Electrician",
      "HVAC Contractor",
      "Plumber",
      "Fire Sprinkler Contractor",
      "Elevator Contractor",
      "Generator Installer",
      "Solar Installer",
      "Low Voltage Contractor",
      "Smart Home Installer",
      "Security System Installer",
    ],
  },
  {
    title: "Site & Outdoor Work",
    options: [
      "Excavation Contractor",
      "Landscaping Contractor",
      "Hardscaping Contractor",
      "Asphalt / Paving Contractor",
      "Retaining Wall Contractor",
      "Pool Contractor",
      "Irrigation Contractor",
      "Tree Service Contractor",
      "Septic System Contractor",
      "Waterproofing Contractor",
    ],
  },
  {
    title: "Specialty Trades",
    options: [
      "Glass & Mirror Contractor",
      "Epoxy Flooring Contractor",
      "Restoration Contractor",
      "Historic Restoration Specialist",
      "Chimney Contractor",
      "Scaffolding Contractor",
      "Acoustical Ceiling Contractor",
      "Metal Fabrication Contractor",
      "Welding Contractor",
      "Stone Fabrication Contractor",
    ],
  },
  {
    title: "Industrial / Commercial Specialties",
    options: [
      "Commercial Kitchen Installer",
      "Office Fit-Out Contractor",
      "Warehouse Construction Contractor",
      "Retail Build-Out Contractor",
      "Medical Facility Contractor",
      "Industrial Mechanical Contractor",
      "Telecommunications Contractor",
      "Data Center Contractor",
    ],
  },
  {
    title: "Emerging / Modern Specialties",
    options: [
      "EV Charger Installer",
      "Energy Efficiency Contractor",
      "Modular Home Installer",
      "Prefab Structure Contractor",
      "Tiny Home Builder",
      "Outdoor Living Specialist",
      "Home Automation Contractor",
    ],
  },
];

export const CONTRACTOR_CATEGORY_OPTIONS = CONTRACTOR_CATEGORY_GROUPS.flatMap(
  (group) => group.options
);
