export const FILTERS = [
  { key: "fortiguard", label: "FortiGuard" },
  { key: "lightspeed", label: "Lightspeed" },
  { key: "paloalto", label: "Palo Alto" },
  { key: "blocksiweb", label: "Blocksi Web" },
  { key: "blocksiai", label: "Blocksi AI" },
  { key: "linewize", label: "Linewize" },
  { key: "ciscoumbrella", label: "Cisco Umbrella" },
  { key: "securly", label: "Securly" },
  { key: "goguardian", label: "GoGuardian" },
  { key: "lanschool", label: "LanSchool" },
  { key: "contentkeeper", label: "ContentKeeper" },
  { key: "aristotlek12", label: "AristotleK12" },
  { key: "sensocloud", label: "Senso Cloud" },
  { key: "deledao", label: "Deledao" },
  { key: "iboss", label: "iBoss" },
  { key: "sophos", label: "Sophos" },
  { key: "barracuda", label: "Barracuda" },
  { key: "qustodio", label: "Qustodio" },
  { key: "dnsfilter", label: "DNSFilter" },
] as const;

export type FilterKey = (typeof FILTERS)[number]["key"];

export function getFilterLabel(key: string): string {
  const filter = FILTERS.find((f) => f.key === key);
  return filter ? filter.label : key;
}
