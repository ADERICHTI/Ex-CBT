// Lightweight editable/read-only grid shared by the question editor and the
// submissions spreadsheet view - avoids pulling in a full grid dependency.
export default function SpreadsheetTable({
  columns,
  rows,
  editable = false,
  onCellChange,
  onDeleteRow,
  emptyMessage = 'No data yet.',
}) {
  if (!rows.length) {
    return <p className="text-sm text-[var(--text-muted)] py-10 text-center">{emptyMessage}</p>;
  }

  return (
    <div className="spreadsheet-wrap">
      <table className="spreadsheet-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.width ? { width: col.width } : undefined}>{col.label}</th>
            ))}
            {editable && onDeleteRow && <th className="spreadsheet-action-col"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id ?? rowIndex}>
              {columns.map((col) => (
                <td key={col.key}>
                  {editable && col.editable !== false ? (
                    <input
                      className="cell-input"
                      value={row[col.key] ?? ''}
                      onChange={(e) => onCellChange(rowIndex, col.key, e.target.value)}
                    />
                  ) : col.render ? (
                    col.render(row[col.key], row)
                  ) : (
                    String(row[col.key] ?? '')
                  )}
                </td>
              ))}
              {editable && onDeleteRow && (
                <td className="spreadsheet-action-col">
                  <button type="button" onClick={() => onDeleteRow(rowIndex)} className="text-red-500 hover:text-red-700" title="Delete row">
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
