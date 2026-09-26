import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import api from "../api";
import {
  calculateFramingEstimate,
  createDefaultFramingInputs,
  createFloorSection,
  createOpening,
  createRoofSection,
  createStructuralMember,
  createWallSection,
  normalizeFramingInputsForEditor,
} from "../estimators/framing";
import { Button, Container, Input, SymbolIcon, Textarea } from "../ui";


const PENDING_KEY = "flatorigin:pending-framing-estimate";

function localDateString(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function dateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function createDraft() {
  return { status: "draft", project_name: "Framing estimate", issue_date: localDateString(), valid_until: dateAfter(30), inputs: createDefaultFramingInputs() };
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(Number(value || 0));
}

function FieldLabel({ children }) {
  return <div className="mb-1.5 text-sm font-medium text-slate-700">{children}</div>;
}

function Select({ className = "", ...props }) {
  return <select {...props} className={`h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`} />;
}

function MoneyInput({ value, onChange, allowNegative = false }) {
  return <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span><Input type="number" min={allowNegative ? undefined : "0"} step="0.01" value={value} onChange={onChange} className="pl-7" /></div>;
}

function CardHeading({ title, description, open, onToggle, onRemove }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-start gap-2 text-left">
        <SymbolIcon name={open ? "expand_less" : "expand_more"} className="mt-0.5 text-[22px] text-slate-500" />
        <span className="min-w-0"><span className="block truncate text-base font-bold text-slate-950 sm:text-lg">{title}</span>{description ? <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span> : null}</span>
      </button>
      {onRemove ? <button type="button" onClick={onRemove} title="Remove" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"><SymbolIcon name="delete" className="text-[19px]" /></button> : null}
    </div>
  );
}

function Toggle({ checked, onChange, children }) {
  return <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-slate-950" /><span className="text-sm font-medium text-slate-800">{children}</span></label>;
}

function OpeningEditor({ opening, onChange, onRemove }) {
  const update = (field, value) => onChange({ ...opening, [field]: value });
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3"><div className="text-sm font-bold text-slate-900">{opening.name || "Opening"}</div><button type="button" onClick={onRemove} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-100 hover:text-red-700"><SymbolIcon name="close" className="text-[18px]" /></button></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label><FieldLabel>Name</FieldLabel><Input value={opening.name} onChange={(event) => update("name", event.target.value)} /></label>
        <label><FieldLabel>Type</FieldLabel><Select value={opening.type} onChange={(event) => update("type", event.target.value)}><option value="window">Window</option><option value="door">Door</option></Select></label>
        <label><FieldLabel>Position from wall start (ft)</FieldLabel><Input type="number" min="0" step="0.1" value={opening.position_ft} onChange={(event) => update("position_ft", event.target.value)} /></label>
        <label><FieldLabel>Width (ft)</FieldLabel><Input type="number" min="0.1" step="0.1" value={opening.width_ft} onChange={(event) => update("width_ft", event.target.value)} /></label>
        <label><FieldLabel>Height (ft)</FieldLabel><Input type="number" min="0.1" step="0.1" value={opening.height_ft} onChange={(event) => update("height_ft", event.target.value)} /></label>
        <label><FieldLabel>Sill height (ft)</FieldLabel><Input type="number" min="0" step="0.1" value={opening.sill_height_ft} onChange={(event) => update("sill_height_ft", event.target.value)} /></label>
        <label><FieldLabel>King studs / side</FieldLabel><Input type="number" min="0" step="1" value={opening.king_studs_per_side} onChange={(event) => update("king_studs_per_side", event.target.value)} /></label>
        <label><FieldLabel>Jack studs / side</FieldLabel><Input type="number" min="0" step="1" value={opening.jack_studs_per_side} onChange={(event) => update("jack_studs_per_side", event.target.value)} /></label>
        <label><FieldLabel>Header plies</FieldLabel><Input type="number" min="1" step="1" value={opening.header_ply_count} onChange={(event) => update("header_ply_count", event.target.value)} /></label>
        <label className="sm:col-span-2"><FieldLabel>Header specification</FieldLabel><Input value={opening.header_description} onChange={(event) => update("header_description", event.target.value)} placeholder="Use engineer-specified member" /></label>
        <label><FieldLabel>Header material / linear ft</FieldLabel><MoneyInput value={opening.header_unit_price_per_lf} onChange={(event) => update("header_unit_price_per_lf", event.target.value)} /></label>
      </div>
    </div>
  );
}

