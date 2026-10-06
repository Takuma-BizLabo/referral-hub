/** ベンダー（案件）ごとの識別色。ID から安定的に割り当てる。 */
const PALETTE = [
  { bg: "bg-teal-600", text: "text-white", dot: "bg-teal-500" },
  { bg: "bg-blue-600", text: "text-white", dot: "bg-blue-500" },
  { bg: "bg-amber-500", text: "text-white", dot: "bg-amber-400" },
  { bg: "bg-rose-600", text: "text-white", dot: "bg-rose-500" },
  { bg: "bg-violet-600", text: "text-white", dot: "bg-violet-500" },
  { bg: "bg-lime-600", text: "text-white", dot: "bg-lime-500" },
  { bg: "bg-orange-600", text: "text-white", dot: "bg-orange-500" },
  { bg: "bg-cyan-600", text: "text-white", dot: "bg-cyan-500" },
  { bg: "bg-pink-600", text: "text-white", dot: "bg-pink-500" },
  { bg: "bg-indigo-600", text: "text-white", dot: "bg-indigo-500" },
];

export function vendorColor(id: number) {
  return PALETTE[id % PALETTE.length];
}
