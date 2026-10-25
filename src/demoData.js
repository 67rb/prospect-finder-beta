export const demoProspects = [
  { id: "demo-maya-patel", name: "Maya Patel", role: "VP of Sales", pastRole: "Regional Sales Manager", company: "Northstar Labs", pastCompany: "Summit CRM", domain: "northstarlabs.example", pastDomain: "summitcrm.example", location: "San Francisco, CA", hqLocation: "San Francisco, CA", coordinates: [37.7749, -122.4194], hqCoordinates: [37.7749, -122.4194], country: "United States", industry: "Information Technology & Services", keywords: "b2b saas sales automation", description: "Sales software for growing teams", employeeCount: 180, revenue: 24000000, technologies: ["salesforce", "hubspot"], activeJobs: 8, openJobTitles: ["Sales Development Representative", "Account Executive"], openJobLocations: ["San Francisco, CA"], lastJobPostedAt: "2025-02-18", status: "Example", email: "maya@northstarlabs.example", createdAt: "2025-01-12", initials: "MP", color: "coral" },
  { id: "demo-jordan-lee", name: "Jordan Lee", role: "Founder & CEO", pastRole: "Product Lead", company: "Brightline", pastCompany: "Northstar Labs", domain: "brightline.example", pastDomain: "northstarlabs.example", location: "New York, NY", hqLocation: "New York, NY", coordinates: [40.7128, -74.006], hqCoordinates: [40.7128, -74.006], country: "United States", industry: "Information Technology & Services", keywords: "cloud software analytics", description: "Cloud analytics for modern companies", employeeCount: 42, revenue: 6000000, technologies: ["google_analytics", "salesforce"], activeJobs: 1, openJobTitles: ["Product Designer"], openJobLocations: ["New York, NY"], lastJobPostedAt: "2025-02-02", status: "Example", email: "jordan@brightline.example", createdAt: "2025-01-13", initials: "JL", color: "blue" },
  { id: "demo-sofia-martinez", name: "Sofia Martinez", role: "Marketing Director", pastRole: "Marketing Manager", company: "Pioneer Cloud", pastCompany: "Brightline", domain: "pioneercloud.example", pastDomain: "brightline.example", location: "Austin, TX", hqLocation: "Austin, TX", coordinates: [30.2672, -97.7431], hqCoordinates: [30.2672, -97.7431], country: "United States", industry: "Marketing & Advertising", keywords: "marketing demand generation", description: "Marketing services and campaign management", employeeCount: 280, revenue: 48000000, technologies: ["hubspot", "marketo"], activeJobs: 14, openJobTitles: ["Marketing Coordinator", "Demand Generation Manager"], openJobLocations: ["Austin, TX", "Remote"], lastJobPostedAt: "2025-02-20", status: "Example", email: "sofia@pioneercloud.example", createdAt: "2025-01-14", initials: "SM", color: "purple" },
  { id: "demo-ethan-chen", name: "Ethan Chen", role: "Head of Growth", pastRole: "Demand Generation Manager", company: "Atlas Systems", pastCompany: "Pioneer Cloud", domain: "", pastDomain: "pioneercloud.example", location: "Seattle, WA", hqLocation: "Portland, OR", coordinates: [47.6062, -122.3321], hqCoordinates: [45.5152, -122.6784], country: "United States", industry: "Information Technology & Services", keywords: "growth technology operations", description: "Business systems and growth technology", employeeCount: 680, revenue: 120000000, technologies: ["salesforce", "workday"], activeJobs: 3, openJobTitles: ["Data Engineer", "Operations Analyst"], openJobLocations: ["Portland, OR"], lastJobPostedAt: "2025-01-28", status: "Example", email: "ethan@atlassystems.example", createdAt: "2025-01-15", initials: "EC", color: "green" },
  { id: "demo-avery-brooks", name: "Avery Brooks", role: "Chief Revenue Officer", pastRole: "VP of Revenue Operations", company: "Northstar Labs", pastCompany: "Summit CRM", domain: "northstarlabs.example", pastDomain: "summitcrm.example", location: "Chicago, IL", hqLocation: "San Francisco, CA", coordinates: [41.8781, -87.6298], hqCoordinates: [37.7749, -122.4194], country: "United States", industry: "Information Technology & Services", keywords: "b2b saas sales automation revenue operations", description: "Sales software for growing teams", employeeCount: 180, revenue: 24000000, technologies: ["salesforce", "hubspot"], activeJobs: 8, openJobTitles: ["Sales Development Representative", "Account Executive"], openJobLocations: ["San Francisco, CA"], lastJobPostedAt: "2025-02-18", status: "Example", email: "avery@northstarlabs.example", createdAt: "2025-02-11", initials: "AB", color: "purple" },

].map(person => ({ ...person, source: "sample" }));

export const demoWorkspacePeople = demoProspects.map(person => ({
  ...person,
  title: person.role,
  owner: "Robert Berry",
}));

export const demoWorkspaceLists = [
  { name: "Q4 SaaS targets", type: "People", count: 2, updated: "Today", description: "Priority software decision makers", members: ["Maya Patel", "Sofia Martinez"], source: "sample" },
  { name: "West Coast sales leaders", type: "People", count: 1, updated: "Yesterday", description: "Sales leaders across the western US", members: ["Maya Patel"], source: "sample" },
  { name: "Northstar account team", type: "People", count: 1, updated: "Oct 18", description: "Buying committee and champions", members: ["Maya Patel"], source: "sample" },
  { name: "Emerging companies", type: "Companies", count: 1, updated: "Oct 16", description: "Fast growing target accounts", members: ["Northstar Labs"], source: "sample" },
];

export function isPlaceholderDomain(value) {
  const domain = String(value || "").trim().toLowerCase().replace(/^www\./, "").split(/[/:?#]/, 1)[0];
  return domain === "example" || domain.endsWith(".example");
}

export function isPlaceholderEmail(value) {
  const match = String(value || "").trim().toLowerCase().match(/^[^\s@]+@([^\s@]+)$/);
  return Boolean(match && isPlaceholderDomain(match[1]));
}