function WallEditor({ wall, calculation, open, onToggle, onChange, onRemove }) {
  const update = (field, value) => onChange({ ...wall, [field]: value });
  const updateOpening = (index, value) => update("openings", wall.openings.map((item, itemIndex) => itemIndex === index ? value : item));
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <CardHeading title={wall.name || "Wall assembly"} description={`${wall.length_ft || 0} ft / ${wall.stud_size} @ ${wall.stud_spacing_in} in / ${money(calculation?.subtotal)}`} open={open} onToggle={onToggle} onRemove={onRemove} />
      {open ? <div className="mt-5 space-y-6 border-t border-slate-100 pt-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label><FieldLabel>Assembly name</FieldLabel><Input value={wall.name} onChange={(event) => update("name", event.target.value)} /></label>
          <label><FieldLabel>Level</FieldLabel><Input value={wall.level} onChange={(event) => update("level", event.target.value)} /></label>
          <label><FieldLabel>Wall type</FieldLabel><Select value={wall.wall_type} onChange={(event) => update("wall_type", event.target.value)}><option value="interior">Interior</option><option value="exterior">Exterior</option></Select></label>
          <label><FieldLabel>Length (ft)</FieldLabel><Input type="number" min="0.1" step="0.1" value={wall.length_ft} onChange={(event) => update("length_ft", event.target.value)} /></label>
          <label><FieldLabel>Height (ft)</FieldLabel><Input type="number" min="1" step="0.1" value={wall.height_ft} onChange={(event) => update("height_ft", event.target.value)} /></label>
          <label><FieldLabel>Bearing condition</FieldLabel><Select value={wall.bearing} onChange={(event) => update("bearing", event.target.value)}><option value="non_bearing">Non-bearing</option><option value="load_bearing">Load-bearing</option></Select></label>
          <label><FieldLabel>Stud size</FieldLabel><Input value={wall.stud_size} onChange={(event) => update("stud_size", event.target.value)} /></label>
          <label><FieldLabel>Stud spacing (in)</FieldLabel><Input type="number" min="1" step="1" value={wall.stud_spacing_in} onChange={(event) => update("stud_spacing_in", event.target.value)} /></label>
          <label><FieldLabel>Blocking rows</FieldLabel><Input type="number" min="0" step="1" value={wall.blocking_rows} onChange={(event) => update("blocking_rows", event.target.value)} /></label>
          <label><FieldLabel>Bottom plate layers</FieldLabel><Input type="number" min="0" step="1" value={wall.bottom_plate_layers} onChange={(event) => update("bottom_plate_layers", event.target.value)} /></label>
          <label><FieldLabel>Top plate layers</FieldLabel><Input type="number" min="0" step="1" value={wall.top_plate_layers} onChange={(event) => update("top_plate_layers", event.target.value)} /></label>
          <label><FieldLabel>Corner count</FieldLabel><Input type="number" min="0" step="1" value={wall.corner_count} onChange={(event) => update("corner_count", event.target.value)} /></label>
          <label><FieldLabel>Extra studs / corner</FieldLabel><Input type="number" min="0" step="1" value={wall.corner_extra_studs} onChange={(event) => update("corner_extra_studs", event.target.value)} /></label>
          <label><FieldLabel>Intersection count</FieldLabel><Input type="number" min="0" step="1" value={wall.intersection_count} onChange={(event) => update("intersection_count", event.target.value)} /></label>
          <label><FieldLabel>Extra studs / intersection</FieldLabel><Input type="number" min="0" step="1" value={wall.intersection_extra_studs} onChange={(event) => update("intersection_extra_studs", event.target.value)} /></label>
        </div>
        <div><h3 className="text-sm font-bold text-slate-950">Material rates and waste</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label><FieldLabel>Stud / each</FieldLabel><MoneyInput value={wall.stud_unit_price} onChange={(event) => update("stud_unit_price", event.target.value)} /></label>
          <label><FieldLabel>Plate / linear ft</FieldLabel><MoneyInput value={wall.plate_unit_price_per_lf} onChange={(event) => update("plate_unit_price_per_lf", event.target.value)} /></label>
          <label><FieldLabel>Blocking / linear ft</FieldLabel><MoneyInput value={wall.blocking_unit_price_per_lf} onChange={(event) => update("blocking_unit_price_per_lf", event.target.value)} /></label>
          <label><FieldLabel>Stud waste (%)</FieldLabel><Input type="number" min="0" value={wall.stud_waste_percent} onChange={(event) => update("stud_waste_percent", event.target.value)} /></label>
          <label><FieldLabel>Plate waste (%)</FieldLabel><Input type="number" min="0" value={wall.plate_waste_percent} onChange={(event) => update("plate_waste_percent", event.target.value)} /></label>
        </div></div>
        <div><Toggle checked={!!wall.sheathing_enabled} onChange={(value) => update("sheathing_enabled", value)}>Include wall sheathing</Toggle>{wall.sheathing_enabled ? <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label><FieldLabel>Sheathing type</FieldLabel><Input value={wall.sheathing_type} onChange={(event) => update("sheathing_type", event.target.value)} /></label>
          <label><FieldLabel>Panel width (ft)</FieldLabel><Input type="number" min="0.1" value={wall.panel_width_ft} onChange={(event) => update("panel_width_ft", event.target.value)} /></label>
          <label><FieldLabel>Panel height (ft)</FieldLabel><Input type="number" min="0.1" value={wall.panel_height_ft} onChange={(event) => update("panel_height_ft", event.target.value)} /></label>
          <label><FieldLabel>Panel / each</FieldLabel><MoneyInput value={wall.sheathing_unit_price} onChange={(event) => update("sheathing_unit_price", event.target.value)} /></label>
          <label><FieldLabel>Sheathing waste (%)</FieldLabel><Input type="number" min="0" value={wall.sheathing_waste_percent} onChange={(event) => update("sheathing_waste_percent", event.target.value)} /></label>
        </div> : null}</div>
        <div><h3 className="text-sm font-bold text-slate-950">Labor</h3><div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label><FieldLabel>Productivity (wall ft / hour)</FieldLabel><Input type="number" min="0.01" step="0.1" value={wall.labor_productivity_lf_per_hour} onChange={(event) => update("labor_productivity_lf_per_hour", event.target.value)} /></label>
          <label><FieldLabel>Loaded hourly rate</FieldLabel><MoneyInput value={wall.loaded_hourly_rate} onChange={(event) => update("loaded_hourly_rate", event.target.value)} /></label>
          <label><FieldLabel>Complexity factor</FieldLabel><Input type="number" min="0.1" step="0.1" value={wall.complexity_factor} onChange={(event) => update("complexity_factor", event.target.value)} /></label>
        </div></div>
        <div><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-950">Doors and windows</h3><p className="mt-1 text-xs text-slate-500">Opening positions prevent regular studs from being counted through the opening.</p></div><button type="button" onClick={() => update("openings", [...wall.openings, createOpening({ name: `Opening ${wall.openings.length + 1}` })])} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"><SymbolIcon name="add" className="text-[17px]" />Opening</button></div><div className="mt-3 space-y-3">{wall.openings.length ? wall.openings.map((opening, index) => <OpeningEditor key={opening.id} opening={opening} onChange={(value) => updateOpening(index, value)} onRemove={() => update("openings", wall.openings.filter((_, itemIndex) => itemIndex !== index))} />) : <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-xs text-slate-500">No openings in this assembly.</div>}</div></div>
        <label><FieldLabel>Assembly notes</FieldLabel><Textarea value={wall.notes} onChange={(event) => update("notes", event.target.value)} /></label>
      </div> : null}
    </section>
  );
}

