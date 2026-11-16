import type { MapLocation, MapVenue } from "./map";
import { isPlaceholderLocation } from "./location";

// Building-level points from UW’s official campus map (verified 2026-11-14).
// Source: https://uwaterloo.ca/map/ — University of Waterloo.
const source = "https://services5.arcgis.com/z87D0RdgTttiUQbV/arcgis/rest/services/BuildingsView/FeatureServer/0";

export const mapVenues: readonly MapVenue[] = [
  { id: "wlu-peters", name: "Frank C. Peters Building", buildingCodes: [], aliases: ["Peters Building"], coordinates: [-80.5306748, 43.4736587], city: "Waterloo", verifiedFrom: "https://students.wlu.ca/campus-services/classrooms-and-spaces/study-spaces/waterloo.html" },
  { id: "waterloo-wonders", name: "Wonders of Winter, Waterloo Park", buildingCodes: [], aliases: ["Wonders of Winter"], coordinates: [-80.5334849, 43.4687026], city: "Waterloo", verifiedFrom: "https://www.wondersofwinter.ca/directions-parking/" },
  { id: "uw-opt", name: "Optometry", buildingCodes: ["OPT", "OPTOM"], aliases: ["Optometry"], coordinates: [-80.5455298996192, 43.4759251698687], city: "Waterloo", verifiedFrom: source },
  { id: "waterloo-splitsville", name: "Splitsville Waterloo", buildingCodes: [], aliases: ["Splitsville Waterloo", "341 Marsland Drive"], coordinates: [-80.519316718, 43.483088548], city: "Waterloo", verifiedFrom: "https://www.splitsvillebowl.ca/waterloo" },
  { id: "uw-lib", name: "Dana Porter Arts Library", buildingCodes: ["LIB"], aliases: ["Dana Porter Arts Library", "Dana Porter Library"], coordinates: [-80.5424293, 43.4698444], city: "Waterloo", verifiedFrom: source + "/8" },
  { id: "uw-al", name: "Arts Lecture Hall", buildingCodes: ["AL"], aliases: ["Arts Lecture Hall"], coordinates: [-80.5418714, 43.4689411], city: "Waterloo", verifiedFrom: source + "/9" },
  { id: "uw-rch", name: "J.R. Coutts Engineering Lecture Hall", buildingCodes: ["RCH"], aliases: ["J.R. Coutts Engineering Lecture Hall"], coordinates: [-80.5408414, 43.4703116], city: "Waterloo", verifiedFrom: source + "/11" },
  { id: "uw-sch", name: "South Campus Hall", buildingCodes: ["SCH"], aliases: ["South Campus Hall"], coordinates: [-80.5402134, 43.4692188], city: "Waterloo", verifiedFrom: source + "/16" },
  { id: "uw-mc", name: "Mathematics & Computer Building", buildingCodes: ["MC"], aliases: ["Mathematics & Computer Building", "Mathematics and Computer Building", "Math and Computer"], coordinates: [-80.5439474, 43.4720751], city: "Waterloo", verifiedFrom: source + "/17" },
  { id: "uw-pac", name: "Physical Activities Complex", buildingCodes: ["PAC"], aliases: ["Physical Activities Complex"], coordinates: [-80.5461334, 43.4724235], city: "Waterloo", verifiedFrom: source + "/18" },
  { id: "uw-slc", name: "Student Life Centre", buildingCodes: ["SLC"], aliases: ["Student Life Centre"], coordinates: [-80.545455, 43.471601], city: "Waterloo", verifiedFrom: source + "/19" },
  { id: "uw-hh", name: "J.G. Hagey Hall of the Humanities", buildingCodes: ["HH"], aliases: ["J.G. Hagey Hall of the Humanities", "Hagey Hall"], coordinates: [-80.5416568, 43.4679289], city: "Waterloo", verifiedFrom: source + "/51" },
  { id: "uw-fed", name: "Federation Hall", buildingCodes: ["FED"], aliases: ["Federation Hall"], coordinates: [-80.5486413, 43.4732469], city: "Waterloo", verifiedFrom: source + "/98" },
  { id: "uw-dc", name: "William G. Davis Computer Research Centre", buildingCodes: ["DC"], aliases: ["William G. Davis Computer Research Centre", "Davis Centre", "Davis Center"], coordinates: [-80.542164, 43.472761], city: "Waterloo", verifiedFrom: source + "/100" },
  { id: "uw-eit", name: "Centre for Environmental and Information Technology", buildingCodes: ["EIT"], aliases: ["Centre for Environmental and Information Technology"], coordinates: [-80.5420645, 43.471495], city: "Waterloo", verifiedFrom: source + "/101" },
  { id: "uw-cif", name: "Columbia Icefield", buildingCodes: ["CIF"], aliases: ["Columbia Icefield"], coordinates: [-80.5485232, 43.4753568], city: "Waterloo", verifiedFrom: source + "/104" },
  { id: "uw-tc", name: "William M. Tatham Centre for Co-operative and Experiential Education", buildingCodes: ["TC"], aliases: ["William M. Tatham Centre for Co-operative and Experiential Education", "Tatham Centre"], coordinates: [-80.5412835, 43.4690473], city: "Waterloo", verifiedFrom: source + "/125" },
  { id: "uw-arc", name: "School of Architecture", buildingCodes: ["ARC"], aliases: ["School of Architecture"], coordinates: [-80.31692, 43.358572], city: "outside", verifiedFrom: source + "/126" },
  { id: "uw-phr", name: "Pharmacy", buildingCodes: ["PHR"], aliases: ["Pharmacy"], coordinates: [-80.49902, 43.452847], city: "outside", verifiedFrom: source + "/128" },
  { id: "uw-qnc", name: "Mike & Ophelia Lazaridis Quantum-Nano Centre", buildingCodes: ["QNC"], aliases: ["Mike & Ophelia Lazaridis Quantum-Nano Centre", "Quantum Nano Centre", "Quantum-Nano Centre"], coordinates: [-80.5441925, 43.4712484], city: "Waterloo", verifiedFrom: source + "/129" },
  { id: "uw-e5", name: "Engineering 5", buildingCodes: ["E5"], aliases: ["Engineering 5"], coordinates: [-80.5402467, 43.4731242], city: "Waterloo", verifiedFrom: source + "/132" },
  { id: "uw-stc", name: "Science Teaching Complex", buildingCodes: ["STC"], aliases: ["Science Teaching Complex"], coordinates: [-80.54338, 43.47064], city: "Waterloo", verifiedFrom: source + "/133" },
  { id: "uw-dms", name: "Digital Media Stratford", buildingCodes: ["DMS"], aliases: ["Digital Media Stratford"], coordinates: [-80.9821, 43.36783], city: "outside", verifiedFrom: source + "/134" },
  { id: "uw-m3", name: "Mathematics 3", buildingCodes: ["M3"], aliases: ["Mathematics 3"], coordinates: [-80.5440498, 43.4732043], city: "Waterloo", verifiedFrom: source + "/135" },
  { id: "uw-ev3", name: "Environment 3", buildingCodes: ["EV3"], aliases: ["Environment 3"], coordinates: [-80.543376, 43.468159], city: "Waterloo", verifiedFrom: source + "/136" },
  { id: "uw-ec5", name: "East Campus 5", buildingCodes: ["EC5"], aliases: ["East Campus 5"], coordinates: [-80.540612, 43.4754353], city: "Waterloo", verifiedFrom: source + "/145" },
  { id: "uw-gh", name: "Graduate House", buildingCodes: ["GH"], aliases: ["Graduate House"], coordinates: [-80.5409181, 43.469733], city: "Waterloo", verifiedFrom: source + "/158" },
  { id: "uw-cigi", name: "Centre for International Governance Innovation (BSIA)", buildingCodes: ["CIGI"], aliases: ["Centre for International Governance Innovation (BSIA)", "Balsillie School of International Affairs", "BSIA"], coordinates: [-80.5257915, 43.4638362], city: "Waterloo", verifiedFrom: source + "/300" },
  { id: "uw-e7", name: "Pearl Sullivan Engineering Building", buildingCodes: ["PSE", "E7"], aliases: ["Pearl Sullivan Engineering Building", "Engineering 7"], coordinates: [-80.5393334, 43.4726751], city: "Waterloo", verifiedFrom: source + "/317" },
  // Coordinates from the venue/city's own linked maps, verified 2026-11-14.
  { id: "waterloo-culinary-studio", name: "The Culinary Studio", buildingCodes: [], aliases: ["The Culinary Studio", "Culinary Studio", "105 Lexington Rd", "105 Lexington Road"], coordinates: [-80.51796, 43.486317], city: "Waterloo", verifiedFrom: "https://www.theculinarystudio.ca/pages/contact-us" },
  { id: "waterloo-rim-park", name: "RIM Park", buildingCodes: [], aliases: ["RIM Park", "Manulife Sportsplex", "2001 University Avenue East", "2001 University Ave E"], coordinates: [-80.5023128, 43.5187842], city: "Waterloo", verifiedFrom: "https://www.waterloo.ca/recreation-and-sports/find-a-community-or-rec-centre/rim-park/" },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

export function resolveMapLocation(input: { locationName: string; buildingCode?: string; description?: string; clubName?: string }): MapLocation {
  let structured = normalize(input.locationName);
  // Laurier's published room guide identifies MAC-121 in Milton, the Level
  // One Lounge in Brantford, and P111 in Peters Building in Waterloo.
  // Room-only labels remain ambiguous without the institution's context.
  if (/\blaurier\b/i.test(input.clubName ?? "")) {
    if (/^(mac 121|level 1 lounge)$/.test(structured)) return { venue: null, locationStatus: "outside" };
    if (structured === "p111") structured = "peters building";
  }
  if (/\b(online|virtual|zoom|teams meeting)\b/.test(structured)) return { venue: null, locationStatus: "online" };
  if (/\b(kitchener|cambridge|toronto|stratford|guelph|elora|st marys|milton|brantford|edmonton|university of alberta|one market)\b/.test(structured)) return { venue: null, locationStatus: "outside" };
  const generic = isPlaceholderLocation(input.locationName) || /^(waterloo|university of waterloo(?: campus)?|uwaterloo campus|uw campus|on campus|campus)$/.test(structured);
  const name = generic ? normalize(input.description ?? input.locationName) : structured;
  // These venues are in Kitchener even when an imported city field says Waterloo.
  // https://www.kitchener.ca/news/posts/community-excitement-inspires-week-long-grand-opening-celebration-to-mark-the-opening-of-cowan-recreation-centre-at-rbj-schlegel-park-november-14-to-22/
  // https://buildersclub.space/
  if (/\b(cowan recreation centre|rbj schlegel park|builders club|builder s club)\b/.test(name)) {
    return { venue: null, locationStatus: "outside" };
  }
  const matches = mapVenues.filter(venue =>
    [...venue.aliases, ...venue.buildingCodes].some(alias => {
      const key = normalize(alias);
      return (` ${name} `).includes(` ${key} `);
    }),
  );
  const fallback = mapVenues.find(venue => venue.buildingCodes.includes(input.buildingCode ?? ""));
  // Ambiguous names and conflicting structured codes must not invent a pin.
  if (matches.length > 1 || (matches.length === 1 && fallback && matches[0].id !== fallback.id)) {
    return { venue: null, locationStatus: "unlocated" };
  }
  const venue = matches[0] ?? fallback ?? null;
  if (!venue && generic && /\b(?:virtual|online workshop|online event|held on zoom|via zoom)\b/.test(name)) return { venue: null, locationStatus: "online" };
  return { venue, locationStatus: venue ? venue.city === "outside" ? "outside" : "located" : "unlocated" };
}
