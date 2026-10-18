"use client";

import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Metrics } from "@/lib/services/metrics";

/**
 * Colours follow the reference data-viz palette. The funnel is ordinal (one blue ramp, no lighter than step 250
 * so the first bar stays visible). Series colours are the first three categorical slots in their fixed order:
 * blue, orange, aqua. Every chart has a legend or direct labels plus a "view as table" alternative.
 */
const SURFACE = "#ffffff";
const GRID = "#e6eae2";
const INK = "#172019";
const MUTED = "#6d796e";
const FUNNEL = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"];
const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const AQUA = "#1baf7a";

const tooltipStyle = { background: SURFACE, border: `1px solid ${GRID}`, borderRadius: 12, fontSize: 12, boxShadow: "0 8px 24px rgba(23,32,25,.08)" };
const axisProps = { stroke: MUTED, fontSize: 12, tickLine: false, axisLine: { stroke: GRID } } as const;

function ChartCard({ title, description, table, children }: { title: string; description: string; table: ReactNode; children: ReactNode }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="text-sm text-muted">{description}</p>
        </div>
        <button type="button" onClick={() => setShowTable((value) => !value)} aria-pressed={showTable} className="btn-ghost px-3 py-1.5 text-xs">
          {showTable ? "View as chart" : "View as table"}
        </button>
      </div>
      {showTable ? <div className="overflow-x-auto">{table}</div> : children}
    </section>
  );
}

const th = "px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted";
const td = "px-3 py-2 text-sm";

export function FunnelChart({ funnel }: { funnel: Metrics["funnel"] }) {
  const data = funnel.map((stage) => ({ ...stage, label: stage.label, tag: `${stage.count}${stage.percentOfAsks === null ? "" : ` · ${stage.percentOfAsks}%`}` }));
  return (
    <ChartCard
      title="From ask to resolved"
      description="How many of the asks posted in this period reached each step."
      table={
        <table className="w-full">
          <thead><tr><th className={th}>Step</th><th className={th}>Asks</th><th className={th}>Share of asks</th></tr></thead>
          <tbody>{funnel.map((stage) => <tr key={stage.key} className="border-t border-line"><td className={td}>{stage.label}</td><td className={td}>{stage.count}</td><td className={td}>{stage.percentOfAsks === null ? "—" : `${stage.percentOfAsks}%`}</td></tr>)}</tbody>
        </table>
      }
    >
      <div className="h-64" role="img" aria-label={`Funnel: ${funnel.map((stage) => `${stage.label} ${stage.count}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 90, top: 4, bottom: 4 }} barCategoryGap={8}>
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" allowDecimals={false} {...axisProps} />
            <YAxis type="category" dataKey="label" width={120} {...axisProps} />
            <Tooltip cursor={{ fill: "rgba(23,32,25,.04)" }} contentStyle={tooltipStyle} formatter={(value: number) => [value, "Asks"]} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} stroke={SURFACE} strokeWidth={2}>
              {data.map((stage, index) => <Cell key={stage.key} fill={FUNNEL[index] ?? FUNNEL[FUNNEL.length - 1]} />)}
              <LabelList dataKey="tag" position="right" fill={INK} fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function TrendChart({ trend }: { trend: Metrics["trend"] }) {
  const data = trend.map((row) => ({ ...row, label: new Date(`${row.week}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) }));
  return (
    <ChartCard
      title="Week by week"
      description="Asks posted, requests accepted and asks resolved in each week (weeks start on Monday)."
      table={
        <table className="w-full">
          <thead><tr><th className={th}>Week of</th><th className={th}>Asks posted</th><th className={th}>Accepted</th><th className={th}>Resolved</th></tr></thead>
          <tbody>{data.map((row) => <tr key={row.week} className="border-t border-line"><td className={td}>{row.label}</td><td className={td}>{row.asks}</td><td className={td}>{row.accepted}</td><td className={td}>{row.resolved}</td></tr>)}</tbody>
        </table>
      }
    >
      <div className="h-64" role="img" aria-label="Weekly asks, accepted requests and resolved asks">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: -8, right: 16, top: 8, bottom: 4 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: MUTED, strokeDasharray: "3 3" }} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: INK }} />
            <Line type="linear" dataKey="asks" name="Asks posted" stroke={BLUE} strokeWidth={2} dot={{ r: 4, stroke: SURFACE, strokeWidth: 2, fill: BLUE }} activeDot={{ r: 6 }} />
            <Line type="linear" dataKey="accepted" name="Accepted" stroke={ORANGE} strokeWidth={2} dot={{ r: 4, stroke: SURFACE, strokeWidth: 2, fill: ORANGE }} activeDot={{ r: 6 }} />
            <Line type="linear" dataKey="resolved" name="Resolved" stroke={AQUA} strokeWidth={2} dot={{ r: 4, stroke: SURFACE, strokeWidth: 2, fill: AQUA }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function DemandSupplyChart({ rows }: { rows: Metrics["demandSupply"] }) {
  return (
    <ChartCard
      title="Skills students need vs alumni who have them"
      description="The ten most requested skills. A gap means far fewer alumni than asks."
      table={
        <table className="w-full">
          <thead><tr><th className={th}>Skill</th><th className={th}>Asks</th><th className={th}>Alumni</th><th className={th}>Gap</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.skill} className="border-t border-line"><td className={td}>{row.skill}</td><td className={td}>{row.demand}</td><td className={td}>{row.supply}</td><td className={td}>{row.gap ? "⚠ Gap" : "—"}</td></tr>)}</tbody>
        </table>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No asks in this period yet.</p>
      ) : (
        <>
          <div style={{ height: Math.max(220, rows.length * 44) }} role="img" aria-label="Asks and alumni per skill">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }} barCategoryGap={10} barGap={2}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" allowDecimals={false} {...axisProps} />
                <YAxis type="category" dataKey="skill" width={120} {...axisProps} />
                <Tooltip cursor={{ fill: "rgba(23,32,25,.04)" }} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: INK }} />
                <Bar dataKey="demand" name="Asks" fill={BLUE} radius={[0, 4, 4, 0]} stroke={SURFACE} strokeWidth={2} />
                <Bar dataKey="supply" name="Alumni with the skill" fill={ORANGE} radius={[0, 4, 4, 0]} stroke={SURFACE} strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {rows.some((row) => row.gap) && (
            <p className="text-sm"><span aria-hidden>⚠</span> <strong>Gaps:</strong> {rows.filter((row) => row.gap).map((row) => row.skill).join(", ")}</p>
          )}
        </>
      )}
    </ChartCard>
  );
}