function FloorEditor({ section, calculation, open, onToggle, onChange, onRemove }) {
  const update = (field, value) => onChange({ ...section, [field]: value });
  return <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><CardHeading title={section.name || "Floor section"} description={`${section.length_ft} x ${section.width_ft} ft / ${money(calculation?.subtotal)}`} open={open} onToggle={onToggle} onRemove={onRemove} />{open ? <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 xl:grid-cols-3">
    <label><FieldLabel>Name</FieldLabel><Input value={section.name} onChange={(event) => update("name", event.target.value)} /></label>
    <label><FieldLabel>Length (ft)</FieldLabel><Input type="number" min="0.1" value={section.length_ft} onChange={(event) => update("length_ft", event.target.value)} /></label>
    <label><FieldLabel>Width (ft)</FieldLabel><Input type="number" min="0.1" value={section.width_ft} onChange={(event) => update("width_ft", event.target.value)} /></label>
    <label><FieldLabel>Joist direction</FieldLabel><Select value={section.joist_direction} onChange={(event) => update("joist_direction", event.target.value)}><option value="width">Joists span width</option><option value="length">Joists span length</option></Select></label>
    <label><FieldLabel>Joist size</FieldLabel><Input value={section.joist_size} onChange={(event) => update("joist_size", event.target.value)} /></label>
    <label><FieldLabel>Joist spacing (in)</FieldLabel><Input type="number" min="1" value={section.joist_spacing_in} onChange={(event) => update("joist_spacing_in", event.target.value)} /></label>
    <label><FieldLabel>Joist / linear ft</FieldLabel><MoneyInput value={section.joist_unit_price_per_lf} onChange={(event) => update("joist_unit_price_per_lf", event.target.value)} /></label>
    <label><FieldLabel>Rim board length (0 = perimeter)</FieldLabel><Input type="number" min="0" value={section.rim_board_lf} onChange={(event) => update("rim_board_lf", event.target.value)} /></label>
    <label><FieldLabel>Rim / linear ft</FieldLabel><MoneyInput value={section.rim_unit_price_per_lf} onChange={(event) => update("rim_unit_price_per_lf", event.target.value)} /></label>
    <label><FieldLabel>Blocking rows</FieldLabel><Input type="number" min="0" value={section.blocking_rows} onChange={(event) => update("blocking_rows", event.target.value)} /></label>
    <label><FieldLabel>Blocking / linear ft</FieldLabel><MoneyInput value={section.blocking_unit_price_per_lf} onChange={(event) => update("blocking_unit_price_per_lf", event.target.value)} /></label>
    <div className="sm:col-span-2 xl:col-span-3"><Toggle checked={!!section.subfloor_enabled} onChange={(value) => update("subfloor_enabled", value)}>Include subfloor panels</Toggle></div>
    {section.subfloor_enabled ? <><label><FieldLabel>Subfloor panel / each</FieldLabel><MoneyInput value={section.subfloor_unit_price} onChange={(event) => update("subfloor_unit_price", event.target.value)} /></label><label><FieldLabel>Subfloor waste (%)</FieldLabel><Input type="number" min="0" value={section.subfloor_waste_percent} onChange={(event) => update("subfloor_waste_percent", event.target.value)} /></label></> : null}
    <label><FieldLabel>Productivity (sq ft / hour)</FieldLabel><Input type="number" min="0.01" value={section.labor_productivity_sqft_per_hour} onChange={(event) => update("labor_productivity_sqft_per_hour", event.target.value)} /></label>
    <label><FieldLabel>Loaded hourly rate</FieldLabel><MoneyInput value={section.loaded_hourly_rate} onChange={(event) => update("loaded_hourly_rate", event.target.value)} /></label>
    <label><FieldLabel>Complexity factor</FieldLabel><Input type="number" min="0.1" step="0.1" value={section.complexity_factor} onChange={(event) => update("complexity_factor", event.target.value)} /></label>
  </div> : null}</section>;
}

