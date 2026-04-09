"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { useAnalysis } from "@/hooks/use-analysis";
import ScenarioInput from "@/components/sidebar/ScenarioInput";
import AgentPanelGroup from "@/components/sidebar/AgentPanelGroup";
import SynthesisPanel from "@/components/sidebar/SynthesisPanel";
import RegionDetail from "@/components/sidebar/RegionDetail";
import TimeHorizonSelector from "@/components/sidebar/TimeHorizonSelector";
import MapControls from "@/components/map/MapControls";
import MapLegend from "@/components/map/MapLegend";
import type { ViewState, LayerName, LayerToggleState, AgentName, TimeHorizonKey } from "@/lib/types";
import { RISK_SCORE_THRESHOLDS } from "@/components/sidebar/constants";

// ── Dynamic import MapView (no SSR for MapLibre + deck.gl) ──────────

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full spinner" />
        <span className="text-sm text-muted-foreground">Loading map...</span>
      </div>
    </div>
  ),
});

// ── Constants ────────────────────────────────────────────────────────

const INITIAL_VIEW: ViewState = {
  longitude: 30,
  latitude: 20,
  zoom: 2.5,
  pitch: 35,
  bearing: 0,
};

const DEFAULT_LAYER_TOGGLES: LayerToggleState = {
  choropleth: true,
  heatmap: true,
  conflict: false,
  foodDesert: false,
  infrastructure: false,
  tradeArcs: true,
  displacementArcs: false,
};

// ── Sidebar view states ─────────────────────────────────────────────

type SidebarView = "analysis" | "regionDetail";

// ── Country context shape (from /api/country-data) ──────────────────

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

// ── Risk Score Badge ────────────────────────────────────────────────

function RiskScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted border border-border">
        <span className="text-sm text-muted-foreground">Risk Score</span>
        <span className="text-lg font-bold text-muted-foreground">—</span>
      </div>
    );
  }

  const getScoreColor = (s: number) => {
    if (s <= RISK_SCORE_THRESHOLDS.low) return "text-green-500";
    if (s <= RISK_SCORE_THRESHOLDS.medium) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBg = (s: number) => {
    if (s <= RISK_SCORE_THRESHOLDS.low) return "bg-green-500/20 border-green-500/50";
    if (s <= RISK_SCORE_THRESHOLDS.medium) return "bg-yellow-500/20 border-yellow-500/50";
    return "bg-red-500/20 border-red-500/50";
  };

  return (
    <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border ${getScoreBg(score)}`}>
      <span className="text-sm text-muted-foreground">Risk Score</span>
      <span className={`text-lg font-bold ${getScoreColor(score)}`}>{score}</span>
    </div>
  );
}

// ── Time Horizon Badge ──────────────────────────────────────────────

function TimeHorizonBadge({ horizon }: { horizon: string | undefined }) {
  if (!horizon) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border">
        <span className="text-sm text-muted-foreground">Time Horizon</span>
        <span className="text-sm font-medium text-muted-foreground">—</span>
      </div>
    );
  }

  const formatHorizon = (h: string) => h.charAt(0).toUpperCase() + h.slice(1);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/30 border border-accent">
      <span className="text-sm text-muted-foreground">Time Horizon</span>
      <span className="text-sm font-medium text-accent-foreground">{formatHorizon(horizon)}</span>
    </div>
  );
}

// ── Main Page Component ─────────────────────────────────────────────

export default function Home() {
  const analysis = useAnalysis();

  // Map state
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW);
  const [countriesGeoJSON, setCountriesGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);

  // Sidebar state machine
  const [sidebarView, setSidebarView] = useState<SidebarView>("analysis");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countryData, setCountryData] = useState<CountryContext | null>(null);
  const [countryDataLoading, setCountryDataLoading] = useState(false);

  // Agent tabs
  const [activeTab, setActiveTab] = useState<AgentName | "synthesis">("geopolitics");

  // Layer toggles
  const [layerToggles, setLayerToggles] = useState<LayerToggleState>(DEFAULT_LAYER_TOGGLES);

  // Resizable synthesis panel
  const [synthesisPanelHeight, setSynthesisPanelHeight] = useState(240);
  const isDraggingRef = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !sidebarRef.current) return;
      const sidebarRect = sidebarRef.current.getBoundingClientRect();
      const newHeight = sidebarRect.bottom - e.clientY;
      setSynthesisPanelHeight(Math.max(100, Math.min(newHeight, sidebarRect.height - 120)));
    };
    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, []);

  const isAnalyzing = analysis.status === "analyzing";

  // ── Time horizon overrides ─────────────────────────────────────────

  const impactOverrides = useMemo(() => {
    if (!analysis.selectedHorizon || !analysis.timeVariants) return undefined;
    const variant = analysis.timeVariants[analysis.selectedHorizon];
    if (!variant?.country_impacts) return undefined;
    const map = new Map<string, number>();
    for (const [iso3, score] of Object.entries(variant.country_impacts)) {
      map.set(iso3, score as number);
    }
    return map;
  }, [analysis.selectedHorizon, analysis.timeVariants]);

  const effectiveRiskScore = useMemo(() => {
    if (analysis.selectedHorizon && analysis.timeVariants) {
      const variant = analysis.timeVariants[analysis.selectedHorizon];
      if (variant) return variant.compound_risk_score;
    }
    return analysis.compoundRiskScore;
  }, [analysis.selectedHorizon, analysis.timeVariants, analysis.compoundRiskScore]);

  const horizonSummary = useMemo(() => {
    if (!analysis.selectedHorizon || !analysis.timeVariants) return null;
    return analysis.timeVariants[analysis.selectedHorizon]?.summary ?? null;
  }, [analysis.selectedHorizon, analysis.timeVariants]);

  // ── Load GeoJSON on mount ───────────────────────────────────────────

  useEffect(() => {
    fetch("/countries.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load countries GeoJSON");
        return res.json();
      })
      .then((data) => setCountriesGeoJSON(data))
      .catch((err) => console.error("Error loading countries GeoJSON:", err));
  }, []);

  // ── Fly to region when orchestrator completes ───────────────────────

  useEffect(() => {
    if (analysis.orchestratorOutput) {
      const { coordinates, zoom_level } = analysis.orchestratorOutput;
      if (coordinates && zoom_level) {
        setViewState((prev) => ({
          ...prev,
          latitude: coordinates.lat,
          longitude: coordinates.lon,
          zoom: zoom_level,
          transitionDuration: 1500,
        }));
      }
    }
  }, [analysis.orchestratorOutput]);

  // ── Auto-select synthesis tab when synthesis starts ─────────────────

  useEffect(() => {
    if (
      analysis.pipelineStatus === "synthesizing" ||
      (analysis.pipelineStatus === "complete" && analysis.synthesisStatus === "streaming")
    ) {
      setActiveTab("synthesis");
    }
  }, [analysis.pipelineStatus, analysis.synthesisStatus]);

  // ── Auto-enable layers when agents complete ─────────────────────────

  useEffect(() => {
    const results = analysis.agentResults;
    setLayerToggles((prev) => {
      const next = { ...prev };
      if (results.geopolitics && !prev.conflict) next.conflict = true;
      if (results.food_supply && !prev.foodDesert) next.foodDesert = true;
      if (results.infrastructure && !prev.infrastructure) next.infrastructure = true;
      if (results.civilian_impact && !prev.displacementArcs) next.displacementArcs = true;
      // Only update if something changed
      if (
        next.conflict !== prev.conflict ||
        next.foodDesert !== prev.foodDesert ||
        next.infrastructure !== prev.infrastructure ||
        next.displacementArcs !== prev.displacementArcs
      ) {
        return next;
      }
      return prev;
    });
  }, [analysis.agentResults]);

  // ── Reset sidebar view when analysis resets ─────────────────────────

  useEffect(() => {
    if (analysis.status === "idle") {
      setSidebarView("analysis");
      setSelectedCountry(null);
      setCountryData(null);
      setLayerToggles(DEFAULT_LAYER_TOGGLES);
    }
  }, [analysis.status]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleLayerToggle = useCallback((layer: LayerName) => {
    setLayerToggles((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  const handleCountryClick = useCallback(
    async (iso3: string) => {
      // Only switch to region detail if we have analysis data
      if (analysis.status === "idle") return;

      setSelectedCountry(iso3);
      setSidebarView("regionDetail");
      setCountryDataLoading(true);
      setCountryData(null);

      try {
        const res = await fetch(`/api/country-data?iso3=${encodeURIComponent(iso3)}`);
        if (res.ok) {
          const data = await res.json();
          setCountryData(data);
        }
      } catch (err) {
        console.error("Error fetching country data:", err);
        setCountryData(null);
      } finally {
        setCountryDataLoading(false);
      }
    },
    [analysis.status]
  );

  const handleBackToAnalysis = useCallback(() => {
    setSidebarView("analysis");
    setSelectedCountry(null);
    setCountryData(null);
  }, []);

  const handleTabChange = useCallback((tab: AgentName | "synthesis") => {
    setActiveTab(tab);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 flex-shrink-0 flex items-center justify-between px-6 border-b border-border glass-top">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            Vantage
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <RiskScoreBadge score={effectiveRiskScore} />
          {analysis.timeVariants && analysis.status !== "idle" && (
            <TimeHorizonSelector
              selected={analysis.selectedHorizon}
              onChange={analysis.setSelectedHorizon}
              disabled={isAnalyzing}
            />
          )}
          {!analysis.timeVariants && (
            <TimeHorizonBadge horizon={analysis.orchestratorOutput?.time_horizon} />
          )}
        </div>
      </header>

      {/* Main Content - 70/30 Grid */}
      <div className="flex-1 grid grid-cols-[1fr_420px] min-h-0">
        {/* Left: Map (70%) */}
        <div className="relative min-h-0 bg-background map-container">
          <MapView
            viewState={viewState}
            onViewStateChange={setViewState}
            agentResults={analysis.agentResults}
            selectedCountry={selectedCountry}
            onCountryClick={handleCountryClick}
            layerToggles={layerToggles}
            countriesGeoJSON={countriesGeoJSON ?? undefined}
            impactOverrides={impactOverrides}
          />
          <MapControls layerToggles={layerToggles} onToggle={handleLayerToggle} />
          <MapLegend />
        </div>

        {/* Right: Sidebar (30%) */}
        <aside className="border-l border-border flex flex-col min-h-0 glass sidebar-container">
          {/* Scenario Input (always visible) */}
          <div className="flex-shrink-0">
            <ScenarioInput
              onSubmit={analysis.analyzeScenario}
              isAnalyzing={isAnalyzing}
              currentScenario={analysis.scenario}
              onReset={analysis.reset}
            />
          </div>

          {/* Sidebar Content (state machine) */}
          <div ref={sidebarRef} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Region Detail View */}
            {sidebarView === "regionDetail" && selectedCountry && (
              <div className="flex-1 overflow-y-auto p-4 animate-slide-in-right">
                {countryDataLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full spinner" />
                      <span className="text-sm text-muted-foreground">Loading country data...</span>
                    </div>
                  </div>
                ) : (
                  <RegionDetail
                    iso3={selectedCountry}
                    agentResults={analysis.agentResults}
                    countryData={countryData}
                    onBack={handleBackToAnalysis}
                  />
                )}
              </div>
            )}

            {/* Analysis View (agents + synthesis) */}
            {sidebarView === "analysis" && analysis.status !== "idle" && (
              <>
                <div className="flex-1 min-h-0 overflow-hidden animate-fade-in">
                  <AgentPanelGroup
                    agentTexts={analysis.agentTexts}
                    agentStatuses={analysis.agentStatuses}
                    synthesisText={analysis.synthesisText}
                    synthesisStatus={analysis.synthesisStatus}
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                  />
                </div>

                {/* Drag handle */}
                <div
                  onMouseDown={handleResizeStart}
                  className="flex-shrink-0 h-2 cursor-row-resize flex items-center justify-center group hover:bg-accent/30 transition-colors"
                >
                  <div className="w-10 h-0.5 rounded-full bg-border group-hover:bg-muted-foreground transition-colors" />
                </div>

                <div
                  className="flex-shrink-0 overflow-y-auto border-t border-border"
                  style={{ height: synthesisPanelHeight }}
                >
                  <SynthesisPanel
                    synthesisText={horizonSummary ?? analysis.synthesisText}
                    compoundRiskScore={effectiveRiskScore}
                    isComplete={analysis.status === "complete"}
                  />
                </div>
              </>
            )}

            {/* Error State */}
            {analysis.status === "error" && (
              <div className="mx-4 mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 animate-fade-in">
                <div className="flex items-center gap-2 text-red-400 text-xs font-medium mb-1">
                  <span>&#9888;</span> Analysis Error
                </div>
                <p className="text-xs text-red-300/80">
                  {analysis.errors[analysis.errors.length - 1]?.message || "An unexpected error occurred"}
                </p>
              </div>
            )}

            {/* Idle State */}
            {sidebarView === "analysis" && analysis.status === "idle" && (
              <div className="flex-1 flex items-center justify-center p-6">
                <p className="text-sm text-muted-foreground text-center">
                  Enter a scenario above to begin analysis
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
