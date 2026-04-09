"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentResults, AgentName, SpecialistAgentName } from "@/lib/types";
import { AGENT_COLORS } from "./constants";

interface CountryContext {
  name: string;
  iso3: string;
  economics: {
    gdp: number;
    population: number;
    poverty_rate: number;
    arable_land_pct: number;
    energy_use_per_capita: number;
    trade_pct_gdp: number;
  };
  risk: {
    risk_score: number;
    hazard_exposure: number;
    vulnerability: number;
    lack_of_coping_capacity: number;
  };
  displacement: {
    refugees: number;
    asylum_seekers: number;
    idps: number;
    stateless: number;
  };
}

interface RegionDetailProps {
  iso3: string;
  agentResults: AgentResults;
  countryData: CountryContext | null;
  onBack: () => void;
}

interface DomainData {
  agent: SpecialistAgentName;
  score: number;
  label: string;
  color: string;
  summary: string;
  details: Record<string, string | string[] | number | boolean | null>;
}

const AGENT_KEYS: SpecialistAgentName[] = [
  "geopolitics",
  "economy",
  "food_supply",
  "infrastructure",
  "civilian_impact",
];

const ISO3_TO_ISO2: Record<string, string> = {
  USA: "US", EGY: "EG", IND: "IN", CHN: "CN", RUS: "RU", BRA: "BR",
  GBR: "GB", DEU: "DE", FRA: "FR", JPN: "JP", AUS: "AU", CAN: "CA",
  MEX: "MX", SAU: "SA", ARE: "AE", TUR: "TR", ITA: "IT", ESP: "ES",
  KOR: "KR", IDN: "ID", PAK: "PK", BGD: "BD", NGA: "NG", ETH: "ET",
  ZAF: "ZA", DNK: "DK", NOR: "NO", SWE: "SE", FIN: "FI", GRL: "GL",
  NLD: "NL", BEL: "BE", CHE: "CH", AUT: "AT", POL: "PL", UKR: "UA",
  GRC: "GR", PRT: "PT", IRN: "IR", IRQ: "IQ", ISR: "IL", LBN: "LB",
  SYR: "SY", YEM: "YE", THA: "TH", VNM: "VN", MYS: "MY", SGP: "SG",
  PHL: "PH", NZL: "NZ", ARG: "AR", CHL: "CL", COL: "CO", PER: "PE",
  VEN: "VE", SDN: "SD",
};