function MemberEditor({ section, calculation, open, onToggle, onChange, onRemove }) {
  const update = (field, value) => onChange({ ...section, [field]: value });
  return <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><CardHeading title={section.name || "Structural member"} description={`${section.resolution === "tbd" ? "Size TBD" : "Specified"} / ${money(calculation?.subtotal)}`} open={open} onToggle={onToggle} onRemove={onRemove} />{open ? <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 xl:grid-cols-3">
    <label><FieldLabel>Name</FieldLabel><Input value={section.name} onChange={(event) => update("name", event.target.value)} /></label>
    <label><FieldLabel>Member type</FieldLabel><Select value={section.member_type} onChange={(event) => update("member_type", event.target.value)}><option value="beam">Beam</option><option value="post">Post</option><option value="header">Header</option><option value="other">Other</option></Select></label>
    <label><FieldLabel>Status</FieldLabel><Select value={section.resolution} onChange={(event) => update("resolution", event.target.value)}><option value="tbd">TBD by engineer / supplier</option><option value="specified">Specified</option></Select></label>
    <label className="sm:col-span-2 xl:col-span-3"><FieldLabel>Description / specified size</FieldLabel><Input value={section.description} onChange={(event) => update("description", event.target.value)} placeholder="Do not assume an engineered size" /></label>
    <label><FieldLabel>Length (ft)</FieldLabel><Input type="number" min="0" value={section.length_ft} onChange={(event) => update("length_ft", event.target.value)} /></label>
    <label><FieldLabel>Quantity</FieldLabel><Input type="number" min="1" value={section.quantity} onChange={(event) => update("quantity", event.target.value)} /></label>
    <label><FieldLabel>Ply count</FieldLabel><Input type="number" min="1" value={section.ply_count} onChange={(event) => update("ply_count", event.target.value)} /></label>
    <label><FieldLabel>Material / linear ft</FieldLabel><MoneyInput value={section.unit_price_per_lf} onChange={(event) => update("unit_price_per_lf", event.target.value)} /></label>
    <label><FieldLabel>Labor / member</FieldLabel><MoneyInput value={section.labor_price_each} onChange={(event) => update("labor_price_each", event.target.value)} /></label>
  </div> : null}</section>;
}

function RoofEditor({ section, calculation, open, onToggle, onChange, onRemove }) {
  const update = (field, value) => onChange({ ...section, [field]: value });
  return <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><CardHeading title={section.name || "Roof section"} description={`${section.method === "truss" ? "Trusses" : "Stick framed"} / ${money(calculation?.subtotal)}`} open={open} onToggle={onToggle} onRemove={onRemove} />{open ? <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 xl:grid-cols-3">
    <label><FieldLabel>Name</FieldLabel><Input value={section.name} onChange={(event) => update("name", event.target.value)} /></label>
    <label><FieldLabel>Method</FieldLabel><Select value={section.method} onChange={(event) => update("method", event.target.value)}><option value="truss">Prefabricated truss</option><option value="stick">Stick framed</option></Select></label>
    <label><FieldLabel>Building length (ft)</FieldLabel><Input type="number" min="0.1" value={section.building_length_ft} onChange={(event) => update("building_length_ft", event.target.value)} /></label>
    <label><FieldLabel>Span (ft)</FieldLabel><Input type="number" min="0.1" value={section.span_ft} onChange={(event) => update("span_ft", event.target.value)} /></label>
    <label><FieldLabel>Spacing (in)</FieldLabel><Input type="number" min="1" value={section.spacing_in} onChange={(event) => update("spacing_in", event.target.value)} /></label>
    <label><FieldLabel>Pitch rise (/12)</FieldLabel><Input type="number" min="0" value={section.pitch_rise} onChange={(event) => update("pitch_rise", event.target.value)} /></label>
    <label><FieldLabel>Overhang (ft)</FieldLabel><Input type="number" min="0" step="0.1" value={section.overhang_ft} onChange={(event) => update("overhang_ft", event.target.value)} /></label>
    {section.method === "truss" ? <><label><FieldLabel>Standard truss / each</FieldLabel><MoneyInput value={section.truss_unit_price} onChange={(event) => update("truss_unit_price", event.target.value)} /></label><label><FieldLabel>Labor / truss</FieldLabel><MoneyInput value={section.truss_labor_price_each} onChange={(event) => update("truss_labor_price_each", event.target.value)} /></label><label><FieldLabel>Special truss count</FieldLabel><Input type="number" min="0" value={section.special_truss_count} onChange={(event) => update("special_truss_count", event.target.value)} /></label><label><FieldLabel>Special truss / each</FieldLabel><MoneyInput value={section.special_truss_unit_price} onChange={(event) => update("special_truss_unit_price", event.target.value)} /></label></> : <><label><FieldLabel>Rafter / linear ft</FieldLabel><MoneyInput value={section.rafter_unit_price_per_lf} onChange={(event) => update("rafter_unit_price_per_lf", event.target.value)} /></label><label><FieldLabel>Labor / rafter</FieldLabel><MoneyInput value={section.rafter_labor_price_each} onChange={(event) => update("rafter_labor_price_each", event.target.value)} /></label><label><FieldLabel>Ridge / linear ft</FieldLabel><MoneyInput value={section.ridge_unit_price_per_lf} onChange={(event) => update("ridge_unit_price_per_lf", event.target.value)} /></label></>}
    <div className="sm:col-span-2 xl:col-span-3"><Toggle checked={!!section.sheathing_enabled} onChange={(value) => update("sheathing_enabled", value)}>Include roof sheathing</Toggle></div>
    {section.sheathing_enabled ? <><label><FieldLabel>Sheathing panel / each</FieldLabel><MoneyInput value={section.sheathing_unit_price} onChange={(event) => update("sheathing_unit_price", event.target.value)} /></label><label><FieldLabel>Sheathing waste (%)</FieldLabel><Input type="number" min="0" value={section.sheathing_waste_percent} onChange={(event) => update("sheathing_waste_percent", event.target.value)} /></label></> : null}
  </div> : null}</section>;
}

