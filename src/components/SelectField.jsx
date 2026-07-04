export default function SelectField({ label, value, onChange, options }) {
  return (
    <div className="hxs-field" style={{ margin: 0 }}>
      <label className="hxs-label">
        {label}
        <select className="hxs-select" value={value} onChange={(e) => onChange(e.target.value)}>
          {Object.entries(options).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