function getFlagEmoji(iso3: string): string {
  const iso2 = ISO3_TO_ISO2[iso3];
  if (!iso2) return "";
  const codePoints = iso2
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function formatNumber(num: number | undefined | null, type: "number" | "currency" | "percent"): string {
  if (num === undefined || num === null || isNaN(num)) return "N/A";
  switch (type) {
    case "currency":
      if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
      if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
      if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
      return `$${num.toLocaleString()}`;
    case "percent":
      return `${num.toFixed(1)}%`;
    case "number":
    default:
      if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
      if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
      return num.toLocaleString();
  }
}

function severityColor(score: number): string {
  if (score <= 3) return "text-green-400";
  if (score <= 5) return "text-yellow-400";
  if (score <= 7) return "text-orange-400";
  return "text-red-400";
}

function severityBg(score: number): string {
  if (score <= 3) return "bg-green-500/10 border-green-500/20";
  if (score <= 5) return "bg-yellow-500/10 border-yellow-500/20";
  if (score <= 7) return "bg-orange-500/10 border-orange-500/20";
  return "bg-red-500/10 border-red-500/20";
}

function getDomainData(agentResults: AgentResults, iso3: string): DomainData[] {
  const domainMap: Record<SpecialistAgentName, string> = {
    geopolitics: "impact_score",
    economy: "trade_disruption",
    food_supply: "food_security_impact",
    infrastructure: "infrastructure_risk",
    civilian_impact: "humanitarian_score",
  };

  const labelMap: Record<SpecialistAgentName, string> = {
    geopolitics: "Geopolitics",
    economy: "Economy",
    food_supply: "Food Supply",
    infrastructure: "Infrastructure",
    civilian_impact: "Civilian Impact",
  };

  return AGENT_KEYS.map((agent) => {
    const result = agentResults[agent];
    let score = 0;
    let summary = "No data available";
    let details: Record<string, any> = {};

    if (result && typeof result === "object" && "affected_countries" in result) {
      const affected = (result as any).affected_countries;
      const cd = affected?.find((c: any) => c.iso3 === iso3);

      if (cd) {
        const key = domainMap[agent];
        score = cd[key] ?? 0;

        switch (agent) {
          case "geopolitics":
            summary = `Stance: ${cd.stance}`;
            details = {
              Stance: cd.stance,
              "Key Concerns": cd.key_concerns || [],
              "Alliance Impacts": cd.alliance_impacts || [],
            };
            break;
          case "economy":
            summary = `GDP Impact: ${cd.gdp_impact_pct > 0 ? "+" : ""}${cd.gdp_impact_pct?.toFixed(1)}%`;
            details = {
              "GDP Impact": `${cd.gdp_impact_pct > 0 ? "+" : ""}${cd.gdp_impact_pct?.toFixed(1)}%`,
              "Trade Disruption": `${cd.trade_disruption}/10`,
              "Key Sectors": cd.key_sectors || [],
              "Unemployment Risk": cd.unemployment_risk,
            };
            break;
          case "food_supply":
            summary = cd.is_food_desert ? "Food desert declared" : `Pop at risk: ${formatNumber(cd.population_at_risk, "number")}`;
            details = {
              "Food Desert": cd.is_food_desert ? "Yes" : "No",
              "Population at Risk": formatNumber(cd.population_at_risk, "number"),
              "Primary Threats": cd.primary_threats || [],
            };
            break;
          case "infrastructure":
            summary = `Systems: ${cd.systems_at_risk?.join(", ")}`;
            details = {
              "Systems at Risk": cd.systems_at_risk || [],
              "Cascade Risk": `${cd.cascade_risk}/10`,
            };
            break;
          case "civilian_impact":
            summary = `Displaced: ${formatNumber(cd.displaced_estimate, "number")}`;
            details = {
              "Displaced Estimate": formatNumber(cd.displaced_estimate, "number"),
              "Health Risk": `${cd.health_risk}/10`,
              "Vulnerable Groups": cd.vulnerable_groups || [],
            };
            break;
        }
      }
    }

    return { agent, score, label: labelMap[agent], color: AGENT_COLORS[agent], summary, details };
  });
}

function DomainCard({ domain }: { domain: DomainData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-lg border transition-colors ${severityBg(domain.score)}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-white/5 transition-colors rounded-lg"
      >
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: domain.color }} />
        <span className="font-medium text-sm flex-1">{domain.label}</span>
        <span className={`text-sm font-bold tabular-nums ${severityColor(domain.score)}`}>
          {domain.score}/10
        </span>
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        }
      </button>

      {!expanded && (
        <div className="px-3 pb-2 -mt-1">
          <p className="text-xs text-muted-foreground pl-[18px]">{domain.summary}</p>
        </div>
      )}

      {expanded && (
        <div className="px-3 pb-3 space-y-2 animate-fade-in">
          {Object.entries(domain.details).map(([key, value]) => (
            <div key={key} className="pl-[18px]">
              <div className="text-xs text-muted-foreground font-medium">{key}</div>
              {Array.isArray(value) ? (
                <ul className="mt-0.5 space-y-0.5">
                  {value.map((item, i) => (
                    <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                      <span className="text-muted-foreground mt-1 flex-shrink-0">-</span>
                      <span>{String(item)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-foreground/90 font-medium mt-0.5">{String(value)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({ title, defaultOpen = true, children }: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border pt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left mb-2 hover:text-foreground transition-colors"
      >
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        }
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      </button>
      {open && <div className="animate-fade-in">{children}</div>}
    </div>
  );
}

function FlagEmoji({ iso3 }: { iso3: string }) {
  const flag = getFlagEmoji(iso3);
  if (!flag) return null;
  return <span className="text-2xl ml-2">{flag}</span>;
}

export default function RegionDetail({
  iso3,
  agentResults,
  countryData,
  onBack,
}: RegionDetailProps) {
  const domainData = useMemo(() => getDomainData(agentResults, iso3), [agentResults, iso3]);

  const chartData = domainData.map((d) => ({
    name: d.label.charAt(0),
    fullName: d.label,
    score: d.score,
    fill: d.color,
  }));

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="flex items-center gap-1 hover:bg-accent"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {/* Country Name */}
        <div className="flex items-center">
          <h2 className="text-xl font-semibold">
            {countryData?.name || iso3}
          </h2>
          <FlagEmoji iso3={iso3} />
        </div>

        {/* Bar Chart - collapsible */}
        <CollapsibleSection title="Impact Overview" defaultOpen={true}>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 10]}
                  tick={{ fill: "#888", fontSize: 12 }}
                  axisLine={{ stroke: "#444" }}
                  tickLine={{ stroke: "#444" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#888", fontSize: 14, fontWeight: 600 }}
                  axisLine={{ stroke: "#444" }}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e1e1e",
                    border: "1px solid #333",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  formatter={(value: number, _name: string, props: any) => [
                    `${value}/10 - ${props.payload.fullName}`,
                    "Score",
                  ]}
                />
                <Bar dataKey="score" radius={[0, 4, 4, 0]} animationDuration={500}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CollapsibleSection>

        {/* Domain Analysis - expandable cards */}
        <CollapsibleSection title="Domain Analysis" defaultOpen={true}>
          <div className="space-y-2">
            {domainData.map((domain) => (
              <DomainCard key={domain.agent} domain={domain} />
            ))}
          </div>
        </CollapsibleSection>

        {/* Key Statistics - collapsible */}
        {countryData && (
          <CollapsibleSection title="Key Statistics" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 rounded bg-card/30">
                <div className="text-xs text-muted-foreground">Population</div>
                <div className="font-medium">{formatNumber(countryData.economics.population, "number")}</div>
              </div>
              <div className="p-2 rounded bg-card/30">
                <div className="text-xs text-muted-foreground">GDP</div>
                <div className="font-medium">{formatNumber(countryData.economics.gdp, "currency")}</div>
              </div>
              <div className="p-2 rounded bg-card/30">
                <div className="text-xs text-muted-foreground">Displacement</div>
                <div className="font-medium">
                  {formatNumber(
                    (countryData.displacement.refugees || 0) + (countryData.displacement.idps || 0),
                    "number"
                  )}
                </div>
              </div>
              <div className="p-2 rounded bg-card/30">
                <div className="text-xs text-muted-foreground">Risk Index</div>
                <div className="font-medium">{countryData.risk.risk_score?.toFixed(1) || "N/A"}</div>
              </div>
              <div className="p-2 rounded bg-card/30">
                <div className="text-xs text-muted-foreground">Poverty Rate</div>
                <div className="font-medium">{formatNumber(countryData.economics.poverty_rate, "percent")}</div>
              </div>
              <div className="p-2 rounded bg-card/30">
                <div className="text-xs text-muted-foreground">Trade % GDP</div>
                <div className="font-medium">{formatNumber(countryData.economics.trade_pct_gdp, "percent")}</div>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Risk Breakdown - collapsible */}
        {countryData && (
          <CollapsibleSection title="Risk Breakdown" defaultOpen={false}>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-center justify-between p-2 rounded bg-card/30">
                <span className="text-xs text-muted-foreground">Hazard Exposure</span>
                <span className={`font-medium ${severityColor(countryData.risk.hazard_exposure)}`}>
                  {countryData.risk.hazard_exposure?.toFixed(1) || "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-card/30">
                <span className="text-xs text-muted-foreground">Vulnerability</span>
                <span className={`font-medium ${severityColor(countryData.risk.vulnerability)}`}>
                  {countryData.risk.vulnerability?.toFixed(1) || "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-card/30">
                <span className="text-xs text-muted-foreground">Lack of Coping Capacity</span>
                <span className={`font-medium ${severityColor(countryData.risk.lack_of_coping_capacity)}`}>
                  {countryData.risk.lack_of_coping_capacity?.toFixed(1) || "N/A"}
                </span>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Displacement Breakdown - collapsible */}
        {countryData && (countryData.displacement.refugees > 0 || countryData.displacement.idps > 0) && (
          <CollapsibleSection title="Displacement Breakdown" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 rounded bg-card/30">
                <div className="text-xs text-muted-foreground">Refugees</div>
                <div className="font-medium">{formatNumber(countryData.displacement.refugees, "number")}</div>
              </div>
              <div className="p-2 rounded bg-card/30">
                <div className="text-xs text-muted-foreground">Asylum Seekers</div>
                <div className="font-medium">{formatNumber(countryData.displacement.asylum_seekers, "number")}</div>
              </div>
              <div className="p-2 rounded bg-card/30">
                <div className="text-xs text-muted-foreground">IDPs</div>
                <div className="font-medium">{formatNumber(countryData.displacement.idps, "number")}</div>
              </div>
              <div className="p-2 rounded bg-card/30">
                <div className="text-xs text-muted-foreground">Stateless</div>
                <div className="font-medium">{formatNumber(countryData.displacement.stateless, "number")}</div>
              </div>
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}
