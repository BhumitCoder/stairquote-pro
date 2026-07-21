import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR } from "@/lib/format";

// Extracted so recharts (a large dependency) is code-split into its own chunk
// and lazy-loaded — the dashboard's first paint doesn't wait on it.
const C_QUOTED = "#2563eb";
const C_BILLED = "#e8484d";
const C_RECEIVED = "#0d9488";

// ₹ axis ticks in Indian compact units (1.2L / 50k)
function inrCompact(v: number): string {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
  return `₹${v}`;
}

export type TrendPoint = { month: string; Quoted: number; Billed: number; Received: number };

export default function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke="#e9e9ee" strokeWidth={1} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#71717a" }}
          />
          <YAxis
            tickFormatter={inrCompact}
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fontSize: 11, fill: "#71717a" }}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            formatter={(v: number) => formatINR(v)}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e4e4e7",
              fontSize: 12,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="Quoted" fill={C_QUOTED} radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="Billed" fill={C_BILLED} radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="Received" fill={C_RECEIVED} radius={[3, 3, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
