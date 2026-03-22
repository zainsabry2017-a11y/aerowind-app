interface AeroDataTableProps {
  columns: string[];
  rows: string[][];
}

const AeroDataTable = ({ columns, rows }: AeroDataTableProps) => (
  <div className="border border-border rounded-sm overflow-hidden">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-secondary/50">
          {columns.map((col, i) => (
            <th key={i} className="px-4 py-2 text-left text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} className="border-t border-border hover:bg-secondary/30 transition-colors">
            {row.map((cell, ci) => (
              <td key={ci} className="px-4 py-2.5 font-mono-data text-xs text-foreground/80">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default AeroDataTable;