function RowList({ title, description, rows, onChange, kind }) {
  const add = () => {
    const base = kind === "hardware" ? { id: `hardware-${Date.now()}`, description: "", quantity: "1", unit: "each", unit_price: "0" } : kind === "allowance" ? { id: `allowance-${Date.now()}`, category: "equipment", description: "", price: "0" } : { id: `extra-${Date.now()}`, description: "", price: "" };
    onChange([...rows, base]);
  };
  const update = (index, field, value) => onChange(rows.map((row, itemIndex) => itemIndex === index ? { ...row, [field]: value } : row));
  return <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-950">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div><button type="button" onClick={add} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"><SymbolIcon name="add" className="text-[17px]" />Add</button></div><div className="mt-4 space-y-3">{rows.length ? rows.map((row, index) => <div key={row.id || index} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-12">
    {kind === "allowance" ? <label className="sm:col-span-3"><FieldLabel>Category</FieldLabel><Select value={row.category} onChange={(event) => update(index, "category", event.target.value)}><option value="equipment">Equipment</option><option value="delivery">Delivery</option><option value="subcontractor">Subcontractor</option><option value="misc">Miscellaneous</option></Select></label> : null}
    <label className={kind === "hardware" ? "sm:col-span-5" : kind === "allowance" ? "sm:col-span-5" : "sm:col-span-8"}><FieldLabel>Description</FieldLabel><Input value={row.description || ""} onChange={(event) => update(index, "description", event.target.value)} /></label>
    {kind === "hardware" ? <><label className="sm:col-span-2"><FieldLabel>Quantity</FieldLabel><Input type="number" min="0" value={row.quantity} onChange={(event) => update(index, "quantity", event.target.value)} /></label><label className="sm:col-span-2"><FieldLabel>Unit</FieldLabel><Input value={row.unit} onChange={(event) => update(index, "unit", event.target.value)} /></label><label className="sm:col-span-2"><FieldLabel>Unit price</FieldLabel><MoneyInput value={row.unit_price} onChange={(event) => update(index, "unit_price", event.target.value)} /></label></> : <label className={kind === "allowance" ? "sm:col-span-3" : "sm:col-span-3"}><FieldLabel>{kind === "extra" ? "Adjustment" : "Price"}</FieldLabel><MoneyInput value={row.price} allowNegative={kind === "extra"} onChange={(event) => update(index, "price", event.target.value)} /></label>}
    <button type="button" onClick={() => onChange(rows.filter((_, itemIndex) => itemIndex !== index))} title="Remove" className="inline-flex h-10 items-center justify-center self-end rounded-lg text-slate-500 hover:bg-red-100 hover:text-red-700 sm:col-span-1"><SymbolIcon name="delete" className="text-[18px]" /></button>
  </div>) : <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-xs text-slate-500">No items added.</div>}</div></section>;
}

function EstimatePreview({ draft, calculation, estimateNumber }) {
  const detailed = draft.inputs.output_preference === "detailed";
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Framing estimate</div><h2 className="mt-1 text-xl font-bold">{draft.project_name || "Untitled estimate"}</h2><div className="mt-1 text-xs text-slate-300">{estimateNumber || "Unsaved draft"}</div></div><div className="text-right"><div className="text-xs text-slate-300">Estimated price</div><div className="mt-1 text-2xl font-bold">{money(calculation.final_price)}</div></div></div></div>
    <div className="space-y-5 p-5">
      {calculation.unresolved_items?.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><strong>Structural selections still TBD:</strong> {calculation.unresolved_items.join(", ")}. Pricing shown is only the entered allowance and is not an engineered member selection.</div> : null}
      {detailed ? calculation.sections.map((section) => <div key={`${section.category}-${section.section_id}`}><div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2"><div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{section.category}</div><h3 className="text-sm font-bold text-slate-950">{section.name}</h3></div><strong className="text-sm text-slate-950">{money(section.subtotal)}</strong></div><div className="divide-y divide-slate-100">{section.line_items.map((item) => <div key={item.code} className="py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-sm font-semibold text-slate-900">{item.name}</div><div className="mt-0.5 text-xs leading-5 text-slate-500">{item.quantity} {item.unit} at {money(item.rate)}</div></div><div className="shrink-0 text-sm font-semibold text-slate-900">{money(item.amount)}</div></div><details className="mt-1"><summary className="cursor-pointer text-xs font-medium text-slate-500">How was this calculated?</summary><p className="mt-1 text-xs leading-5 text-slate-500">{item.trace}</p></details></div>)}</div></div>) : <div className="space-y-2">{calculation.sections.map((section) => <div key={`${section.category}-${section.section_id}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm"><span className="min-w-0 truncate font-medium text-slate-700">{section.name}</span><strong className="text-slate-950">{money(section.subtotal)}</strong></div>)}</div>}
      <div className="space-y-2 border-t border-slate-200 pt-4 text-sm"><div className="flex justify-between"><span className="text-slate-600">Direct cost</span><span>{money(calculation.direct_cost)}</span></div><div className="flex justify-between"><span className="text-slate-600">Overhead</span><span>{money(calculation.overhead_amount)}</span></div><div className="flex justify-between"><span className="text-slate-600">Profit</span><span>{money(calculation.profit_amount)}</span></div>{Number(calculation.extras_subtotal) ? <div className="flex justify-between"><span className="text-slate-600">Adjustments</span><span>{money(calculation.extras_subtotal)}</span></div> : null}{Number(calculation.tax_amount) ? <div className="flex justify-between"><span className="text-slate-600">Tax</span><span>{money(calculation.tax_amount)}</span></div> : null}{Number(calculation.discount_amount) ? <div className="flex justify-between text-emerald-700"><span>Discount</span><span>-{money(calculation.discount_amount)}</span></div> : null}<div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-bold"><span>Estimated total</span><span>{money(calculation.final_price)}</span></div><div className="text-right text-xs text-slate-500">Planning range {money(calculation.range_low)} to {money(calculation.range_high)}</div></div>
    </div>
    <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-5 text-slate-500">This tool estimates quantities and pricing from user-entered assumptions. It does not size structural members or replace engineering, code review, or field verification.</div>
  </section>;
}

