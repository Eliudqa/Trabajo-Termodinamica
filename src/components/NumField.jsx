export default function NumField({ label, value, onChange, step = "any", suffix }) {
  return (
    <div className="hxs-field">
      <label className="hxs-label">
        {label}
        {suffix ? ` (${suffix})` : ""}
        <input
          className="hxs-input"
          type="number"
          step={step}
          value={value ?? ""}
          placeholder="—"
          onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
        />
      </label>
    </div>
  );
}