export default function FramingEstimator() {
  const { estimateId } = useParams();
  const navigate = useNavigate();
  const authed = !!localStorage.getItem("access");
  const isNew = estimateId === "new";
  const [draft, setDraft] = useState(createDraft);
  const [estimateNumber, setEstimateNumber] = useState("");
  const [openItems, setOpenItems] = useState({});
  const [generalOpen, setGeneralOpen] = useState(true);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const calculation = useMemo(() => calculateFramingEstimate(draft.inputs), [draft.inputs]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        if (isNew) {
          let next = createDraft();
          const pending = localStorage.getItem(PENDING_KEY);
          if (pending) {
            try { const parsed = JSON.parse(pending); if (parsed?.inputs) next = { ...next, ...parsed, inputs: normalizeFramingInputsForEditor(parsed.inputs) }; } catch { localStorage.removeItem(PENDING_KEY); }
          }
          if (authed && !next.inputs.prepared_by) {
            const { data } = await api.get("/users/me/").catch(() => ({ data: null }));
            const name = data?.display_name || data?.username || "";
            if (name) next.inputs.prepared_by = name;
          }
          if (!cancelled) setDraft(next);
        } else {
          if (!authed) { navigate(`/login?next=/framing-estimator/${estimateId}`, { replace: true }); return; }
          const { data } = await api.get(`/estimates/${estimateId}/`);
          if (data.estimate_type !== "framing") { navigate(`/${['drywall', 'paving', 'roofing', 'flooring', 'siding', 'decking', 'fencing', 'windows', 'doors', 'garage_coating', 'electrical', 'plumbing'].includes(data.estimate_type) ? data.estimate_type : 'project'}-estimator/${estimateId}`, { replace: true }); return; }
          if (!cancelled) { setDraft({ status: data.status || "draft", project_name: data.project_name, issue_date: data.issue_date, valid_until: data.valid_until || "", inputs: normalizeFramingInputsForEditor(data.inputs) }); setEstimateNumber(data.estimate_number); }
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError?.response?.status === 404 ? "This estimate was not found." : "The estimate could not be loaded.");
      } finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [authed, estimateId, isNew, navigate]);

  const updateDraft = (field, value) => { setDraft((current) => ({ ...current, [field]: value })); setNotice(""); };
  const updateInputs = (field, value) => { setDraft((current) => ({ ...current, inputs: { ...current.inputs, [field]: value } })); setNotice(""); };
  const updateArray = (field, index, value) => updateInputs(field, draft.inputs[field].map((item, itemIndex) => itemIndex === index ? value : item));
  const removeArray = (field, index) => updateInputs(field, draft.inputs[field].filter((_, itemIndex) => itemIndex !== index));
  const addArray = (field, factory) => { const item = factory(); updateInputs(field, [...draft.inputs[field], item]); setOpenItems((current) => ({ ...current, [item.id]: true })); };

  const saveEstimate = async () => {
    if (!draft.project_name.trim()) { setError("Enter a project or estimate name."); return; }
    if (![draft.inputs.wall_sections, draft.inputs.floor_sections, draft.inputs.structural_members, draft.inputs.roof_sections, draft.inputs.hardware_items, draft.inputs.cost_allowances].some((items) => items.length)) { setError("Add at least one framing scope item."); return; }
    if (!authed) { localStorage.setItem(PENDING_KEY, JSON.stringify(draft)); navigate("/register?next=/framing-estimator/new"); return; }
    setBusy(true); setError("");
    try {
      const payload = { ...draft, estimate_type: "framing" };
      const { data } = isNew ? await api.post("/estimates/", payload) : await api.patch(`/estimates/${estimateId}/`, payload);
      localStorage.removeItem(PENDING_KEY); setEstimateNumber(data.estimate_number); setDraft((current) => ({ ...current, status: data.status, inputs: normalizeFramingInputsForEditor(data.inputs) })); setNotice(isNew ? "Estimate saved." : "Estimate updated.");
      if (isNew) navigate(`/framing-estimator/${data.id}`, { replace: true });
    } catch (requestError) {
      const response = requestError?.response?.data;
      setError(typeof response === "string" ? response : response?.detail || Object.values(response || {}).flat().join(" ") || "The estimate could not be saved.");
    } finally { setBusy(false); }
  };

  const deleteEstimate = async () => {
    if (!window.confirm("Delete this framing estimate? This cannot be undone.")) return;
    setBusy(true);
    try { await api.delete(`/estimates/${estimateId}/`); navigate("/estimates", { replace: true }); } catch { setError("The estimate could not be deleted."); setBusy(false); }
  };

  if (loading) return <div className="min-h-screen bg-[#FBF9F7] py-16 text-center text-sm text-slate-500">Loading framing estimate...</div>;

  const categories = [
    { field: "wall_sections", label: "Wall assemblies", description: "Studs, plates, blocking, sheathing, openings, and wall labor.", factory: () => createWallSection({ name: `Wall Assembly ${draft.inputs.wall_sections.length + 1}` }), Component: WallEditor },
    { field: "floor_sections", label: "Floor framing", description: "Joists, rim board, blocking, subfloor, and floor labor.", factory: () => createFloorSection({ name: `Floor Section ${draft.inputs.floor_sections.length + 1}` }), Component: FloorEditor },
    { field: "structural_members", label: "Beams and posts", description: "Price specified members or keep their structural selection clearly marked TBD.", factory: () => createStructuralMember({ name: `Structural Member ${draft.inputs.structural_members.length + 1}` }), Component: MemberEditor },
    { field: "roof_sections", label: "Roof framing", description: "Truss or stick-framed roof quantities, labor, and sheathing.", factory: () => createRoofSection({ name: `Roof Section ${draft.inputs.roof_sections.length + 1}` }), Component: RoofEditor },
  ];

  return <div className="min-h-screen bg-[#FBF9F7] pb-16 text-slate-900">
    <div className="border-b border-slate-200 bg-white"><Container className="py-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><Link to={authed ? "/estimates" : "/project-estimator"} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-800"><SymbolIcon name="arrow_back" className="text-[17px]" />{authed ? "Estimates" : "Project Estimator"}</Link><h1 className="mt-2 text-3xl font-bold text-slate-950">Framing estimate</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Build framing quantities and pricing by assembly without treating planning assumptions as structural engineering.</p></div><div className="flex gap-2">{authed ? <Link to="/framing-estimator/new" className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"><SymbolIcon name="add" className="text-[18px]" />New</Link> : null}<Button type="button" onClick={saveEstimate} disabled={busy} className="h-11 gap-2"><SymbolIcon name={authed ? "save" : "person_add"} className="text-[18px]" />{authed ? "Save estimate" : "Create account to save"}</Button></div></div></Container></div>
    <Container className="py-6 sm:py-8"><div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)] lg:items-start"><div className="min-w-0 space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><CardHeading title="Estimate details" description="Project identity, customer, dates, and status." open={generalOpen} onToggle={() => setGeneralOpen((value) => !value)} />{generalOpen ? <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <label className="sm:col-span-2"><FieldLabel>Project or estimate name</FieldLabel><Input value={draft.project_name} onChange={(event) => updateDraft("project_name", event.target.value)} /></label>
        <label><FieldLabel>Prepared by</FieldLabel><Input value={draft.inputs.prepared_by} onChange={(event) => updateInputs("prepared_by", event.target.value)} /></label>
        <label><FieldLabel>Client name</FieldLabel><Input value={draft.inputs.client_name} onChange={(event) => updateInputs("client_name", event.target.value)} /></label>
        <label className="sm:col-span-2"><FieldLabel>Project location</FieldLabel><Input value={draft.inputs.project_location} onChange={(event) => updateInputs("project_location", event.target.value)} /></label>
        <label><FieldLabel>Issue date</FieldLabel><Input type="date" value={draft.issue_date} onChange={(event) => updateDraft("issue_date", event.target.value)} /></label>
        <label><FieldLabel>Valid until</FieldLabel><Input type="date" value={draft.valid_until} onChange={(event) => updateDraft("valid_until", event.target.value)} /></label>
        <label><FieldLabel>Status</FieldLabel><Select value={draft.status} onChange={(event) => updateDraft("status", event.target.value)}><option value="draft">Draft</option><option value="final">Final</option></Select></label>
      </div> : null}</section>

      {categories.map(({ field, label, description, factory, Component }) => <section key={field} className="space-y-3"><div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-950">{label}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div><button type="button" onClick={() => addArray(field, factory)} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"><SymbolIcon name="add" className="text-[18px]" />Add</button></div>{draft.inputs[field].length ? draft.inputs[field].map((item, index) => <Component key={item.id} {...(field === "wall_sections" ? { wall: item } : { section: item })} calculation={calculation.sections.find((result) => result.section_id === item.id)} open={openItems[item.id] ?? index === 0} onToggle={() => setOpenItems((current) => ({ ...current, [item.id]: !(current[item.id] ?? index === 0) }))} onChange={(value) => updateArray(field, index, value)} onRemove={() => removeArray(field, index)} />) : <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-xs text-slate-500">No {label.toLowerCase()} added.</div>}</section>)}

      <RowList title="Hardware, fasteners, and adhesives" description="Add hangers, anchors, nails, screws, straps, adhesives, and other quantity-based items." rows={draft.inputs.hardware_items} onChange={(value) => updateInputs("hardware_items", value)} kind="hardware" />
      <RowList title="Equipment and other direct costs" description="Delivery, equipment, subcontractors, and miscellaneous direct project costs." rows={draft.inputs.cost_allowances} onChange={(value) => updateInputs("cost_allowances", value)} kind="allowance" />
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-lg font-bold text-slate-950">Scope and assumptions</h2><div className="mt-4 grid gap-4 sm:grid-cols-3"><label><FieldLabel>Included scope</FieldLabel><Textarea value={draft.inputs.included_scope.join("\n")} onChange={(event) => updateInputs("included_scope", event.target.value.split("\n"))} placeholder="One item per line" /></label><label><FieldLabel>Excluded scope</FieldLabel><Textarea value={draft.inputs.excluded_scope.join("\n")} onChange={(event) => updateInputs("excluded_scope", event.target.value.split("\n"))} placeholder="One item per line" /></label><label><FieldLabel>Assumptions</FieldLabel><Textarea value={draft.inputs.assumptions.join("\n")} onChange={(event) => updateInputs("assumptions", event.target.value.split("\n"))} placeholder="One item per line" /></label></div></section>
      <RowList title="Adjustments" description="Use positive values for additions and negative values for credits." rows={draft.inputs.extras} onChange={(value) => updateInputs("extras", value)} kind="extra" />
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-lg font-bold text-slate-950">Pricing and presentation</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label><FieldLabel>Overhead (%)</FieldLabel><Input type="number" min="0" value={draft.inputs.overhead_percent} onChange={(event) => updateInputs("overhead_percent", event.target.value)} /></label>
        <label><FieldLabel>Profit method</FieldLabel><Select value={draft.inputs.profit_method} onChange={(event) => updateInputs("profit_method", event.target.value)}><option value="markup">Markup on cost</option><option value="margin">Target gross margin</option></Select></label>
        <label><FieldLabel>{draft.inputs.profit_method === "margin" ? "Target margin" : "Markup"} (%)</FieldLabel><Input type="number" min="0" max={draft.inputs.profit_method === "margin" ? "95" : "500"} value={draft.inputs.profit_percent} onChange={(event) => updateInputs("profit_percent", event.target.value)} /></label>
        <label><FieldLabel>Tax (%)</FieldLabel><Input type="number" min="0" max="100" value={draft.inputs.tax_percent} onChange={(event) => updateInputs("tax_percent", event.target.value)} /></label>
        <label><FieldLabel>Discount type</FieldLabel><Select value={draft.inputs.discount_type} onChange={(event) => updateInputs("discount_type", event.target.value)}><option value="percent">Percent</option><option value="fixed">Fixed amount</option></Select></label>
        <label><FieldLabel>Discount</FieldLabel><Input type="number" min="0" value={draft.inputs.discount_value} onChange={(event) => updateInputs("discount_value", event.target.value)} /></label>
        <label className="sm:col-span-2 xl:col-span-3"><FieldLabel>Customer output</FieldLabel><div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-100 p-1">{[["detailed", "Detailed"], ["summary", "Summary"]].map(([value, label]) => <button key={value} type="button" onClick={() => updateInputs("output_preference", value)} className={`h-10 rounded-lg px-3 text-sm font-semibold ${draft.inputs.output_preference === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>{label}</button>)}</div></label>
        <label className="sm:col-span-2 xl:col-span-3"><FieldLabel>Estimate notes</FieldLabel><Textarea value={draft.inputs.notes} onChange={(event) => updateInputs("notes", event.target.value)} /></label>
      </div></section>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-xs leading-5 text-amber-950">FlatOrigin provides estimating calculations, not structural design. Verify dimensions, loading, member sizes, code requirements, labor productivity, and supplier pricing before issuing the estimate.</div>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}{notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</div> : null}
      <div className="flex flex-col gap-2 sm:flex-row"><Button type="button" disabled={busy} onClick={saveEstimate} className="h-11 flex-1 gap-2"><SymbolIcon name={authed ? "save" : "person_add"} className="text-[18px]" />{authed ? (isNew ? "Save estimate" : "Update estimate") : "Create free account to save"}</Button>{authed && !isNew ? <button type="button" disabled={busy} onClick={deleteEstimate} className="h-11 rounded-xl border border-red-200 px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60">Delete estimate</button> : null}</div>
    </div><div className="min-w-0 lg:sticky lg:top-24"><EstimatePreview draft={draft} calculation={calculation} estimateNumber={estimateNumber} /></div></div></Container>
  </div>;
}
